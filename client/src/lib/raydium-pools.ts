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

// Custom test pools for the application
const testPools: RaydiumPoolConfig[] = [
  // XMP-SOL Pool
  {
    id: "xmp-sol-pool",
    name: "XMP-SOL",
    baseMint: "XMP9SXVv3Kj6JcnJEyLaQzYEuWEGsHjhJNpkha2Vk5M",
    baseSymbol: "XMP",
    quoteMint: SOL_TOKEN_ADDRESS,
    quoteSymbol: "SOL",
    lpMint: "XMPSoLP12345678900987654321XMPSoLPmint",
    marketId: "XMPsoLMk987654321XMPSoLMkt123456789",
    marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    marketAuthority: "HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs",
    marketBaseVault: "XMPBasV12345678900987654321XMPBasVault",
    marketQuoteVault: "XMPQuoV12345678900987654321XMPQuoVlt",
    marketBids: "XMPBids12345678900987654321XMPBidsAcc",
    marketAsks: "XMPAsks12345678900987654321XMPAsksAcc",
    marketEventQueue: "XMPEvtQ12345678900987654321XMPEventQ",
  },
  // XAR-SOL Pool
  {
    id: "xar-sol-pool",
    name: "XAR-SOL",
    baseMint: "XAR18RSUr4pRGnmmM5Zz9vAz3EXmvWPx7cMuFB8mvCh",
    baseSymbol: "XAR",
    quoteMint: SOL_TOKEN_ADDRESS,
    quoteSymbol: "SOL",
    lpMint: "XARSoLP12345678900987654321XARSoLPmint",
    marketId: "XARsoLMk987654321XARSoLMkt123456789",
    marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    marketAuthority: "HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs",
    marketBaseVault: "XARBasV12345678900987654321XARBasVault",
    marketQuoteVault: "XARQuoV12345678900987654321XARQuoVlt",
    marketBids: "XARBids12345678900987654321XARBidsAcc",
    marketAsks: "XARAsks12345678900987654321XARAsksAcc",
    marketEventQueue: "XAREvtQ12345678900987654321XAREventQ",
  },
  // YOT-SOL Pool (already exists but adding here for consistency)
  {
    id: "yot-sol-pool",
    name: "YOT-SOL",
    baseMint: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
    baseSymbol: "YOT",
    quoteMint: SOL_TOKEN_ADDRESS,
    quoteSymbol: "SOL",
    lpMint: "YOTSoLP12345678900987654321YOTSoLPmint",
    marketId: "YOTsoLMk987654321YOTSoLMkt123456789",
    marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    marketAuthority: "HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs",
    marketBaseVault: "YOTBasV12345678900987654321YOTBasVault",
    marketQuoteVault: "YOTQuoV12345678900987654321YOTQuoVlt",
    marketBids: "YOTBids12345678900987654321YOTBidsAcc",
    marketAsks: "YOTAsks12345678900987654321YOTAsksAcc",
    marketEventQueue: "YOTEvtQ12345678900987654321YOTEventQ",
  }
];

// Fetch Raydium pool configurations from the API
export async function fetchRaydiumPools(): Promise<RaydiumPoolConfig[]> {
  try {
    // First try to fetch from Raydium API
    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Raydium pools: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Combine API pools with our test pools, overriding duplicates with our test pools
    const apiPools: RaydiumPoolConfig[] = data.official;
    const mergedPools: RaydiumPoolConfig[] = [...apiPools];
    
    // Add our test pools, replacing any with the same ID
    for (const testPool of testPools) {
      const existingIndex = mergedPools.findIndex(pool => pool.id === testPool.id);
      if (existingIndex >= 0) {
        mergedPools[existingIndex] = testPool;
      } else {
        mergedPools.push(testPool);
      }
    }
    
    return mergedPools;
  } catch (error) {
    console.error('Error fetching Raydium pools, using test pools only:', error);
    // Fall back to our test pools if API fails
    return testPools;
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