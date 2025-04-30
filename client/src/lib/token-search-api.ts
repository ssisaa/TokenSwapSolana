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
 * This can be extended to use the Solana token registry API in the future
 */
export async function fetchSolanaTokens(): Promise<TokenInfo[]> {
  // For now, just return our default tokens
  // In a production app, you would fetch from Solana token registry
  return defaultTokens;
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