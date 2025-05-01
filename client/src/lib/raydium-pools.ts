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
  // Liquidity information for pools
  baseReserve?: number;
  quoteReserve?: number;
  lpSupply?: number;
  volumeUSD?: number;
  liquidityUSD?: number;
}

// Custom test pools for the application with robust liquidity
const testPools: RaydiumPoolConfig[] = [
  // XMP-SOL Pool
  {
    id: "xmp-sol-pool",
    name: "XMP-SOL",
    baseMint: "HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs", // Updated with actual token
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
    // Track pool token balances for testing
    baseReserve: 100000, // 100K XMP tokens (actual supply)
    quoteReserve: 500,    // 500 SOL
    lpSupply: 1500000,    // 1.5 million LP tokens
    volumeUSD: 125000     // $125K daily volume
  },
  // XAR-SOL Pool
  {
    id: "xar-sol-pool",
    name: "XAR-SOL",
    baseMint: "9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa", // Updated with actual token
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
    // Track pool token balances for testing
    baseReserve: 100000, // 100K XAR tokens (actual supply)
    quoteReserve: 350,    // 350 SOL
    lpSupply: 1000000,    // 1 million LP tokens
    volumeUSD: 98000      // $98K daily volume
  },
  // MTA-USDT Pool (new)
  {
    id: "mta-usdt-pool",
    name: "MTA-USDT",
    baseMint: "MTAwpfGYQbnJkjB2iHUNpGV4yxkpJpgAQNHpg3ZJXKd",
    baseSymbol: "MTA",
    quoteMint: "5kjfp2qfRbqCXTQeUYgHNnTLf13eHoKjC9RcaX3YfSBK",
    quoteSymbol: "USDT",
    lpMint: "MTAUsLP12345678900987654321MTAUsLPmint",
    marketId: "MTAUsMk987654321MTAUSMkt123456789",
    marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    marketAuthority: "HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs",
    marketBaseVault: "MTABasV12345678900987654321MTABasVault",
    marketQuoteVault: "MTAQuoV12345678900987654321MTAQuoVlt",
    marketBids: "MTABids12345678900987654321MTABidsAcc",
    marketAsks: "MTAAsks12345678900987654321MTAAsksAcc",
    marketEventQueue: "MTAEvtQ12345678900987654321MTAEventQ",
    // Track pool token balances for testing
    baseReserve: 2500000, // 2.5 million MTA tokens
    quoteReserve: 750000, // 750K USDT
    lpSupply: 1200000,    // 1.2 million LP tokens
    volumeUSD: 200000     // $200K daily volume
  },
  // USDT-SOL Pool (new)
  {
    id: "usdt-sol-pool",
    name: "USDT-SOL",
    baseMint: "5kjfp2qfRbqCXTQeUYgHNnTLf13eHoKjC9RcaX3YfSBK",
    baseSymbol: "USDT",
    quoteMint: SOL_TOKEN_ADDRESS,
    quoteSymbol: "SOL",
    lpMint: "USDSoLP12345678900987654321USDSoLPmint",
    marketId: "USDsoLMk987654321USDSoLMkt123456789",
    marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    marketAuthority: "HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs",
    marketBaseVault: "USDBasV12345678900987654321USDBasVault",
    marketQuoteVault: "USDQuoV12345678900987654321USDQuoVlt",
    marketBids: "USDBids12345678900987654321USDBidsAcc",
    marketAsks: "USDAsks12345678900987654321USDAsksAcc",
    marketEventQueue: "USDEvtQ12345678900987654321USDEventQ",
    // Track pool token balances for testing
    baseReserve: 1500000, // 1.5 million USDT 
    quoteReserve: 10000,  // 10,000 SOL
    lpSupply: 3000000,    // 3 million LP tokens
    volumeUSD: 750000     // $750K daily volume
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
    // Track pool token balances for testing
    baseReserve: 706054550, // Match existing YOT balance
    quoteReserve: 28.8,      // Match existing SOL balance
    lpSupply: 2000000,      // 2 million LP tokens
    volumeUSD: 500000       // $500K daily volume
  }
];

// Fetch Raydium pool configurations 
export async function fetchRaydiumPools(): Promise<RaydiumPoolConfig[]> {
  // For development on Replit, we'll use our test pools to avoid CORS issues
  // In a production environment, this would use the actual Raydium API
  
  console.log('Using test pool data with updated XAR and XMP token addresses');
  return testPools;
  
  /* 
  // This code would be used in production to fetch actual Raydium pools
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
  */
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
  intermediateTokens?: string[];
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
    return { 
      route: [fromSolPool, toSolPool], 
      hops: 2,
      intermediateTokens: [SOL_TOKEN_ADDRESS]
    };
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

/**
 * Get detailed pool information for specific token pairs
 * This function is tailored for XAR-SOL and XMP-SOL pools
 */
export async function getSpecificPoolDetails(tokenAddress1: string, tokenAddress2: string = SOL_TOKEN_ADDRESS): Promise<{
  poolDetails: RaydiumPoolConfig | null;
  poolExists: boolean;
  poolAuthority: string | null;
  tokenAccounts: {
    tokenAAccount: string | null;
    tokenBAccount: string | null;
  };
  reserves: {
    tokenAReserve: number | null;
    tokenBReserve: number | null;
  };
  lpToken: {
    mintAddress: string | null;
    totalSupply: number | null;
  };
}> {
  try {
    const pools = await fetchRaydiumPools();
    
    // Find the specific pool
    const poolDetails = pools.find(pool => 
      (pool.baseMint === tokenAddress1 && pool.quoteMint === tokenAddress2) ||
      (pool.baseMint === tokenAddress2 && pool.quoteMint === tokenAddress1)
    ) || null;
    
    // If no pool exists
    if (!poolDetails) {
      return {
        poolDetails: null,
        poolExists: false,
        poolAuthority: null,
        tokenAccounts: {
          tokenAAccount: null,
          tokenBAccount: null,
        },
        reserves: {
          tokenAReserve: null,
          tokenBReserve: null,
        },
        lpToken: {
          mintAddress: null,
          totalSupply: null,
        },
      };
    }
    
    // Determine which token is A and which is B
    const isFirstTokenBase = poolDetails.baseMint === tokenAddress1;
    
    // Get token accounts (vaults)
    const tokenAAccount = isFirstTokenBase ? poolDetails.marketBaseVault : poolDetails.marketQuoteVault;
    const tokenBAccount = isFirstTokenBase ? poolDetails.marketQuoteVault : poolDetails.marketBaseVault;
    
    // Get reserves
    const tokenAReserve = isFirstTokenBase ? poolDetails.baseReserve || null : poolDetails.quoteReserve || null;
    const tokenBReserve = isFirstTokenBase ? poolDetails.quoteReserve || null : poolDetails.baseReserve || null;
    
    return {
      poolDetails,
      poolExists: true,
      poolAuthority: poolDetails.marketAuthority,
      tokenAccounts: {
        tokenAAccount,
        tokenBAccount,
      },
      reserves: {
        tokenAReserve,
        tokenBReserve,
      },
      lpToken: {
        mintAddress: poolDetails.lpMint,
        totalSupply: poolDetails.lpSupply || null,
      },
    };
  } catch (error) {
    console.error("Error getting specific pool details:", error);
    return {
      poolDetails: null,
      poolExists: false,
      poolAuthority: null,
      tokenAccounts: {
        tokenAAccount: null,
        tokenBAccount: null,
      },
      reserves: {
        tokenAReserve: null,
        tokenBReserve: null,
      },
      lpToken: {
        mintAddress: null,
        totalSupply: null,
      },
    };
  }
}

/**
 * Utility function to check XAR-SOL and XMP-SOL pools specifically
 * Returns detailed info about both pools
 */
export async function checkXarXmpPools(): Promise<{
  xarSolPool: ReturnType<typeof getSpecificPoolDetails> extends Promise<infer T> ? T : never;
  xmpSolPool: ReturnType<typeof getSpecificPoolDetails> extends Promise<infer T> ? T : never;
  bothPoolsExist: boolean;
}> {
  // Get the updated token addresses from constants
  const XAR_ADDRESS = '9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa';
  const XMP_ADDRESS = 'HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs';
  
  // Get pool details for each token pair
  const xarSolPool = await getSpecificPoolDetails(XAR_ADDRESS);
  const xmpSolPool = await getSpecificPoolDetails(XMP_ADDRESS);
  
  return {
    xarSolPool,
    xmpSolPool,
    bothPoolsExist: xarSolPool.poolExists && xmpSolPool.poolExists
  };
}