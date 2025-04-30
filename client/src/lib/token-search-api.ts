import { Connection, PublicKey } from '@solana/web3.js';
import { ENDPOINT } from './constants';

// Interface for token metadata
export interface TokenMetadata {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

// Solana connection
const connection = new Connection(ENDPOINT, 'confirmed');

// Mock token list for development - in production this would be fetched from Jupiter or Solana token list API
const MOCK_TOKEN_LIST: TokenMetadata[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    coingeckoId: 'solana'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U', // Devnet USDC
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin'
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Example address, not real devnet BONK
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACo1QEDSctVTHAID8',
    coingeckoId: 'bonk'
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvGB', // Example address, not real devnet JUP
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvGB/logo.png',
    coingeckoId: 'jupiter'
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Example address, not real devnet RAY
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    coingeckoId: 'raydium'
  }
];

/**
 * Search for tokens by query (symbol, name, or address)
 * @param query The search query (symbol, name, or address)
 * @returns List of matching tokens
 */
export async function searchTokens(query: string): Promise<TokenMetadata[]> {
  // In production, this would call Jupiter API or Solana token registry
  // For now, we'll implement a simple search on our mock data
  const normalizedQuery = query.toLowerCase().trim();
  
  // If the query is empty, return the first 5 tokens (most popular)
  if (!normalizedQuery) {
    return MOCK_TOKEN_LIST.slice(0, 5);
  }
  
  // Check if the query is a valid Solana address
  let isValidAddress = false;
  try {
    new PublicKey(normalizedQuery);
    isValidAddress = true;
  } catch (e) {
    // Not a valid address, will search by name/symbol
  }
  
  // Search by address if it's valid, otherwise by symbol/name
  if (isValidAddress) {
    return MOCK_TOKEN_LIST.filter(
      token => token.address.toLowerCase() === normalizedQuery
    );
  } else {
    return MOCK_TOKEN_LIST.filter(
      token => 
        token.symbol.toLowerCase().includes(normalizedQuery) ||
        token.name.toLowerCase().includes(normalizedQuery)
    );
  }
}

/**
 * Get token details by address
 * @param address The token address
 * @returns Token metadata or null if not found
 */
export async function getTokenByAddress(address: string): Promise<TokenMetadata | null> {
  // In production, this would call Jupiter API or Solana token registry
  const token = MOCK_TOKEN_LIST.find(t => t.address === address);
  return token || null;
}

/**
 * Get token price in USD
 * @param address The token address
 * @returns Token price in USD or null if not available
 */
export async function getTokenPrice(address: string): Promise<number | null> {
  // In production, this would call CoinGecko or another price API
  const token = await getTokenByAddress(address);
  if (!token || !token.coingeckoId) return null;
  
  // Mock prices for development
  const mockPrices: Record<string, number> = {
    'solana': 148.35,
    'usd-coin': 1.00,
    'bonk': 0.000013,
    'jupiter': 0.65,
    'raydium': 0.22
  };
  
  return mockPrices[token.coingeckoId] || null;
}

/**
 * Calculate swap estimate between two tokens
 * @param fromTokenAddress Source token address
 * @param toTokenAddress Destination token address
 * @param amount Amount of source token
 * @returns Estimated output amount and price impact
 */
export async function getSwapEstimate(
  fromTokenAddress: string, 
  toTokenAddress: string, 
  amount: number
): Promise<{ estimatedAmount: number; priceImpact: number }> {
  // In production, this would call Jupiter/Raydium API for quotation
  const fromToken = await getTokenByAddress(fromTokenAddress);
  const toToken = await getTokenByAddress(toTokenAddress);
  
  if (!fromToken || !toToken) {
    throw new Error("Token not found");
  }
  
  const fromPrice = await getTokenPrice(fromTokenAddress) || 1;
  const toPrice = await getTokenPrice(toTokenAddress) || 1;
  
  // Simple conversion based on price ratio with 0.5% slippage
  const slippage = 0.005;
  const perfectConversion = (amount * fromPrice) / toPrice;
  const estimatedAmount = perfectConversion * (1 - slippage);
  
  // Mock price impact - in reality this would come from the AMM calculation
  const priceImpact = amount > 1000 ? 0.5 : 0.1; // Higher amounts have more impact
  
  return {
    estimatedAmount,
    priceImpact
  };
}

/**
 * Get token balance for a wallet
 * @param tokenAddress The token address
 * @param walletAddress The wallet address
 * @returns Token balance
 */
export async function getTokenBalance(
  tokenAddress: string, 
  walletAddress: string
): Promise<number> {
  try {
    // In production, this would query the actual token account
    // For now, return a mock balance
    return Math.random() * 100;
  } catch (error) {
    console.error("Error getting token balance:", error);
    return 0;
  }
}