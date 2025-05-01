import { PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TokenInfo } from '@solana/spl-token-registry';
import { getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';

import {
  ENDPOINT,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  SOL_TOKEN_ADDRESS,
  YOT_TOKEN_ACCOUNT,
  YOS_TOKEN_ACCOUNT,
  POOL_SOL_ACCOUNT,
  LIQUIDITY_CONTRIBUTION_PERCENT,
  YOS_CASHBACK_PERCENT
} from './constants';

/**
 * Enum of supported swap providers
 */
export enum SwapProvider {
  Direct = 'direct',  // Direct swap through our contract
  Contract = 'contract', // Multi-hub-swap contract
  Raydium = 'raydium', // Raydium DEX
  Jupiter = 'jupiter'  // Jupiter Aggregator
}

/**
 * Summary of a swap transaction including fees and other details
 */
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

/**
 * Information about a swap route step
 */
export interface RouteInfo {
  inputMint: string;
  outputMint: string;
  ammId?: string;
  marketId?: string;
  label?: string;
  percent?: number;
}

/**
 * Result of a swap estimate operation
 */
export interface SwapEstimate {
  estimatedAmount: number;
  minAmountOut: number;
  priceImpact: number;
  liquidityFee: number;
  route: string[];
  routeInfo?: RouteInfo[];
  provider: SwapProvider;
  intermediateTokens?: string[]; // Added for multi-hop routes
  hops?: number; // Number of hops in the route
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
  slippage: number = 0.01,
  preferredProvider?: SwapProvider
): Promise<SwapEstimate> {
  console.log(`Estimating swap: ${amount} ${fromToken.symbol} → ${toToken.symbol}, slippage: ${slippage * 100}%`);
  
  // Import the contract implementation for estimation
  const { getMultiHubSwapEstimate: getContractEstimate } = await import('./multihub-contract');
  
  try {
    // Always use the contract implementation for estimates
    return await getContractEstimate(fromToken, toToken, amount, slippage);
  } catch (error) {
    console.error('Error getting contract estimate, using fallback:', error);
    
    // CRITICAL FIX: Use proper exchange rate calculation for fallback estimates
    // Try to fetch pool data from API for more accurate rates
    try {
      // Attempt to get real pool data from the API
      const response = await fetch('/api/pool-data');
      if (response.ok) {
        const poolData = await response.json();
        console.log("Using API-based fallback estimation for better accuracy");
        
        if (fromToken.address === SOL_TOKEN_ADDRESS && toToken.address === YOT_TOKEN_ADDRESS) {
          // Calculate SOL → YOT rate using correct formula
          // SOL is measured in lamports (1e9 smallest units)
          const solReserveInLamports = poolData.sol * 1e9;
          const yotReserveInSmallestUnit = poolData.yot;
          
          // Calculate rate (adjusted by fee)
          const yotPerSol = yotReserveInSmallestUnit / solReserveInLamports;
          const estimatedAmount = amount * 1e9 * yotPerSol * 0.997; // Apply 0.3% fee
          const minAmountOut = estimatedAmount * (1 - slippage);
          
          console.log(`FALLBACK CALC (SOL→YOT): ${amount} SOL should yield ${estimatedAmount} YOT`);
          
          return {
            estimatedAmount,
            minAmountOut,
            priceImpact: Math.min(0.01, amount / poolData.sol), // Cap at 1%
            liquidityFee: amount * 0.003, // 0.3% fee
            route: [`${fromToken.symbol} → ${toToken.symbol}`],
            provider: SwapProvider.Contract
          };
        } 
        else if (fromToken.address === YOT_TOKEN_ADDRESS && toToken.address === SOL_TOKEN_ADDRESS) {
          // Calculate YOT → SOL rate using correct formula
          const solReserveInLamports = poolData.sol * 1e9;
          const yotReserveInSmallestUnit = poolData.yot;
          
          // Calculate rate (adjusted by fee)
          const solPerYot = solReserveInLamports / yotReserveInSmallestUnit;
          const estimatedAmountInLamports = amount * solPerYot * 0.997; // Apply 0.3% fee
          const estimatedAmount = estimatedAmountInLamports / 1e9; // Convert from lamports to SOL
          const minAmountOut = estimatedAmount * (1 - slippage);
          
          console.log(`FALLBACK CALC (YOT→SOL): ${amount} YOT should yield ${estimatedAmount} SOL`);
          
          return {
            estimatedAmount,
            minAmountOut,
            priceImpact: Math.min(0.01, amount / poolData.yot), // Cap at 1%
            liquidityFee: amount * 0.003, // 0.3% fee
            route: [`${fromToken.symbol} → ${toToken.symbol}`],
            provider: SwapProvider.Contract
          };
        }
      }
    } catch (error) {
      console.warn('API-based fallback estimation failed:', error);
      // Continue to simple fallback if API fetch fails
    }
    
    // Simple fallback if everything else fails
    const estimatedAmount = amount * 0.98; // Assume 2% slippage
    const minAmountOut = estimatedAmount * (1 - slippage);
    
    return {
      estimatedAmount,
      minAmountOut,
      priceImpact: 0.02,
      liquidityFee: 0.003,
      route: [fromToken.address, toToken.address],
      provider: SwapProvider.Contract,
      hops: 1
    };
  }
}

/**
 * Execute a multi-hub swap transaction using the selected provider
 * @param wallet Connected wallet adapter
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap (in UI format)
 * @param minAmountOut Minimum output amount expected
 * @param provider The preferred provider to use for the swap (default is the contract)
 * @param referrer Optional referrer public key for affiliate rewards
 * @returns Transaction signature
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  minAmountOut: number,
  provider: SwapProvider = SwapProvider.Contract,
  referrer?: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }
  
  console.log(`Executing swap with provider: ${provider}`);
  console.log(`Swap details: ${amount} ${fromToken.symbol} -> min ${minAmountOut} ${toToken.symbol}`);
  
  try {
    // Import necessary implementations based on provider
    switch (provider) {
      case SwapProvider.Contract:
        // Use our Multi-hub contract implementation
        const { executeMultiHubSwap: executeContractSwap } = await import('./multihub-contract');
        return await executeContractSwap(
          wallet, 
          fromToken, 
          toToken, 
          amount, 
          minAmountOut, 
          referrer ? new PublicKey(referrer) : undefined
        );
        
      case SwapProvider.Raydium:
        // Use Raydium implementation
        try {
          const { executeRaydiumSwap } = await import('./raydium-swap');
          return await executeRaydiumSwap(wallet, fromToken, toToken, amount, minAmountOut);
        } catch (error) {
          console.error('Raydium swap failed, falling back to contract:', error);
          // Fall back to contract implementation
          const { executeMultiHubSwap: fallbackSwap } = await import('./multihub-contract');
          return await fallbackSwap(wallet, fromToken, toToken, amount, minAmountOut);
        }
        
      case SwapProvider.Jupiter:
        // Use Jupiter implementation
        try {
          const { executeJupiterSwap } = await import('./jupiter-swap');
          return await executeJupiterSwap(wallet, fromToken, toToken, amount, minAmountOut);
        } catch (error) {
          console.error('Jupiter swap failed, falling back to contract:', error);
          // Fall back to contract implementation
          const { executeMultiHubSwap: fallbackSwap } = await import('./multihub-contract');
          return await fallbackSwap(wallet, fromToken, toToken, amount, minAmountOut);
        }
        
      default:
        // Default to contract implementation
        const { executeMultiHubSwap: defaultSwap } = await import('./multihub-contract');
        return await defaultSwap(wallet, fromToken, toToken, amount, minAmountOut);
    }
  } catch (error: unknown) {
    console.error('Swap execution failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to execute swap: ${errorMessage}`);
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
  
  try {
    // Import the contract implementation for claiming rewards
    const { claimYosRewards } = await import('./multihub-contract');
    return await claimYosRewards(wallet);
  } catch (error: unknown) {
    console.error('Error claiming rewards:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to claim YOS rewards: ${errorMessage}`);
  }
}

/**
 * Find a route for swapping between two tokens using any available provider
 * Uses all available swap providers to find the best route
 * @param fromTokenMint Source token mint address
 * @param toTokenMint Destination token mint address
 * @returns Best available provider and route info
 */
export async function findMultiHubSwapRoute(
  fromTokenMint: string,
  toTokenMint: string
): Promise<{
  provider: SwapProvider;
  routeInfo: any;
  hops: number;
  intermediateTokens?: string[];
}> {
  // Check for direct route - this is always preferred for critical pairs
  if (isContractEligible(fromTokenMint, toTokenMint)) {
    console.log('Found direct contract route for critical token pair');
    return {
      provider: SwapProvider.Contract,
      routeInfo: {
        inputMint: fromTokenMint,
        outputMint: toTokenMint,
      },
      hops: 1
    };
  }
  
  // Try to find all available routes across providers
  const routes = await findAllAvailableRoutes(fromTokenMint, toTokenMint);
  
  if (routes.length === 0) {
    console.warn('No routes found, using fallback via SOL');
    
    // Fallback to a route via SOL if no direct routes found
    return {
      provider: SwapProvider.Contract,
      routeInfo: {
        inputMint: fromTokenMint,
        outputMint: toTokenMint,
        via: SOL_TOKEN_ADDRESS
      },
      hops: 2,
      intermediateTokens: [SOL_TOKEN_ADDRESS]
    };
  }
  
  // Enhanced route selection with scoring mechanism
  interface ScoredRoute {
    provider: SwapProvider;
    routeInfo: any;
    hops: number;
    intermediateTokens?: string[];
    score: number;
  }
  
  // Score all routes based on hops and provider preference
  const scoredRoutes: ScoredRoute[] = routes.map(route => {
    // Base score starts at 100
    let score = 100;
    
    // Subtract 10 points per hop (fewer hops is better)
    score -= (route.hops - 1) * 10;
    
    // Provider preferences
    if (route.provider === SwapProvider.Contract) score += 30; // Prefer our contract
    if (route.provider === SwapProvider.Jupiter) score += 20; // Prefer Jupiter over Raydium
    if (route.provider === SwapProvider.Raydium) score += 10; // Raydium is okay
    
    // Bonus for direct paths
    if (route.hops === 1) score += 50;
    
    // Penalties for longer paths
    if (route.hops > 2) score -= 20;
    
    // Return enhanced route with score
    return {
      ...route,
      score
    };
  });
  
  // Sort by score (highest first)
  scoredRoutes.sort((a, b) => b.score - a.score);
  
  console.log(`Found ${scoredRoutes.length} routes, best route score: ${scoredRoutes[0]?.score || 'N/A'}`);
  
  // Return the highest scoring route
  return scoredRoutes[0] || routes[0];
}

/**
 * Find all available routes between two tokens across all providers
 * @param fromTokenMint Source token mint address
 * @param toTokenMint Destination token mint address
 * @returns Array of available routes with provider, route info, and hop count
 */
export async function findAllAvailableRoutes(
  fromTokenMint: string,
  toTokenMint: string
): Promise<{
  provider: SwapProvider;
  routeInfo: any;
  hops: number;
  intermediateTokens?: string[];
}[]> {
  const routes = [];
  
  // Direct contract route (if eligible)
  if (isContractEligible(fromTokenMint, toTokenMint)) {
    routes.push({
      provider: SwapProvider.Contract,
      routeInfo: {
        inputMint: fromTokenMint,
        outputMint: toTokenMint
      },
      hops: 1
    });
  }
  
  // Common intermediate tokens for multi-hop routes
  const intermediateTokens = [
    SOL_TOKEN_ADDRESS, // SOL is always a good intermediate
    YOT_TOKEN_ADDRESS, // YOT has good liquidity in our pools
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    "HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs", // XMR - Raydium pool with SOL
    "9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa" // XAR - Raydium pool with SOL
  ];
  
  // Add 1-hop routes via intermediate tokens
  for (const intermediate of intermediateTokens) {
    if (intermediate !== fromTokenMint && intermediate !== toTokenMint) {
      routes.push({
        provider: SwapProvider.Contract,
        routeInfo: {
          inputMint: fromTokenMint,
          outputMint: toTokenMint,
          via: intermediate
        },
        hops: 2,
        intermediateTokens: [intermediate]
      });
    }
  }
  
  return routes;
}

/**
 * Check if a token pair is eligible for direct swaps through our contract
 * This is important for critical token pairs like SOL-YOT
 */
function isContractEligible(fromTokenMint: string, toTokenMint: string): boolean {
  // Define token address constants for external pools
  const XMR_TOKEN_ADDRESS = "HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs";
  const XAR_TOKEN_ADDRESS = "9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa";

  // SOL-YOT pair (in either direction)
  if (
    (fromTokenMint === SOL_TOKEN_ADDRESS && toTokenMint === YOT_TOKEN_ADDRESS) ||
    (fromTokenMint === YOT_TOKEN_ADDRESS && toTokenMint === SOL_TOKEN_ADDRESS)
  ) {
    return true;
  }
  
  // YOT-YOS pair (in either direction)
  if (
    (fromTokenMint === YOT_TOKEN_ADDRESS && toTokenMint === YOS_TOKEN_ADDRESS) ||
    (fromTokenMint === YOS_TOKEN_ADDRESS && toTokenMint === YOT_TOKEN_ADDRESS)
  ) {
    return true;
  }
  
  // SOL-YOS pair (in either direction)
  if (
    (fromTokenMint === SOL_TOKEN_ADDRESS && toTokenMint === YOS_TOKEN_ADDRESS) ||
    (fromTokenMint === YOS_TOKEN_ADDRESS && toTokenMint === SOL_TOKEN_ADDRESS)
  ) {
    return true;
  }
  
  // SOL-XMR pair (in either direction) - Raydium pool
  if (
    (fromTokenMint === SOL_TOKEN_ADDRESS && toTokenMint === XMR_TOKEN_ADDRESS) ||
    (fromTokenMint === XMR_TOKEN_ADDRESS && toTokenMint === SOL_TOKEN_ADDRESS)
  ) {
    return true;
  }
  
  // SOL-XAR pair (in either direction) - Raydium pool
  if (
    (fromTokenMint === SOL_TOKEN_ADDRESS && toTokenMint === XAR_TOKEN_ADDRESS) ||
    (fromTokenMint === XAR_TOKEN_ADDRESS && toTokenMint === SOL_TOKEN_ADDRESS)
  ) {
    return true;
  }
  
  return false;
}

/**
 * Calculate estimated output amount for multi-hop routes
 * This function handles price impact and slippage across multiple hops
 * @param amount Input amount
 * @param routes Array of routes to traverse
 * @param slippage Slippage tolerance
 * @returns Estimated output amount
 */
export async function calculateMultiHopEstimate(
  amount: number,
  routes: any[],
  slippage: number = 0.01
): Promise<{
  estimate: number;
  minOut: number;
}> {
  // For a single hop, return direct estimate
  if (routes.length === 1) {
    const outputAmount = amount * 0.997; // Apply a standard 0.3% fee
    return {
      estimate: outputAmount,
      minOut: outputAmount * (1 - slippage)
    };
  }
  
  // For multi-hop routes, calculate each hop sequentially
  let currentAmount = amount;
  let totalPriceImpact = 0;
  let cumulativeSlippage = slippage;
  
  for (const route of routes) {
    // Apply individual hop computation
    const { estimate } = await calculateMultiHopEstimate(currentAmount, [route], slippage);
    
    // The output of this hop becomes the input of the next
    currentAmount = estimate;
    
    // Accumulate price impact and increase slippage for each hop
    totalPriceImpact += (route.priceImpact || 0.005);
    cumulativeSlippage += (slippage * 0.1); // Increase slippage by 10% per hop
  }
  
  // Apply accumulated effects for final estimate
  const adjustedAmount = currentAmount * (1 - (totalPriceImpact * 0.05)); // Reduce impact of accumulated price impact
  
  return {
    estimate: adjustedAmount,
    minOut: adjustedAmount * (1 - cumulativeSlippage)
  };
}