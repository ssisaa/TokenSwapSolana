import { PublicKey } from '@solana/web3.js';
import { SOL_TOKEN_ADDRESS } from './constants';

// Interface for Raydium pool configuration
export interface RaydiumPoolConfig {
  id: string;
  name: string;
  baseMint: string;
  baseSymbol: string;
  quoteMint: string;
  quoteSymbol: string;
  lpMint: string;
  marketId: string;
  marketProgramId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
}

// Fetch Raydium pool configurations from the API
export async function fetchRaydiumPools(): Promise<RaydiumPoolConfig[]> {
  try {
    // Raydium devnet pools API endpoint
    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Raydium pools: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.official;
  } catch (error) {
    console.error('Error fetching Raydium pools:', error);
    return [];
  }
}

// Get pools that include SOL as base or quote token
export async function getSOLPools(): Promise<RaydiumPoolConfig[]> {
  const pools = await fetchRaydiumPools();
  
  // Filter pools where either baseMint or quoteMint is SOL
  return pools.filter(pool => 
    pool.baseMint === SOL_TOKEN_ADDRESS || 
    pool.quoteMint === SOL_TOKEN_ADDRESS
  );
}

// Get all available pairs for a specific token through SOL
export async function getTokenPairsViaSol(tokenMintAddress: string): Promise<RaydiumPoolConfig[]> {
  const solPools = await getSOLPools();
  
  // If the token is SOL, return all SOL pools
  if (tokenMintAddress === SOL_TOKEN_ADDRESS) {
    return solPools;
  }
  
  // Find if this token has a direct pool with SOL
  const directSolPool = solPools.find(pool => 
    pool.baseMint === tokenMintAddress || 
    pool.quoteMint === tokenMintAddress
  );
  
  if (directSolPool) {
    // If there's a direct pool, find all other SOL pools to enable multi-hop routing
    return solPools.filter(pool => pool.id !== directSolPool.id);
  }
  
  // If no direct pool with SOL, return empty array
  return [];
}

// Find the most efficient route for swapping between two tokens
export async function findSwapRoute(fromTokenMint: string, toTokenMint: string): Promise<{
  route: RaydiumPoolConfig[];
  hops: number;
}> {
  // Direct swap if same token
  if (fromTokenMint === toTokenMint) {
    return { route: [], hops: 0 };
  }
  
  // Get all pools
  const pools = await fetchRaydiumPools();
  
  // Check for direct pool between tokens
  const directPool = pools.find(pool => 
    (pool.baseMint === fromTokenMint && pool.quoteMint === toTokenMint) ||
    (pool.baseMint === toTokenMint && pool.quoteMint === fromTokenMint)
  );
  
  if (directPool) {
    return { route: [directPool], hops: 1 };
  }
  
  // Check for route through SOL
  const fromSolPool = pools.find(pool => 
    (pool.baseMint === fromTokenMint && pool.quoteMint === SOL_TOKEN_ADDRESS) ||
    (pool.baseMint === SOL_TOKEN_ADDRESS && pool.quoteMint === fromTokenMint)
  );
  
  const toSolPool = pools.find(pool => 
    (pool.baseMint === toTokenMint && pool.quoteMint === SOL_TOKEN_ADDRESS) ||
    (pool.baseMint === SOL_TOKEN_ADDRESS && pool.quoteMint === toTokenMint)
  );
  
  if (fromSolPool && toSolPool) {
    return { route: [fromSolPool, toSolPool], hops: 2 };
  }
  
  // No viable route found
  return { route: [], hops: 0 };
}

// Get all tokens that can be swapped with a specific token
export async function getSwappableTokens(tokenMintAddress: string): Promise<{
  mint: string;
  symbol: string;
  route: RaydiumPoolConfig[];
}[]> {
  const pools = await fetchRaydiumPools();
  const swappableTokens: { mint: string; symbol: string; route: RaydiumPoolConfig[] }[] = [];
  
  // Find direct pools involving this token
  const directPools = pools.filter(pool => 
    pool.baseMint === tokenMintAddress || pool.quoteMint === tokenMintAddress
  );
  
  // Add direct token pairs
  for (const pool of directPools) {
    const pairMint = pool.baseMint === tokenMintAddress ? pool.quoteMint : pool.baseMint;
    const pairSymbol = pool.baseMint === tokenMintAddress ? pool.quoteSymbol : pool.baseSymbol;
    
    swappableTokens.push({
      mint: pairMint,
      symbol: pairSymbol,
      route: [pool]
    });
  }
  
  // If tokenMintAddress is SOL, we've already found all direct pairs
  if (tokenMintAddress === SOL_TOKEN_ADDRESS) {
    return swappableTokens;
  }
  
  // Find route through SOL for tokens that don't have direct pairs
  const tokenToSolPool = pools.find(pool => 
    (pool.baseMint === tokenMintAddress && pool.quoteMint === SOL_TOKEN_ADDRESS) ||
    (pool.baseMint === SOL_TOKEN_ADDRESS && pool.quoteMint === tokenMintAddress)
  );
  
  if (tokenToSolPool) {
    // All tokens that can be swapped with SOL
    const solPools = pools.filter(pool => 
      pool.baseMint === SOL_TOKEN_ADDRESS || pool.quoteMint === SOL_TOKEN_ADDRESS
    );
    
    for (const solPool of solPools) {
      // Skip the token's own SOL pool
      if (solPool.id === tokenToSolPool.id) continue;
      
      const thirdToken = solPool.baseMint === SOL_TOKEN_ADDRESS ? solPool.quoteMint : solPool.baseMint;
      const thirdSymbol = solPool.baseMint === SOL_TOKEN_ADDRESS ? solPool.quoteSymbol : solPool.baseSymbol;
      
      // Skip if we already have a direct route to this token
      if (swappableTokens.some(t => t.mint === thirdToken)) continue;
      
      swappableTokens.push({
        mint: thirdToken,
        symbol: thirdSymbol,
        route: [tokenToSolPool, solPool]
      });
    }
  }
  
  return swappableTokens;
}