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
  // This will be implemented with actual blockchain calls
  // For now, return a simulated estimate with placeholder values
  
  if (!fromToken || !toToken || !amount || amount <= 0) {
    throw new Error('Invalid swap parameters');
  }

  // Calculate 75% of the amount (the part that actually gets swapped after contributions)
  // The other 25% is split as: 20% to liquidity pool, 5% to YOS cashback
  const actualSwapAmount = amount * (1 - LIQUIDITY_CONTRIBUTION_PERCENT/100 - YOS_CASHBACK_PERCENT/100);
  
  // Simulate a price impact and estimate
  let priceImpact = Math.min(amount * 0.005, 0.05); // 0.5% per unit, max 5%
  
  // Calculate fees
  let fee = actualSwapAmount * SWAP_FEE;
  
  // Determine the provider to use based on the tokens
  let provider: SwapProvider;
  let estimatedAmount: number;
  let minAmountOut: number;
  let route: string[] = [fromToken.symbol, toToken.symbol];
  
  // Check if both tokens are supported by Raydium
  const isFromTokenSupported = isTokenSupportedByRaydium(fromToken.address);
  const isToTokenSupported = isTokenSupportedByRaydium(toToken.address);
  
  // Use specified provider if possible
  if (preferredProvider) {
    console.log(`Using preferred provider: ${preferredProvider}`);
  }
  
  // Critical pairs always use our contract for best rates
  const isSOLPair = fromToken.address === SOL_TOKEN_ADDRESS || toToken.address === SOL_TOKEN_ADDRESS;
  const isYOTPair = fromToken.address === YOT_TOKEN_ADDRESS || toToken.address === YOT_TOKEN_ADDRESS;
  
  if (isSOLPair || isYOTPair) {
    // SOL and YOT trades always go through our contract for best efficiency
    provider = SwapProvider.Contract;
    
    // Calculate estimated output with contract formula
    const conversionFactor = 0.9 * (1 - priceImpact);
    estimatedAmount = actualSwapAmount * conversionFactor;
    minAmountOut = estimatedAmount * (1 - slippage);
    
  } else if (preferredProvider === SwapProvider.Raydium && isFromTokenSupported && isToTokenSupported) {
    // User explicitly wants to use Raydium and the tokens are supported
    try {
      provider = SwapProvider.Raydium;
      
      // Get more accurate estimate from Raydium
      const raydiumEstimate = await getRaydiumSwapEstimate(
        fromToken,
        toToken,
        actualSwapAmount,
        slippage
      );
      
      estimatedAmount = raydiumEstimate.estimatedAmount;
      minAmountOut = raydiumEstimate.minAmountOut;
      priceImpact = raydiumEstimate.priceImpact;
      fee = raydiumEstimate.fee;
      
    } catch (error) {
      console.error('Error getting Raydium estimate, falling back to contract:', error);
      
      // Fall back to contract if Raydium fails
      provider = SwapProvider.Contract;
      const conversionFactor = 0.9 * (1 - priceImpact);
      estimatedAmount = actualSwapAmount * conversionFactor;
      minAmountOut = estimatedAmount * (1 - slippage);
    }
  } else if (preferredProvider === SwapProvider.Jupiter) {
    // User explicitly wants to use Jupiter
    try {
      provider = SwapProvider.Jupiter;
      
      // Get estimate from Jupiter
      const jupiterEstimate = await getJupiterSwapEstimate(
        fromToken,
        toToken,
        actualSwapAmount,
        slippage
      );
      
      estimatedAmount = jupiterEstimate.estimatedAmount;
      minAmountOut = jupiterEstimate.minAmountOut;
      priceImpact = jupiterEstimate.priceImpact;
      fee = jupiterEstimate.fee;
      route = jupiterEstimate.routes;
      
    } catch (error) {
      console.error('Error getting Jupiter estimate, falling back to contract:', error);
      
      // Fall back to contract if Jupiter fails
      provider = SwapProvider.Contract;
      const conversionFactor = 0.9 * (1 - priceImpact);
      estimatedAmount = actualSwapAmount * conversionFactor;
      minAmountOut = estimatedAmount * (1 - slippage);
    }
    
  } else if (isFromTokenSupported && isToTokenSupported) {
    // Default to Raydium for pairs it supports (when no preference specified)
    try {
      provider = SwapProvider.Raydium;
      
      // Get more accurate estimate from Raydium
      const raydiumEstimate = await getRaydiumSwapEstimate(
        fromToken,
        toToken,
        actualSwapAmount,
        slippage
      );
      
      estimatedAmount = raydiumEstimate.estimatedAmount;
      minAmountOut = raydiumEstimate.minAmountOut;
      priceImpact = raydiumEstimate.priceImpact;
      fee = raydiumEstimate.fee;
      
    } catch (error) {
      console.error('Error getting Raydium estimate, falling back to contract:', error);
      
      // Fall back to contract if Raydium fails
      provider = SwapProvider.Contract;
      const conversionFactor = 0.9 * (1 - priceImpact);
      estimatedAmount = actualSwapAmount * conversionFactor;
      minAmountOut = estimatedAmount * (1 - slippage);
    }
  } else {
    // Use contract as fallback
    provider = SwapProvider.Contract;
    
    // Calculate estimated output with contract formula
    const conversionFactor = 0.9 * (1 - priceImpact);
    estimatedAmount = actualSwapAmount * conversionFactor;
    minAmountOut = estimatedAmount * (1 - slippage);
  }

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