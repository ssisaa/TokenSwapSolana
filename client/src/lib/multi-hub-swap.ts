import { TokenMetadata, SwapEstimate, getSwapEstimate } from './token-search-api';
import { executeSwapAndDistribute, claimYosRewards, getSwapContributionInfo, getSwapGlobalStats } from './multi-hub-swap-contract';
import { SWAP_FEE } from './constants';

/**
 * Enum representing different swap providers
 */
export enum SwapProvider {
  Raydium = 'raydium',
  Jupiter = 'jupiter',
  Contract = 'contract'
}

/**
 * Interface for swap result
 */
export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Gets a swap estimate through the appropriate provider
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @returns Swap estimate
 */
export async function getMultiHubSwapEstimate(
  fromToken: TokenMetadata,
  toToken: TokenMetadata,
  amount: number
): Promise<SwapEstimate> {
  try {
    return await getSwapEstimate(fromToken, toToken, amount);
  } catch (error) {
    console.error('Error getting swap estimate:', error);
    throw new Error(`Failed to get swap estimate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Executes a swap through the appropriate provider
 * @param wallet Connected wallet
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param provider Optional specific provider to use
 * @returns Swap result with transaction signature
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: TokenMetadata,
  toToken: TokenMetadata,
  amount: number,
  slippage: number = 0.01,
  provider?: SwapProvider
): Promise<SwapResult> {
  try {
    // Get the swap estimate first
    const estimate = await getMultiHubSwapEstimate(fromToken, toToken, amount);
    
    // Calculate minimum amount to receive based on slippage
    const minAmountOut = estimate.outputAmount * (1 - slippage);
    
    // Execute the swap using the contract
    const signature = await executeSwapAndDistribute(wallet, amount, minAmountOut);
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Claims YOS rewards from swap cashbacks
 * @param wallet Connected wallet
 * @returns Claim result with transaction signature
 */
export async function claimYosSwapRewards(wallet: any): Promise<SwapResult> {
  try {
    const signature = await claimYosRewards(wallet);
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error('Error claiming YOS rewards:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Gets user's multi-hub swap information
 * @param walletAddress User's wallet address
 * @returns User's swap and contribution information
 */
export async function getUserSwapInfo(walletAddress: string) {
  try {
    return await getSwapContributionInfo(walletAddress);
  } catch (error) {
    console.error('Error getting user swap info:', error);
    throw new Error(`Failed to get user swap info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets global multi-hub swap statistics
 * @returns Global swap and contribution statistics
 */
export async function getGlobalSwapStats() {
  try {
    return await getSwapGlobalStats();
  } catch (error) {
    console.error('Error getting global swap stats:', error);
    throw new Error(`Failed to get global swap stats: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculates fees for a swap operation
 * @param amount Amount to swap
 * @returns Fee breakdown
 */
export function calculateSwapFees(amount: number) {
  const tradingFee = amount * SWAP_FEE;
  const liquidityContribution = amount * 0.2; // 20% goes to liquidity pool
  const yosCashback = amount * 0.05; // 5% returned as YOS
  
  return {
    tradingFee,
    liquidityContribution,
    yosCashback,
    totalFees: tradingFee + liquidityContribution,
    netAmount: amount - tradingFee - liquidityContribution + yosCashback
  };
}