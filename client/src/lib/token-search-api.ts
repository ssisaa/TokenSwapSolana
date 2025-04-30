import { Connection, PublicKey } from '@solana/web3.js';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from './constants';

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

// Top tokens that should always appear first in search results
const FEATURED_TOKENS: TokenMetadata[] = [
  {
    address: 'So11111111111111111111111111111111111111112', // Native SOL
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    tags: ['native']
  },
  {
    address: YOT_TOKEN_ADDRESS,
    symbol: 'YOT',
    name: 'YOT Token',
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png', // Placeholder logo
    tags: ['yield']
  },
  {
    address: YOS_TOKEN_ADDRESS,
    symbol: 'YOS',
    name: 'YOS Token',
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png', // Placeholder logo
    tags: ['yield', 'reward']
  },
  {
    address: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U', // Devnet USDC
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    tags: ['stablecoin']
  }
];

// Additional common tokens on Devnet for testing
const COMMON_TOKENS: TokenMetadata[] = [
  {
    address: 'AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9CmA',
    symbol: 'USDT',
    name: 'USD Tether',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    tags: ['stablecoin']
  },
  {
    address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    tags: ['meme']
  },
  {
    address: '4dhUUK2nLDtJ6XkJGAaVtYb6vGFYSsNPSgdX1MRRJszP',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png',
    tags: ['wrapped']
  },
  {
    address: 'B9NRqDJJeWGvA4Kj8ybeS4S7nXHLgGYkHWtcQF1rbeCu',
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 8,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png',
    tags: ['wrapped']
  }
];

/**
 * Search for tokens by name, symbol, or address
 * @param query Search query
 * @returns Array of tokens matching the query
 */
export async function searchTokens(query: string): Promise<TokenMetadata[]> {
  // If no query is provided, return featured tokens
  if (!query.trim()) {
    return [...FEATURED_TOKENS];
  }

  const searchPool = [...FEATURED_TOKENS, ...COMMON_TOKENS];
  const lowercaseQuery = query.toLowerCase().trim();
  
  // Check if query looks like a Solana address
  let isAddress = false;
  try {
    if (lowercaseQuery.length >= 32) {
      new PublicKey(lowercaseQuery);
      isAddress = true;
    }
  } catch (e) {
    // Not a valid address, continue with normal search
  }

  const filteredTokens = searchPool.filter(token => {
    if (isAddress) {
      return token.address.toLowerCase() === lowercaseQuery;
    }
    
    return (
      token.symbol.toLowerCase().includes(lowercaseQuery) ||
      token.name.toLowerCase().includes(lowercaseQuery) ||
      token.address.toLowerCase().includes(lowercaseQuery)
    );
  });

  // Sort results: exact matches first, then by symbol length
  return filteredTokens.sort((a, b) => {
    // Exact matches come first
    const aExactSymbol = a.symbol.toLowerCase() === lowercaseQuery;
    const bExactSymbol = b.symbol.toLowerCase() === lowercaseQuery;
    
    if (aExactSymbol && !bExactSymbol) return -1;
    if (!aExactSymbol && bExactSymbol) return 1;
    
    // Featured tokens come next
    const aIsFeatured = FEATURED_TOKENS.some(t => t.address === a.address);
    const bIsFeatured = FEATURED_TOKENS.some(t => t.address === b.address);
    
    if (aIsFeatured && !bIsFeatured) return -1;
    if (!aIsFeatured && bIsFeatured) return 1;
    
    // Then sort by symbol length (shorter first)
    return a.symbol.length - b.symbol.length;
  });
}

/**
 * Get token metadata by address
 * @param address Token address
 * @returns Token metadata if found
 */
export async function getTokenMetadata(address: string): Promise<TokenMetadata | null> {
  const allTokens = [...FEATURED_TOKENS, ...COMMON_TOKENS];
  const token = allTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
  
  if (token) {
    return token;
  }
  
  // If not found in our lists, try to fetch it from the chain
  try {
    // This would be a real on-chain lookup in a production environment
    // For now, we'll just return null
    return null;
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return null;
  }
}

/**
 * Get token metadata by address (alias for getTokenMetadata)
 * @param address Token address
 * @returns Token metadata if found
 */
export async function getTokenByAddress(address: string): Promise<TokenMetadata | null> {
  return getTokenMetadata(address);
}

/**
 * Swap estimate interface
 */
export interface SwapEstimate {
  inputAmount: number;
  outputAmount: number;
  price: number;
  priceImpact: number;
  fee: number;
  minimumReceived: number;
  route: string[];
}

/**
 * Get swap estimate between tokens
 * @param fromToken Source token
 * @param toToken Destination token 
 * @param amount Amount to swap
 * @returns Swap estimate or null if estimate fails
 */
export async function getSwapEstimate(
  fromToken: TokenMetadata,
  toToken: TokenMetadata,
  amount: number
): Promise<SwapEstimate | null> {
  if (!fromToken || !toToken || amount <= 0) {
    return null;
  }

  try {
    // In a real implementation, this would call a price API or on-chain router
    // For demo purposes, we're simulating a swap with the following assumptions:
    // 1. SOL is our base token with known price (from useSOLPrice hook)
    // 2. YOT is 1/100 of SOL price
    // 3. YOS is 1/50 of SOL price
    // 4. USDC is $1
    // 5. Other tokens have a reasonable estimate
    
    let inputUsdValue = 0;
    let outputUsdValue = 0;
    
    // Estimate input token value in USD
    if (fromToken.symbol === 'SOL') {
      inputUsdValue = amount * 22.45; // Using fixed price for demo
    } else if (fromToken.symbol === 'YOT') {
      inputUsdValue = amount * (22.45 / 100);
    } else if (fromToken.symbol === 'YOS') {
      inputUsdValue = amount * (22.45 / 50);
    } else if (fromToken.symbol === 'USDC' || fromToken.symbol === 'USDT') {
      inputUsdValue = amount;
    } else {
      inputUsdValue = amount * 0.1; // Default for other tokens
    }
    
    // Apply a small price impact for larger amounts
    const priceImpact = Math.min(amount / 1000, 0.05); // 0% to 5% impact
    
    // Calculate fee (0.3% standard DEX fee)
    const fee = inputUsdValue * 0.003;
    
    // Net value after impact and fees
    const netValue = inputUsdValue * (1 - priceImpact) - fee;
    
    // Convert net value to output token
    if (toToken.symbol === 'SOL') {
      outputUsdValue = netValue / 22.45;
    } else if (toToken.symbol === 'YOT') {
      outputUsdValue = netValue / (22.45 / 100);
    } else if (toToken.symbol === 'YOS') {
      outputUsdValue = netValue / (22.45 / 50);
    } else if (toToken.symbol === 'USDC' || toToken.symbol === 'USDT') {
      outputUsdValue = netValue;
    } else {
      outputUsdValue = netValue / 0.1;
    }
    
    // Calculate price (output token per input token)
    const price = outputUsdValue / amount;
    
    // Calculate minimum received with 1% slippage
    const minimumReceived = outputUsdValue * 0.99;
    
    // Determine route (simplified for demo)
    const route = [fromToken.symbol];
    
    // For cross-token swaps that aren't direct pairs, route through SOL
    if (
      (fromToken.symbol !== 'SOL' && toToken.symbol !== 'SOL') &&
      (fromToken.symbol !== toToken.symbol)
    ) {
      route.push('SOL');
    }
    
    // Add destination token to route
    if (fromToken.symbol !== toToken.symbol) {
      route.push(toToken.symbol);
    }
    
    return {
      inputAmount: amount,
      outputAmount: outputUsdValue,
      price,
      priceImpact: priceImpact * 100, // Convert to percentage
      fee,
      minimumReceived,
      route
    };
  } catch (error) {
    console.error('Error getting swap estimate:', error);
    return null;
  }
}