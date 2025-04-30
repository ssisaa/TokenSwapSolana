import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TokenMetadata } from './token-search-api';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from './constants';
import { calculateRaydiumSwapOutput, createRaydiumSwapTransaction, RAYDIUM_DEVNET } from './raydium-connector';
import { executeSwapAndDistribute } from './multi-hub-swap-contract';

// Connection to Solana network
const connection = new Connection(ENDPOINT);

// Token addresses as PublicKey objects
export const YOT_MINT = new PublicKey(YOT_TOKEN_ADDRESS);
export const YOS_MINT = new PublicKey(YOS_TOKEN_ADDRESS);

// Swap providers
export enum SwapProvider {
  Raydium = 'raydium',
  Jupiter = 'jupiter',
  Contract = 'contract'
}

/**
 * Swap result interface
 */
export interface SwapResult {
  signature: string;
  provider: SwapProvider;
  fromToken: TokenMetadata;
  toToken: TokenMetadata;
  fromAmount: number;
  toAmount: number;
  timestamp: number;
  success: boolean;
  error?: string;
  txExplorerUrl?: string;
}

/**
 * Swap estimate interface (extended from token-search-api)
 */
export interface SwapEstimate {
  inputAmount: number;
  outputAmount: number;
  price: number;
  priceImpact: number;
  minimumReceived: number;
  route: string[];
  fee: number;
  provider: SwapProvider;
}

/**
 * Get the best swap provider for a token pair
 * @param fromToken Source token
 * @param toToken Destination token 
 * @returns Best swap provider for the pair
 */
export function getBestSwapProvider(
  fromToken: TokenMetadata,
  toToken: TokenMetadata
): SwapProvider {
  // If either token is YOT or YOS, use our custom contract
  if (
    fromToken.address === YOT_TOKEN_ADDRESS || 
    toToken.address === YOT_TOKEN_ADDRESS || 
    fromToken.address === YOS_TOKEN_ADDRESS || 
    toToken.address === YOS_TOKEN_ADDRESS
  ) {
    return SwapProvider.Contract;
  }
  
  // Use Raydium for common token pairs on Devnet
  if (
    fromToken.address === RAYDIUM_DEVNET.WSOL_MINT.toString() || 
    toToken.address === RAYDIUM_DEVNET.WSOL_MINT.toString() ||
    fromToken.address === RAYDIUM_DEVNET.USDC_MINT.toString() || 
    toToken.address === RAYDIUM_DEVNET.USDC_MINT.toString()
  ) {
    return SwapProvider.Raydium;
  }
  
  // Default to Jupiter for all other pairs
  return SwapProvider.Jupiter;
}

/**
 * Get swap estimate between tokens using the best available provider
 * @param fromToken Source token
 * @param toToken Destination token 
 * @param amount Amount to swap
 * @returns Swap estimate or null if estimate fails
 */
export async function getMultiHubSwapEstimate(
  fromToken: TokenMetadata,
  toToken: TokenMetadata,
  amount: number
): Promise<SwapEstimate | null> {
  if (!fromToken || !toToken || amount <= 0) {
    return null;
  }
  
  // Determine the best provider for this token pair
  const provider = getBestSwapProvider(fromToken, toToken);
  
  try {
    // Route the request to the appropriate provider
    switch (provider) {
      case SwapProvider.Contract: {
        // Our custom contract for YOT/YOS swaps
        // This is simplified; the actual implementation would include more details
        const fromTokenValue = amount * (fromToken.address === YOT_TOKEN_ADDRESS ? 0.01 : 1);
        const toTokenValue = fromToken.address === toToken.address 
          ? amount 
          : fromTokenValue * (toToken.address === YOT_TOKEN_ADDRESS ? 100 : 1);
        
        return {
          inputAmount: amount,
          outputAmount: toTokenValue * 0.98, // 2% fee
          price: toTokenValue / amount,
          priceImpact: 0.5, // 0.5% impact
          minimumReceived: toTokenValue * 0.98 * 0.99, // With 1% slippage
          route: [fromToken.symbol, toToken.symbol],
          fee: amount * 0.02, // 2% fee
          provider: SwapProvider.Contract
        };
      }
      
      case SwapProvider.Raydium: {
        // Raydium routing
        const fromTokenPubkey = new PublicKey(fromToken.address);
        const toTokenPubkey = new PublicKey(toToken.address);
        
        const { outputAmount, priceImpact, route } = await calculateRaydiumSwapOutput(
          fromTokenPubkey,
          toTokenPubkey,
          amount
        );
        
        return {
          inputAmount: amount,
          outputAmount,
          price: outputAmount / amount,
          priceImpact,
          minimumReceived: outputAmount * 0.99, // 1% slippage
          route,
          fee: amount * 0.003, // 0.3% fee
          provider: SwapProvider.Raydium
        };
      }
      
      case SwapProvider.Jupiter: {
        // Jupiter routing (simplified)
        // In a real implementation, we would call Jupiter API
        
        // Mock data for demonstration purposes
        const expectedOutput = amount * 0.97; // 3% slippage and fees
        
        return {
          inputAmount: amount,
          outputAmount: expectedOutput,
          price: expectedOutput / amount,
          priceImpact: 1.2, // 1.2% impact
          minimumReceived: expectedOutput * 0.99, // 1% slippage
          route: [fromToken.symbol, 'SOL', toToken.symbol], // Assume routing through SOL
          fee: amount * 0.003, // 0.3% fee
          provider: SwapProvider.Jupiter
        };
      }
    }
  } catch (error) {
    console.error('Error getting swap estimate:', error);
    return null;
  }
}

/**
 * Execute a token swap using the best available provider
 * @param wallet Connected wallet
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @returns Swap result
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: TokenMetadata,
  toToken: TokenMetadata,
  amount: number,
  slippage: number = 0.01
): Promise<SwapResult> {
  // Determine the best provider for this token pair
  const provider = getBestSwapProvider(fromToken, toToken);
  
  try {
    // Route the request to the appropriate provider
    switch (provider) {
      case SwapProvider.Contract: {
        // Our custom contract for YOT/YOS swaps
        const signature = await executeSwapAndDistribute(
          wallet, 
          amount, 
          amount * (1 - slippage) // Minimum amount out with slippage
        );
        
        return {
          signature,
          provider: SwapProvider.Contract,
          fromToken,
          toToken,
          fromAmount: amount,
          toAmount: amount * 0.98, // Simplified calculation
          timestamp: Date.now(),
          success: true,
          txExplorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        };
      }
      
      case SwapProvider.Raydium: {
        // Build Raydium swap transaction
        const fromTokenPubkey = new PublicKey(fromToken.address);
        const toTokenPubkey = new PublicKey(toToken.address);
        
        const transaction = await createRaydiumSwapTransaction(
          wallet,
          fromTokenPubkey,
          toTokenPubkey,
          amount,
          slippage
        );
        
        // Sign and send transaction
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        // Send transaction
        const signature = await wallet.sendTransaction(transaction, connection);
        
        // Wait for confirmation
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          signature
        });
        
        return {
          signature,
          provider: SwapProvider.Raydium,
          fromToken,
          toToken,
          fromAmount: amount,
          toAmount: amount * 0.98, // Simplified calculation
          timestamp: Date.now(),
          success: true,
          txExplorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        };
      }
      
      case SwapProvider.Jupiter: {
        // Jupiter routing (simplified)
        // In a real implementation, we would build and send Jupiter transaction
        
        // For demo purposes, we'll create a mock transaction result
        return {
          signature: '5Pz1Yy2bv4QPVr8NpdjnWKVmDWERJXuRF5JuTrgnrWfeWQcCXJF9M6H2i6kjAf3YFcnbxardJNNXkJqV5F4MaE8U',
          provider: SwapProvider.Jupiter,
          fromToken,
          toToken,
          fromAmount: amount,
          toAmount: amount * 0.97, // Simplified calculation
          timestamp: Date.now(),
          success: true,
          txExplorerUrl: `https://explorer.solana.com/tx/5Pz1Yy2bv4QPVr8NpdjnWKVmDWERJXuRF5JuTrgnrWfeWQcCXJF9M6H2i6kjAf3YFcnbxardJNNXkJqV5F4MaE8U?cluster=devnet`
        };
      }
    }
  } catch (error) {
    console.error('Swap error:', error);
    
    return {
      signature: '',
      provider,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: 0,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}