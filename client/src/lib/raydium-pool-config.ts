import { PublicKey } from "@solana/web3.js";
import { 
  SOL_TOKEN_ADDRESS, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS,
  TEST_TOKENS
} from './constants';

// Interface for Raydium pool information
export interface RaydiumPool {
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  withdrawQueue: string;
  lpVault: string;
  marketVersion: number;
  marketProgramId: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  
  // Additional fields for our UI
  inputSymbol?: string;
  outputSymbol?: string;
  fee?: number;
  reserves?: {
    base: number;
    quote: number;
  };
}

// Raydium DEX Liquidity Pool Program IDs for Devnet
export const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

// Initial pool template
const basePoolTemplate = {
  baseDecimals: 9,
  quoteDecimals: 9,
  lpDecimals: 9,
  version: 4,
  programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4.toString(),
  authority: 'DhVpojXMTbZMuTaCgiiaFU7U8GvEEhnYo4G9BUdiEYGh',
  openOrders: 'AT8h6y9TB7EwBQjX5qymQo27dTiNrxJQdP5oDTdmzuNP',
  targetOrders: 'G9nt2GazsDj3Ey3KdA49Sfaq9KEwV1RhJd9HYwARvpnP',
  baseVault: '5XpUJpNFSP2e3CuQU9reKYMyBtMyWjK6BfRmB9wTuFPR',
  quoteVault: 'ACf1vUJiMXWEJQHiVeYQGWYdAJZnGi4Yie7Pug61mjfJ',
  withdrawQueue: 'CbwyVuLXjVsYJ3W4yn13zQDQGzVwjeMTcN8KzCGwn4uY',
  lpVault: 'LP9YdV3xB1pLpWq6ePpNBEjjcsxaGAyQ1MeiBcvYzxs5',
  marketVersion: 3,
  marketProgramId: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  marketId: 'DZjbn4XC8qoHKikZqzmhemykVzmossoayV9ffbsUqxVj',
  marketAuthority: 'DhVpojXMTbZMuTaCgiiaFU7U8GvEEhnYo4G9BUdiEYGh',
  marketBaseVault: '5XpUJpNFSP2e3CuQU9reKYMyBtMyWjK6BfRmB9wTuFPR',
  marketQuoteVault: 'ACf1vUJiMXWEJQHiVeYQGWYdAJZnGi4Yie7Pug61mjfJ',
  marketBids: 'B52da5SZ3ixbU7fPwuRYQJjiswxaYKiczvRS3i8XrGzY',
  marketAsks: '9YBgvRoBVGsNRvpdVKJPnTsZe4X2Z7dCUujXJA1sBGu9',
  marketEventQueue: 'H7fJgmVRMwzA3ZRzWwJXyPyHdpHsgvf7HVnd9HYqcK5H',
  fee: 0.0025, // 0.25% fee
};

// Generate initial Raydium Devnet Pools
export const RAYDIUM_DEVNET_POOLS: RaydiumPool[] = [
  // SOL-YOT pool
  {
    ...basePoolTemplate,
    id: 'devnet-sol-yot',
    baseMint: SOL_TOKEN_ADDRESS,
    quoteMint: YOT_TOKEN_ADDRESS,
    lpMint: 'LP9YdV3xB1pLpWq6ePpNBEjjcsxaGAyQ1MeiBcvYzxs5',
    inputSymbol: 'SOL',
    outputSymbol: 'YOT',
    reserves: {
      base: 1000, 
      quote: 10000
    }
  },
  
  // SOL-YOS pool
  {
    ...basePoolTemplate,
    id: 'devnet-sol-yos',
    baseMint: SOL_TOKEN_ADDRESS,
    quoteMint: YOS_TOKEN_ADDRESS,
    lpMint: 'LP8YdV3xB1pLpWq6ePpNBEjjcsxaGAyQ1MeiBcvYzys6',
    inputSymbol: 'SOL',
    outputSymbol: 'YOS',
    reserves: {
      base: 1000,
      quote: 20000
    }
  },
  
  // YOT-YOS pool
  {
    ...basePoolTemplate,
    id: 'devnet-yot-yos',
    baseMint: YOT_TOKEN_ADDRESS,
    quoteMint: YOS_TOKEN_ADDRESS,
    lpMint: 'LP7YdV3xB1pLpWq6ePpNBEjjcsxaGAyQ1MeiBcvYzys7',
    inputSymbol: 'YOT',
    outputSymbol: 'YOS',
    reserves: {
      base: 10000,
      quote: 20000
    }
  },
];

// Add pools for test tokens (these will be created dynamically)
Object.entries(TEST_TOKENS).forEach(([symbol, address], index) => {
  // Add SOL-TestToken pool
  RAYDIUM_DEVNET_POOLS.push({
    ...basePoolTemplate,
    id: `devnet-sol-${symbol.toLowerCase()}`,
    baseMint: SOL_TOKEN_ADDRESS,
    quoteMint: address,
    lpMint: `LP${index}SolTest${symbol}${Date.now().toString().substring(0, 5)}`,
    inputSymbol: 'SOL',
    outputSymbol: symbol,
    reserves: {
      base: 100,
      quote: 2000
    }
  });
  
  // Add YOT-TestToken pool
  RAYDIUM_DEVNET_POOLS.push({
    ...basePoolTemplate,
    id: `devnet-yot-${symbol.toLowerCase()}`,
    baseMint: YOT_TOKEN_ADDRESS,
    quoteMint: address,
    lpMint: `LP${index}YotTest${symbol}${Date.now().toString().substring(0, 5)}`,
    inputSymbol: 'YOT',
    outputSymbol: symbol,
    reserves: {
      base: 1000,
      quote: 1500
    }
  });
});