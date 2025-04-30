import { TokenMetadata, SwapEstimate, getSwapEstimate } from './token-search-api';
import { executeSwapAndDistribute, claimYosRewards, getSwapContributionInfo, getSwapGlobalStats } from './multi-hub-swap-contract';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, DISTRIBUTION } from './constants';

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
  fromToken?: TokenMetadata;
  toToken?: TokenMetadata;
  fromAmount?: number;
  toAmount?: number;
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
    // Routes:
    // 1. YOT -> SOL: Direct on-chain swap via smart contract
    // 2. SOL -> YOT: Direct on-chain swap via smart contract
    // 3. Other -> YOT: First swap to SOL, then SOL -> YOT
    // 4. YOT -> Other: First swap YOT -> SOL, then SOL -> Other
    
    const isDirectPath = 
      (fromToken.address === YOT_TOKEN_ADDRESS && toToken.address === SOL_TOKEN_ADDRESS) ||
      (fromToken.address === SOL_TOKEN_ADDRESS && toToken.address === YOT_TOKEN_ADDRESS);
    
    if (isDirectPath) {
      return await getSwapEstimate(fromToken, toToken, amount);
    }
    
    // For multi-hop routes, we need to estimate both legs
    let middleToken: TokenMetadata = {
      symbol: 'SOL',
      name: 'Solana',
      address: SOL_TOKEN_ADDRESS,
      decimals: 9
    };
    
    if (fromToken.address === YOT_TOKEN_ADDRESS) {
      // YOT -> SOL -> Other
      const leg1 = await getSwapEstimate(fromToken, middleToken, amount);
      const leg2 = await getSwapEstimate(middleToken, toToken, leg1.outputAmount);
      
      return {
        inputAmount: amount,
        outputAmount: leg2.outputAmount,
        price: leg1.price * leg2.price,
        priceImpact: leg1.priceImpact + leg2.priceImpact,
        minimumReceived: leg2.minimumReceived,
        route: [fromToken.symbol, middleToken.symbol, toToken.symbol],
        provider: 'Multi-hop (Contract + Raydium)'
      };
    } else {
      // Other -> SOL -> YOT
      const leg1 = await getSwapEstimate(fromToken, middleToken, amount);
      const leg2 = await getSwapEstimate(middleToken, {
        symbol: 'YOT',
        name: 'YOT Token',
        address: YOT_TOKEN_ADDRESS,
        decimals: 9
      }, leg1.outputAmount);
      
      return {
        inputAmount: amount,
        outputAmount: leg2.outputAmount,
        price: leg1.price * leg2.price,
        priceImpact: leg1.priceImpact + leg2.priceImpact,
        minimumReceived: leg2.minimumReceived,
        route: [fromToken.symbol, middleToken.symbol, 'YOT'],
        provider: 'Multi-hop (Raydium + Contract)'
      };
    }
  } catch (error) {
    console.error('Error estimating swap:', error);
    throw error;
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
    const estimate = await getMultiHubSwapEstimate(fromToken, toToken, amount);
    const minAmountOut = estimate.outputAmount * (1 - slippage);
    
    // We'll start with simple YOT <-> SOL swaps using our contract
    // In a full implementation, we'd route through different providers 
    // based on the tokens and best rates
    
    // For now, use the contract for all swaps
    const signature = await executeSwapAndDistribute(wallet, amount, minAmountOut);
    
    return {
      success: true,
      signature,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: estimate.outputAmount
    };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during swap'
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
    console.error('Error claiming rewards:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error claiming rewards'
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
    throw error;
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
    throw error;
  }
}

/**
 * Calculates fees for a swap operation
 * @param amount Amount to swap
 * @returns Fee breakdown
 */
export function calculateSwapFees(amount: number) {
  const userAmount = amount * (DISTRIBUTION.USER_PERCENTAGE / 100);
  const liquidityAmount = amount * (DISTRIBUTION.LIQUIDITY_PERCENTAGE / 100);
  const cashbackAmount = amount * (DISTRIBUTION.CASHBACK_PERCENTAGE / 100);
  
  return {
    userAmount,
    liquidityAmount,
    cashbackAmount,
    total: amount
  };
}