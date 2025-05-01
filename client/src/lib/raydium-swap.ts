/**
 * Raydium Swap Integration
 * 
 * This module provides direct integration with Raydium DEX for executing token swaps
 * on the Solana blockchain, accessing pool data directly from the devnet.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TokenInfo } from '@solana/spl-token-registry';
import { ENDPOINT } from './constants';

// Define constants for known tokens and pools
const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
const XMR_TOKEN_ADDRESS = "HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs";
const XAR_TOKEN_ADDRESS = "9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa";
const YOT_TOKEN_ADDRESS = "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF";
const YOS_TOKEN_ADDRESS = "GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n";

// Raydium Program ID on devnet
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// Pool data size for Raydium pools
const POOL_DATA_SIZE = 624;

// Export known tokens for use in other modules
export const KNOWN_TOKENS = {
  SOL: SOL_TOKEN_ADDRESS,
  XMR: XMR_TOKEN_ADDRESS,
  XAR: XAR_TOKEN_ADDRESS,
  YOT: YOT_TOKEN_ADDRESS,
  YOS: YOS_TOKEN_ADDRESS
};

// Cache pool data to avoid excessive network calls
const poolCache: Record<string, { reserves: { [mint: string]: number }, lastUpdated: number }> = {};

/**
 * Fetch pool information directly from the Raydium program on devnet
 * @param connection Solana connection
 * @param tokenA First token mint address
 * @param tokenB Second token mint address
 * @returns Pool reserves for both tokens if the pool exists
 */
export async function fetchRaydiumPoolData(
  connection: Connection,
  tokenA: string,
  tokenB: string
): Promise<{ [mint: string]: number } | null> {
  // Generate a cache key for this token pair
  const cacheKey = [tokenA, tokenB].sort().join('-');
  
  // Check cache first (valid for 60 seconds)
  if (poolCache[cacheKey] && Date.now() - poolCache[cacheKey].lastUpdated < 60000) {
    console.log(`Using cached pool data for ${cacheKey}`);
    return poolCache[cacheKey].reserves;
  }

  try {
    console.log(`Fetching Raydium pool data for ${tokenA} <-> ${tokenB} from devnet...`);
    
    // Get all accounts with the right data size from Raydium program
    const filters = [{ dataSize: POOL_DATA_SIZE }];
    const accounts = await connection.getProgramAccounts(
      new PublicKey(RAYDIUM_PROGRAM_ID),
      { filters }
    );
    
    // Look for matching pool
    for (const acc of accounts) {
      const data = acc.account.data;
      const baseMint = new PublicKey(data.slice(72, 104)).toBase58();
      const quoteMint = new PublicKey(data.slice(104, 136)).toBase58();
      
      // Check if this pool matches our token pair
      if (
        ([baseMint, quoteMint].includes(tokenA) && [baseMint, quoteMint].includes(tokenB))
      ) {
        // Extract reserve data
        const baseReserve = Number(data.readBigUInt64LE(136));
        const quoteReserve = Number(data.readBigUInt64LE(144));
        
        // Create a record mapping each mint to its reserve
        const reserves: { [mint: string]: number } = {
          [baseMint]: baseReserve,
          [quoteMint]: quoteReserve
        };
        
        // Log the pool details
        console.log(`✅ Found Raydium pool for ${tokenA} <-> ${tokenB}`);
        console.log(`Pool Account: ${acc.pubkey.toBase58()}`);
        console.log(`${baseMint} Reserve: ${baseReserve}`);
        console.log(`${quoteMint} Reserve: ${quoteReserve}`);
        
        // Cache the result
        poolCache[cacheKey] = {
          reserves,
          lastUpdated: Date.now()
        };
        
        return reserves;
      }
    }
    
    console.log(`❌ No Raydium pool found for ${tokenA} <-> ${tokenB}`);
    return null;
    
  } catch (error) {
    console.error('Error fetching Raydium pool data:', error);
    return null;
  }
}

/**
 * Execute a token swap using Raydium DEX
 * @param wallet Connected wallet 
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap (in UI format)
 * @param minAmountOut Minimum output amount expected
 * @returns Transaction signature
 */
export async function executeRaydiumSwap(
  wallet: any,
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  minAmountOut: number
): Promise<string> {
  console.log(`Using Raydium to swap ${amount} ${fromToken.symbol} -> ${toToken.symbol}`);
  console.log(`Min amount out: ${minAmountOut} ${toToken.symbol}`);
  
  if (!wallet?.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }
  
  const connection = new Connection(ENDPOINT, 'confirmed');
  
  // Note: For production we should use the Raydium SDK to create the proper swap transaction.
  // Since we can't integrate with the full SDK in this environment, we'll use our multi-hub swap
  // to handle the transaction creation and execution.
  
  // Check if we have supported token pairs that can be handled by our contract
  const isDirectSwapPair = (
    (fromToken.address === SOL_TOKEN_ADDRESS && (
      toToken.address === XMR_TOKEN_ADDRESS || 
      toToken.address === XAR_TOKEN_ADDRESS
    )) ||
    (toToken.address === SOL_TOKEN_ADDRESS && (
      fromToken.address === XMR_TOKEN_ADDRESS || 
      fromToken.address === XAR_TOKEN_ADDRESS
    ))
  );
  
  if (isDirectSwapPair) {
    // Import our contract implementation for the actual swap execution
    const { executeMultiHubSwap } = await import('./multihub-contract');
    return await executeMultiHubSwap(wallet, fromToken, toToken, amount, minAmountOut);
  }
  
  throw new Error('Direct Raydium swap integration is currently under development');
}

/**
 * Get a swap estimate based on Raydium pools
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @param slippage Slippage tolerance
 * @returns Swap estimate information
 */
export async function getRaydiumSwapEstimate(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  slippage: number = 0.01
): Promise<any> {
  const connection = new Connection(ENDPOINT, 'confirmed');
  
  // Check if this is a token pair we can estimate
  const isRaydiumPair = (
    // SOL-XMR pair
    (fromToken.address === SOL_TOKEN_ADDRESS && toToken.address === XMR_TOKEN_ADDRESS) ||
    (fromToken.address === XMR_TOKEN_ADDRESS && toToken.address === SOL_TOKEN_ADDRESS) ||
    // SOL-XAR pair
    (fromToken.address === SOL_TOKEN_ADDRESS && toToken.address === XAR_TOKEN_ADDRESS) ||
    (fromToken.address === XAR_TOKEN_ADDRESS && toToken.address === SOL_TOKEN_ADDRESS)
  );
  
  if (!isRaydiumPair) {
    throw new Error('Raydium quote API not implemented for this token pair');
  }
  
  // Fetch pool data directly from the blockchain
  const poolReserves = await fetchRaydiumPoolData(
    connection,
    fromToken.address,
    toToken.address
  );
  
  if (!poolReserves) {
    throw new Error(`No Raydium pool found for ${fromToken.symbol}-${toToken.symbol}`);
  }
  
  // Calculate swap output based on constant product formula: x * y = k
  const fee = amount * 0.003; // 0.3% fee
  const amountAfterFee = amount - fee;
  
  // Get reserves for the specific tokens
  const inputReserve = poolReserves[fromToken.address];
  const outputReserve = poolReserves[toToken.address];
  
  // Apply constant product formula
  const estimatedOutput = calculateSwapAmount(
    amountAfterFee,
    inputReserve,
    outputReserve
  );
  
  const minAmountOut = estimatedOutput * (1 - slippage);
  const priceImpact = calculatePriceImpact(amount, inputReserve, outputReserve);
  
  return {
    estimatedAmount: estimatedOutput,
    minAmountOut,
    priceImpact,
    liquidityFee: fee,
    route: [`${fromToken.symbol} → ${toToken.symbol}`],
    provider: 'raydium',
    routeInfo: [{
      inputMint: fromToken.address,
      outputMint: toToken.address,
      ammId: 'raydium_pool',
      percent: 100
    }]
  };
}

/**
 * Calculate swap output amount using constant product formula
 * @param inputAmount Amount being swapped
 * @param inputReserve Current reserve of input token
 * @param outputReserve Current reserve of output token
 * @returns Estimated output amount
 */
function calculateSwapAmount(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number
): number {
  // Constant product formula: x * y = k
  // (inputReserve + inputAmount) * (outputReserve - outputAmount) = inputReserve * outputReserve
  // Therefore: outputAmount = outputReserve - (inputReserve * outputReserve) / (inputReserve + inputAmount)
  
  const numerator = inputReserve * outputReserve;
  const denominator = inputReserve + inputAmount;
  const outputAmount = outputReserve - (numerator / denominator);
  
  return outputAmount;
}

/**
 * Calculate price impact of a swap
 * @param inputAmount Amount being swapped
 * @param inputReserve Current reserve of input token
 * @param outputReserve Current reserve of output token
 * @returns Price impact percentage (0-1)
 */
function calculatePriceImpact(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number
): number {
  // Simple price impact calculation
  const impact = inputAmount / (inputReserve + inputAmount);
  return Math.min(impact, 0.5); // Cap at 50% for safety
}