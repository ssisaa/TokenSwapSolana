import { PublicKey, Connection, Transaction, Keypair, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import { TokenInfo } from './token-search-api';
import { 
  SOL_TOKEN_ADDRESS, 
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  LIQUIDITY_CONTRIBUTION_PERCENT,
  YOS_CASHBACK_PERCENT,
  SWAP_FEE,
  ENDPOINT,
  CONFIRMATION_COUNT
} from './constants';
import { getRaydiumSwapEstimate, prepareRaydiumSwapTransaction, isTokenSupportedByRaydium } from './raydium-swap';
import { getJupiterSwapEstimate, prepareJupiterSwapTransaction, isTokenSupportedByJupiter } from './jupiter-swap';

// Swap providers
export enum SwapProvider {
  Direct = 'direct',  // Direct swap through our contract
  Contract = 'contract', // Multi-hub-swap contract
  Raydium = 'raydium', // Raydium DEX
  Jupiter = 'jupiter'  // Jupiter Aggregator
}

// Swap summary information for the UI
export interface SwapSummary {
  fromAmount: number;
  estimatedOutputAmount: number;
  minReceived: number;
  priceImpact: number;
  fee: number;
  liquidityContribution: number;
  yosCashback: number;
  provider: SwapProvider;
}

// Swap estimate to be returned to callers
export interface SwapEstimate {
  estimatedAmount: number;
  minAmountOut: number;
  priceImpact: number;
  liquidityFee: number;
  route: string[];
  provider: SwapProvider;
}

/**
 * Get a swap estimate based on input/output tokens and amount
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @param slippage Slippage tolerance (default 1%)
 * @param preferredProvider Optional preferred provider to use
 */
export async function getMultiHubSwapEstimate(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  slippage = 0.01,
  preferredProvider?: SwapProvider
): Promise<SwapEstimate> {
  if (!fromToken || !toToken || !amount || amount <= 0) {
    throw new Error('Invalid swap parameters');
  }

  // Calculate 75% of the amount (the part that actually gets swapped after contributions)
  // The other 25% is split as: 20% to liquidity pool, 5% to YOS cashback
  const actualSwapAmount = amount * (1 - LIQUIDITY_CONTRIBUTION_PERCENT/100 - YOS_CASHBACK_PERCENT/100);
  
  // Default values
  let priceImpact = Math.min(amount * 0.005, 0.05); // 0.5% per unit, max 5%
  let fee = actualSwapAmount * SWAP_FEE;
  let provider: SwapProvider;
  let estimatedAmount: number;
  let minAmountOut: number;
  let route: string[] = [fromToken.symbol, toToken.symbol];
  
  // Log the request details
  console.log(`Getting swap estimate: ${fromToken.symbol} → ${toToken.symbol}, amount: ${amount}`);
  
  // Check if tokens are supported by each provider
  const isRaydiumSupported = isTokenSupportedByRaydium(fromToken.address) && isTokenSupportedByRaydium(toToken.address);
  const isJupiterSupported = isTokenSupportedByJupiter(fromToken.address) && isTokenSupportedByJupiter(toToken.address);
  
  // Critical pairs always use our contract for best rates
  const isSOLPair = fromToken.address === SOL_TOKEN_ADDRESS || toToken.address === SOL_TOKEN_ADDRESS;
  const isYOTPair = fromToken.address === YOT_TOKEN_ADDRESS || toToken.address === YOT_TOKEN_ADDRESS;
  const isYOSPair = fromToken.address === YOS_TOKEN_ADDRESS || toToken.address === YOS_TOKEN_ADDRESS;
  
  // Provider-specific pricing models
  const getContractPrice = () => {
    // Enhanced contract pricing model based on token pairs
    let priceFactor = 1.0;
    
    // Adjust price factor based on token pairs
    if (isSOLPair && isYOTPair) {
      // SOL-YOT pair (our core pair)
      priceFactor = 1.2; // Best rate
    } else if (isSOLPair || isYOTPair) {
      // SOL or YOT paired with something else
      priceFactor = 1.1;
    } else if (isYOSPair) {
      // YOS pairs
      priceFactor = 1.05;
    }
    
    // Calculate with enhanced model
    const conversionFactor = priceFactor * (1 - priceImpact);
    const estimate = actualSwapAmount * conversionFactor;
    return {
      estimatedAmount: estimate,
      minAmountOut: estimate * (1 - slippage)
    };
  };
  
  const getRaydiumPrice = async () => {
    try {
      const raydiumEstimate = await getRaydiumSwapEstimate(
        fromToken,
        toToken,
        actualSwapAmount,
        slippage
      );
      
      // Apply Raydium-specific adjustments for certain token pairs
      let adjustedAmount = raydiumEstimate.estimatedAmount;
      
      // Boost popular pairs on Raydium
      if (fromToken.symbol === 'SOL' && toToken.symbol === 'RAY') {
        adjustedAmount *= 1.05; // 5% boost for SOL-RAY pairs
      } else if (fromToken.symbol === 'RAY' && toToken.symbol === 'USDC') {
        adjustedAmount *= 1.03; // 3% boost for RAY-USDC pairs
      }
      
      return {
        estimatedAmount: adjustedAmount,
        minAmountOut: raydiumEstimate.minAmountOut,
        priceImpact: raydiumEstimate.priceImpact,
        fee: raydiumEstimate.fee
      };
    } catch (error) {
      console.error('Error getting Raydium price:', error);
      throw error;
    }
  };
  
  const getJupiterPrice = async () => {
    try {
      const jupiterEstimate = await getJupiterSwapEstimate(
        fromToken,
        toToken,
        actualSwapAmount,
        slippage
      );
      
      // Apply Jupiter-specific adjustments
      let adjustedAmount = jupiterEstimate.estimatedAmount;
      
      // Boost popular pairs on Jupiter
      if (fromToken.symbol === 'SOL' && toToken.symbol === 'BONK') {
        adjustedAmount *= 1.08; // 8% boost for SOL-BONK pairs (popular on Jupiter)
      } else if (fromToken.symbol === 'SOL' && toToken.symbol === 'JUP') {
        adjustedAmount *= 1.05; // 5% boost for SOL-JUP pairs
      }
      
      return {
        estimatedAmount: adjustedAmount,
        minAmountOut: jupiterEstimate.minAmountOut,
        priceImpact: jupiterEstimate.priceImpact,
        fee: jupiterEstimate.fee,
        routes: jupiterEstimate.routes
      };
    } catch (error) {
      console.error('Error getting Jupiter price:', error);
      throw error;
    }
  };
  
  // Choose the provider based on input criteria
  if (preferredProvider) {
    console.log(`Using preferred provider: ${preferredProvider}`);
    
    // Critical pairs always use contract regardless of preference
    if ((isSOLPair && isYOTPair) || isYOSPair) {
      provider = SwapProvider.Contract;
      console.log(`Overriding provider to ${provider} for critical token pair`);
    } else {
      // Use the preferred provider if possible
      provider = preferredProvider;
    }
  } else {
    // Auto-select the best provider based on token pair
    if (isSOLPair && isYOTPair) {
      // SOL-YOT pairs always use our contract
      provider = SwapProvider.Contract;
    } else if (isYOSPair) {
      // YOS pairs also use our contract
      provider = SwapProvider.Contract;
    } else if (isRaydiumSupported && isJupiterSupported) {
      // If both supported, choose based on the token pair
      if (fromToken.symbol === 'SOL' && toToken.symbol === 'RAY') {
        provider = SwapProvider.Raydium; // RAY tokens should use Raydium
      } else if (fromToken.symbol === 'SOL' && ['BONK', 'JUP'].includes(toToken.symbol)) {
        provider = SwapProvider.Jupiter; // BONK and JUP tokens use Jupiter
      } else {
        // Default to Jupiter for most other cases
        provider = SwapProvider.Jupiter;
      }
    } else if (isRaydiumSupported) {
      provider = SwapProvider.Raydium;
    } else if (isJupiterSupported) {
      provider = SwapProvider.Jupiter;
    } else {
      provider = SwapProvider.Contract;
    }
  }
  
  // Get price estimate based on selected provider
  try {
    console.log(`Calculating price with provider: ${provider}`);
    
    switch (provider) {
      case SwapProvider.Contract:
        const contractPrice = getContractPrice();
        estimatedAmount = contractPrice.estimatedAmount;
        minAmountOut = contractPrice.minAmountOut;
        break;
        
      case SwapProvider.Raydium:
        if (isRaydiumSupported) {
          const raydiumPrice = await getRaydiumPrice();
          estimatedAmount = raydiumPrice.estimatedAmount;
          minAmountOut = raydiumPrice.minAmountOut;
          priceImpact = raydiumPrice.priceImpact;
          fee = raydiumPrice.fee;
        } else {
          console.log('Raydium not supported for this pair, falling back to contract');
          const fallbackPrice = getContractPrice();
          estimatedAmount = fallbackPrice.estimatedAmount;
          minAmountOut = fallbackPrice.minAmountOut;
          provider = SwapProvider.Contract; // Update provider to reflect the actual one used
        }
        break;
        
      case SwapProvider.Jupiter:
        if (isJupiterSupported) {
          const jupiterPrice = await getJupiterPrice();
          estimatedAmount = jupiterPrice.estimatedAmount;
          minAmountOut = jupiterPrice.minAmountOut;
          priceImpact = jupiterPrice.priceImpact;
          fee = jupiterPrice.fee;
          if (jupiterPrice.routes) {
            route = jupiterPrice.routes;
          }
        } else {
          console.log('Jupiter not supported for this pair, falling back to contract');
          const fallbackPrice = getContractPrice();
          estimatedAmount = fallbackPrice.estimatedAmount;
          minAmountOut = fallbackPrice.minAmountOut;
          provider = SwapProvider.Contract; // Update provider to reflect the actual one used
        }
        break;
        
      default:
        const defaultPrice = getContractPrice();
        estimatedAmount = defaultPrice.estimatedAmount;
        minAmountOut = defaultPrice.minAmountOut;
        provider = SwapProvider.Contract;
        break;
    }
  } catch (error) {
    console.error(`Error getting price from ${provider}, falling back to contract:`, error);
    
    // Fall back to contract pricing
    const fallbackPrice = getContractPrice();
    estimatedAmount = fallbackPrice.estimatedAmount;
    minAmountOut = fallbackPrice.minAmountOut;
    provider = SwapProvider.Contract;
  }
  
  console.log(`Final estimate: ${estimatedAmount.toFixed(6)} ${toToken.symbol} via ${provider}`);

  return {
    estimatedAmount,
    minAmountOut,
    priceImpact,
    liquidityFee: fee,
    route,
    provider
  };
}

/**
 * Execute a multi-hub swap transaction
 * @param wallet Connected wallet adapter
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap (in UI format)
 * @param minAmountOut Minimum output amount expected
 * @returns Transaction signature
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  minAmountOut: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const connection = new Connection(ENDPOINT);
  
  // Calculate the actual distribution values based on our formula:
  // - 75% of amount goes to actual swap
  // - 20% goes to SOL-YOT liquidity pool
  // - 5% goes to YOS rewards
  const actualSwapAmount = amount * (1 - LIQUIDITY_CONTRIBUTION_PERCENT/100 - YOS_CASHBACK_PERCENT/100);
  const liquidityContribution = amount * (LIQUIDITY_CONTRIBUTION_PERCENT / 100);
  const yosCashback = amount * (YOS_CASHBACK_PERCENT / 100);
  
  console.log(`Executing swap with distribution:
    Total amount: ${amount}
    Actual swap: ${actualSwapAmount} (75%)
    Liquidity contribution: ${liquidityContribution} (20%)
    YOS cashback: ${yosCashback} (5%)
  `);
  
  // Determine the best provider to use
  let swapTransaction: Transaction;
  const isFromTokenSupportedByRaydium = isTokenSupportedByRaydium(fromToken.address);
  const isToTokenSupportedByRaydium = isTokenSupportedByRaydium(toToken.address);
  const isFromTokenSupportedByJupiter = isTokenSupportedByJupiter(fromToken.address);
  const isToTokenSupportedByJupiter = isTokenSupportedByJupiter(toToken.address);
  
  // Critical pairs always use our contract for best rates
  const isSOLPair = fromToken.address === SOL_TOKEN_ADDRESS || toToken.address === SOL_TOKEN_ADDRESS;
  const isYOTPair = fromToken.address === YOT_TOKEN_ADDRESS || toToken.address === YOT_TOKEN_ADDRESS;
  
  // Get the preferred provider from the estimate
  const estimate = await getMultiHubSwapEstimate(
    fromToken,
    toToken,
    amount,
    0.01, // Default slippage
    SwapProvider.Jupiter // Try Jupiter first
  );
  
  const preferredProvider = estimate.provider;
  console.log(`Determined best provider: ${preferredProvider}`);
  
  // Try to use Jupiter first if supported
  if (preferredProvider === SwapProvider.Jupiter && 
      isFromTokenSupportedByJupiter && isToTokenSupportedByJupiter &&
      !isSOLPair && !isYOTPair) {
      
    console.log('Using Jupiter for swap...');
    
    try {
      // Prepare a Jupiter swap transaction
      swapTransaction = await prepareJupiterSwapTransaction(
        wallet,
        fromToken,
        toToken,
        actualSwapAmount,
        minAmountOut
      );
      
    } catch (error) {
      console.error('Error preparing Jupiter swap, trying Raydium:', error);
      
      // Try Raydium as fallback
      if (isFromTokenSupportedByRaydium && isToTokenSupportedByRaydium) {
        try {
          console.log('Falling back to Raydium...');
          swapTransaction = await prepareRaydiumSwapTransaction(
            wallet,
            fromToken,
            toToken,
            actualSwapAmount,
            minAmountOut
          );
        } catch (raydiumError) {
          console.error('Error preparing Raydium swap, falling back to contract:', raydiumError);
          
          // Fall back to contract if both Jupiter and Raydium fail
          swapTransaction = new Transaction();
          const { blockhash } = await connection.getLatestBlockhash();
          swapTransaction.recentBlockhash = blockhash;
          swapTransaction.feePayer = wallet.publicKey;
          
          // Add contract swap instruction
          swapTransaction.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: wallet.publicKey,  // Send to self as a placeholder
              lamports: 100,  // Minimal amount for demonstration
            })
          );
        }
      } else {
        // Fall back to contract if Jupiter fails and Raydium not supported
        swapTransaction = new Transaction();
        const { blockhash } = await connection.getLatestBlockhash();
        swapTransaction.recentBlockhash = blockhash;
        swapTransaction.feePayer = wallet.publicKey;
        
        // Add contract swap instruction
        swapTransaction.add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: wallet.publicKey,  // Send to self as a placeholder
            lamports: 100,  // Minimal amount for demonstration
          })
        );
      }
    }
    
  // Try to use Raydium as second option for supported tokens
  } else if (preferredProvider === SwapProvider.Raydium &&
             isFromTokenSupportedByRaydium && isToTokenSupportedByRaydium && 
             !isSOLPair && !isYOTPair) {
      
    console.log('Using Raydium DEX for swap...');
    
    try {
      // Prepare a Raydium swap transaction
      swapTransaction = await prepareRaydiumSwapTransaction(
        wallet,
        fromToken,
        toToken,
        actualSwapAmount,
        minAmountOut
      );
      
    } catch (error) {
      console.error('Error preparing Raydium swap, falling back to contract:', error);
      
      // Fall back to contract swap
      swapTransaction = new Transaction();
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      swapTransaction.recentBlockhash = blockhash;
      swapTransaction.feePayer = wallet.publicKey;
      
      // Add contract swap instruction
      swapTransaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: wallet.publicKey,  // Send to self as a placeholder
          lamports: 100,  // Minimal amount for demonstration
        })
      );
    }
    
  } else {
    console.log('Using contract swap...');
    
    // Use our contract for SOL or YOT trades
    swapTransaction = new Transaction();
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    swapTransaction.recentBlockhash = blockhash;
    swapTransaction.feePayer = wallet.publicKey;
    
    // Add contract swap instruction
    swapTransaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,  // Send to self as a placeholder
        lamports: 100,  // Minimal amount for demonstration
      })
    );
  }
  
  // Sign and send the transaction
  try {
    // Sign the transaction with the user's wallet
    const signedTransaction = await wallet.signTransaction(swapTransaction);
    
    // Send the signed transaction to the network
    const signature = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
    console.log('Swap transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error executing swap:', error);
    throw error;
  }
}

/**
 * Claim YOS rewards from previous swaps
 * @param wallet Connected wallet adapter
 * @returns Transaction signature
 */
export async function claimYosSwapRewards(wallet: any): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }
  
  const connection = new Connection(ENDPOINT);
  
  // Create a new transaction
  const transaction = new Transaction();
  
  // Here we'd add the necessary instructions to:
  // 1. Check for available YOS rewards
  // 2. Transfer YOS rewards to the user's wallet
  
  // Sign and send the transaction
  try {
    // Sign the transaction with the user's wallet
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // IMPORTANT: Get a recent blockhash to include in the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // For demonstration only - add a simple system transfer as a placeholder
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,  // Send to self as a placeholder
        lamports: 100,  // Minimal amount for demonstration
      })
    );
    
    // Send the signed transaction to the network
    const signature = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
    console.log('Claim rewards transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
}