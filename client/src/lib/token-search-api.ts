import { PublicKey } from '@solana/web3.js';
import { 
  SOL_TOKEN_ADDRESS, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  SOL_SYMBOL,
  YOT_SYMBOL,
  YOS_SYMBOL,
  SOL_DECIMALS,
  YOT_DECIMALS,
  YOS_DECIMALS
} from './constants';

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
  tags?: string[];
}

// Default tokens for our application
export const defaultTokens: TokenInfo[] = [
  {
    address: SOL_TOKEN_ADDRESS,
    symbol: SOL_SYMBOL,
    name: 'Solana',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: SOL_DECIMALS,
    tags: ['native', 'solana']
  },
  {
    address: YOT_TOKEN_ADDRESS,
    symbol: YOT_SYMBOL,
    name: 'Your Own Token',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    decimals: YOT_DECIMALS,
    tags: ['token', 'staking']
  },
  {
    address: YOS_TOKEN_ADDRESS,
    symbol: YOS_SYMBOL,
    name: 'Your Own Staking',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    decimals: YOS_DECIMALS,
    tags: ['token', 'rewards']
  },
  // Add some common test tokens
  {
    address: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U',
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6,
    tags: ['stablecoin']
  },
  {
    address: '5kjfp2qfRbqCXTQeUYgHNnTLf13eHoKjC9RcaX3YfSBK',
    symbol: 'USDT',
    name: 'USDT',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    decimals: 6,
    tags: ['stablecoin']
  }
];

/**
 * Fetches Solana tokens including default and important tokens
 * Uses both default tokens and data from the Solana token registry API
 */
export async function fetchSolanaTokens(): Promise<TokenInfo[]> {
  try {
    // First, try to fetch tokens from the Solana token registry API
    const response = await fetch('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
    
    if (!response.ok) {
      console.warn('Failed to fetch Solana token list, using default tokens only');
      return defaultTokens;
    }
    
    const data = await response.json();
    
    if (!data || !Array.isArray(data.tokens)) {
      console.warn('Invalid token list format, using default tokens only');
      return defaultTokens;
    }
    
    // Map the API response to our TokenInfo format
    const apiTokens: TokenInfo[] = data.tokens
      // Filter to include only devnet tokens for testing
      .filter((token: any) => 
        token.chainId === 103 || // Filter for devnet tokens
        token.address === SOL_TOKEN_ADDRESS // Always include SOL
      )
      // Map to our TokenInfo format
      .map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI,
        decimals: token.decimals,
        tags: token.tags
      }))
      // Limit to a reasonable number to prevent performance issues
      .slice(0, 50);
    
    // Make sure our default tokens are included
    const allTokens = [...defaultTokens];
    
    // Add tokens from API if they don't already exist
    apiTokens.forEach(apiToken => {
      if (!allTokens.some(token => token.address === apiToken.address)) {
        allTokens.push(apiToken);
      }
    });
    
    console.log(`Loaded ${allTokens.length} tokens (${defaultTokens.length} default + ${allTokens.length - defaultTokens.length} from API)`);
    return allTokens;
  } catch (error) {
    console.error('Error fetching token list:', error);
    // Fallback to default tokens
    return defaultTokens;
  }
}

/**
 * Get token info by address
 */
export async function getTokenInfo(address: string): Promise<TokenInfo | null> {
  const tokens = await fetchSolanaTokens();
  return tokens.find(token => token.address === address) || null;
}

/**
 * Validates if a string is a valid Solana public key
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch (e) {
    return false;
  }
}