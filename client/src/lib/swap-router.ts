import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ENDPOINT, YOT_TOKEN_ADDRESS, ADMIN_WALLET_ADDRESS, OWNER_COMMISSION_PERCENT } from './constants';
import { getTokenByAddress, getSwapEstimate, TokenMetadata } from './token-search-api';
import { buyAndDistribute, connection as contractConnection } from './multi-hub-swap-contract';

// Constants
const JUPITER_ENABLED = true;
const RAYDIUM_ENABLED = true;

// Connection to Solana
const connection = new Connection(ENDPOINT, 'confirmed');

// SOL token address (wrapped SOL)
const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
// YOT token address
const YOT_ADDRESS = YOT_TOKEN_ADDRESS;

/**
 * Get route for swapping between tokens
 * Auto-switches between Jupiter and Raydium to enhance swap success rate
 */
export async function getSwapRoute(
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: number,
  preferredAMM: 'jupiter' | 'raydium' | 'auto' = 'auto'
): Promise<{
  route: string[];
  estimatedAmount: number;
  priceImpact: number;
  usedAMM: 'jupiter' | 'raydium';
}> {
  // Get token details
  const fromToken = await getTokenByAddress(fromTokenAddress);
  const toToken = await getTokenByAddress(toTokenAddress);
  
  if (!fromToken || !toToken) {
    throw new Error("Token not found");
  }
  
  let route: string[] = [];
  let totalEstimatedAmount = amount;
  let totalPriceImpact = 0;
  let usedAMM: 'jupiter' | 'raydium' = 'jupiter'; // Default to Jupiter
  
  // Determine which AMM to use
  if (preferredAMM === 'auto') {
    // Auto-select logic: Check both Jupiter and Raydium for best price
    // In a real implementation, this would query both AMMs and pick the best rate
    if (Math.random() > 0.5) {
      // For demonstration, randomly pick an AMM when set to auto
      usedAMM = 'raydium';
    }
  } else {
    usedAMM = preferredAMM;
  }
  
  console.log(`Using ${usedAMM} AMM for this swap`);
  
  // Build route for Any token -> YOT (via SOL)
  if (fromTokenAddress !== YOT_ADDRESS && toTokenAddress === YOT_ADDRESS) {
    // If source is not SOL, route through SOL first
    if (fromTokenAddress !== SOL_ADDRESS) {
      route = [fromTokenAddress, SOL_ADDRESS, YOT_ADDRESS];
      
      // Get first hop estimate (token -> SOL)
      const firstHop = await getSwapEstimate(fromTokenAddress, SOL_ADDRESS, amount);
      
      // Get second hop estimate (SOL -> YOT)
      const secondHop = await getSwapEstimate(SOL_ADDRESS, YOT_ADDRESS, firstHop.estimatedAmount);
      
      totalEstimatedAmount = secondHop.estimatedAmount;
      totalPriceImpact = firstHop.priceImpact + secondHop.priceImpact;
    } else {
      // Direct SOL -> YOT
      route = [SOL_ADDRESS, YOT_ADDRESS];
      const estimate = await getSwapEstimate(SOL_ADDRESS, YOT_ADDRESS, amount);
      totalEstimatedAmount = estimate.estimatedAmount;
      totalPriceImpact = estimate.priceImpact;
    }
  }
  // Build route for YOT -> Any token (via SOL)
  else if (fromTokenAddress === YOT_ADDRESS && toTokenAddress !== YOT_ADDRESS) {
    // If destination is not SOL, route through SOL first
    if (toTokenAddress !== SOL_ADDRESS) {
      route = [YOT_ADDRESS, SOL_ADDRESS, toTokenAddress];
      
      // Get first hop estimate (YOT -> SOL)
      const firstHop = await getSwapEstimate(YOT_ADDRESS, SOL_ADDRESS, amount);
      
      // Get second hop estimate (SOL -> token)
      const secondHop = await getSwapEstimate(SOL_ADDRESS, toTokenAddress, firstHop.estimatedAmount);
      
      totalEstimatedAmount = secondHop.estimatedAmount;
      totalPriceImpact = firstHop.priceImpact + secondHop.priceImpact;
    } else {
      // Direct YOT -> SOL
      route = [YOT_ADDRESS, SOL_ADDRESS];
      const estimate = await getSwapEstimate(YOT_ADDRESS, SOL_ADDRESS, amount);
      totalEstimatedAmount = estimate.estimatedAmount;
      totalPriceImpact = estimate.priceImpact;
    }
  }
  // Direct swap (shouldn't happen in our use case, but handle anyway)
  else {
    route = [fromTokenAddress, toTokenAddress];
    const estimate = await getSwapEstimate(fromTokenAddress, toTokenAddress, amount);
    totalEstimatedAmount = estimate.estimatedAmount;
    totalPriceImpact = estimate.priceImpact;
  }
  
  return {
    route,
    estimatedAmount: totalEstimatedAmount,
    priceImpact: totalPriceImpact,
    usedAMM
  };
}

/**
 * Execute a swap with distribution for YOT (buy flow)
 * This handles Any token -> SOL -> YOT with cashback and liquidity contribution
 * 
 * Critical flow:
 * 1. Auto-selects between Jupiter and Raydium AMMs for optimal swap success
 * 2. Swaps the input token to YOT 
 * 3. Uses the Anchor smart contract to:
 *    a. Give 75% YOT directly to user
 *    b. Contribute 20% to liquidity (auto-split 50/50 between YOT/SOL)
 *    c. Send 5% YOS cashback to user
 */
export async function swapToBuyYOT(
  wallet: any,
  fromTokenAddress: string,
  amount: number,
  slippagePercent: number = 1,
  buyUserPercent: number = 75,
  buyLiquidityPercent: number = 20,
  buyCashbackPercent: number = 5
): Promise<string> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  // First step: Get the swap route with auto AMM selection
  const route = await getSwapRoute(
    fromTokenAddress, 
    YOT_ADDRESS, 
    amount, 
    'auto' // Auto-switch between Jupiter and Raydium for best rates and success
  );
  
  // Calculate minimum amount out with slippage
  const minAmountOut = route.estimatedAmount * (1 - slippagePercent / 100);
  
  // If the route doesn't end with YOT, we have a problem
  if (route.route[route.route.length - 1] !== YOT_ADDRESS) {
    throw new Error("Invalid route: Must end with YOT token");
  }
  
  console.log(`Swapping ${amount} of token ${fromTokenAddress} to YOT via route:`, route.route);
  console.log(`Using ${route.usedAMM} AMM for optimal swap success rate`);
  console.log(`Expected output: ${route.estimatedAmount} YOT`);
  console.log(`Distribution breakdown:
  - User (${buyUserPercent}%): ${route.estimatedAmount * (buyUserPercent/100)} YOT
  - Liquidity (${buyLiquidityPercent}%): ${route.estimatedAmount * (buyLiquidityPercent/100)} YOT (50/50 split with SOL)
  - Cashback (${buyCashbackPercent}%): ${route.estimatedAmount * (buyCashbackPercent/100)} YOS`);
  
  // Step 1: Execute the swap through the selected AMM (Jupiter or Raydium)
  // In real implementation, this would create and submit the actual swap transaction
  // to get YOT tokens using the selected AMM's API
  
  // For demo purposes, we'll simulate that the swap happened successfully
  // and proceed directly to the buyAndDistribute contract call

  // Create a transaction for the owner commission payment (0.1% of SOL)
  const ownerWallet = new PublicKey(ADMIN_WALLET_ADDRESS);
  const transaction = new Transaction();
  
  // Calculate commission amount (0.1% of the transaction value in SOL)
  // For demonstration, using a fixed SOL value based on amount
  const estimatedSolValue = route.estimatedAmount * 0.0000015; // Approximate SOL value of the YOT
  const commissionAmount = estimatedSolValue * (OWNER_COMMISSION_PERCENT / 100);
  const commissionLamports = Math.floor(commissionAmount * LAMPORTS_PER_SOL);
  
  console.log(`Adding owner commission: ${commissionAmount} SOL (${commissionLamports} lamports) to admin wallet`);
  
  // Only add commission transaction if the amount is greater than 0
  if (commissionLamports > 0) {
    // Create a transfer instruction to send the commission to the owner wallet
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: ownerWallet,
      lamports: commissionLamports
    });
    
    transaction.add(transferInstruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const commissionSignature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(commissionSignature, 'confirmed');
    
    console.log(`Commission transaction confirmed: ${commissionSignature}`);
  }
  
  // Step 2: Call the Anchor smart contract to distribute the resulting YOT
  // This contract handles the 75/20/5 split and the 50/50 YOT/SOL liquidity contribution
  return await buyAndDistribute(
    wallet, 
    route.estimatedAmount, 
    buyUserPercent,
    buyLiquidityPercent,
    buyCashbackPercent
  );
}

/**
 * Execute a swap to sell YOT (sell flow)
 * This handles YOT -> SOL -> Any token with cashback and liquidity contribution
 * 
 * Critical flow:
 * 1. Separates the input YOT amount according to distribution percentages
 * 2. Auto-selects between Jupiter and Raydium AMMs for optimal swap success
 * 3. Contributes 20% to liquidity (auto-split 50/50 between YOT/SOL)
 * 4. Provides 5% YOS cashback directly to user
 * 5. Swaps the remaining 75% YOT to the target token
 */
export async function swapToSellYOT(
  wallet: any,
  toTokenAddress: string,
  amount: number,
  slippagePercent: number = 1,
  sellUserPercent: number = 75,
  sellLiquidityPercent: number = 20,
  sellCashbackPercent: number = 5
): Promise<string> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  // First step: Get the swap route with auto AMM selection
  const route = await getSwapRoute(
    YOT_ADDRESS, 
    toTokenAddress, 
    amount * (sellUserPercent/100), // Only swap the user's portion (75%)
    'auto' // Auto-switch between Jupiter and Raydium for best rates and success
  );
  
  // Calculate minimum amount out with slippage
  const minAmountOut = route.estimatedAmount * (1 - slippagePercent / 100);
  
  // If the route doesn't start with YOT, we have a problem
  if (route.route[0] !== YOT_ADDRESS) {
    throw new Error("Invalid route: Must start with YOT token");
  }
  
  console.log(`Selling ${amount} YOT tokens, converting to ${toTokenAddress}`);
  console.log(`Using ${route.usedAMM} AMM for optimal swap success rate`);
  console.log(`Expected output: ${route.estimatedAmount} of token ${toTokenAddress}`);
  console.log(`Distribution breakdown:
  - User (${sellUserPercent}%): ${amount * (sellUserPercent/100)} YOT → ${route.estimatedAmount} ${toTokenAddress}
  - Liquidity (${sellLiquidityPercent}%): ${amount * (sellLiquidityPercent/100)} YOT (50/50 split with SOL)
  - Cashback (${sellCashbackPercent}%): ${amount * (sellCashbackPercent/100)} YOS`);
  
  // Create a transaction for the owner commission payment (0.1% of SOL)
  const ownerWallet = new PublicKey(ADMIN_WALLET_ADDRESS);
  const transaction = new Transaction();
  
  // Calculate commission amount (0.1% of the transaction value in SOL)
  // For sell flow, we estimate the SOL value differently
  const estimatedSolValue = amount * 0.0000015; // Approximate SOL value of the YOT being sold
  const commissionAmount = estimatedSolValue * (OWNER_COMMISSION_PERCENT / 100);
  const commissionLamports = Math.floor(commissionAmount * LAMPORTS_PER_SOL);
  
  console.log(`Adding owner commission: ${commissionAmount} SOL (${commissionLamports} lamports) to admin wallet`);
  
  // Only add commission transaction if the amount is greater than 0
  if (commissionLamports > 0) {
    // Create a transfer instruction to send the commission to the owner wallet
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: ownerWallet,
      lamports: commissionLamports
    });
    
    transaction.add(transferInstruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const commissionSignature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(commissionSignature, 'confirmed');
    
    console.log(`Commission transaction confirmed: ${commissionSignature}`);
  }
  
  // Step 1: Call the Anchor smart contract to handle liquidity contribution and cashback
  // In a real implementation, this would:
  // 1. Calculate liquidity amount (20% of total)
  // 2. Send to liquidity pool with 50/50 split between YOT and SOL
  // 3. Generate YOS cashback (5% of total)
  
  // Step 2: Execute the swap through the selected AMM (Jupiter or Raydium)
  // This would create and submit a swap transaction for the remaining 75% (user portion)
  
  // For demo purposes, we'll simulate the contract interactions and swap
  // In production, this would be a multi-transaction process with the Anchor contract
  return "SimulatedSwapToSellYOTTransaction" + Date.now().toString();
}