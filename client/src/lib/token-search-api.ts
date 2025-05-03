/**
 * Token Search API
 * 
 * Provides standardized token information and search capabilities
 */

import { SOL_TOKEN_MINT, YOT_TOKEN_MINT, YOS_TOKEN_MINT } from './multihub-client';

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
  tags?: string[];
}

// Common token list with well-known Solana tokens
const COMMON_TOKENS: TokenInfo[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: SOL_TOKEN_MINT,
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    coingeckoId: 'solana',
    tags: ['native']
  },
  {
    symbol: 'YOT',
    name: 'Yot Token',
    address: YOT_TOKEN_MINT,
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/yot-currency/token-assets/main/yot-logo.png',
    tags: ['yot-ecosystem']
  },
  {
    symbol: 'YOS',
    name: 'Yos Token',
    address: YOS_TOKEN_MINT,
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/yot-currency/token-assets/main/yos-logo.png',
    tags: ['yot-ecosystem']
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '9T7uw5dqaEmEC4McqyefzYsZauvtSP3z3iMrZsrMW8n',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin',
    tags: ['stablecoin']
  },
  {
    symbol: 'XAR',
    name: 'Example AR Token',
    address: '9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa',
    decimals: 9,
    tags: ['test']
  },
  {
    symbol: 'XMP',
    name: 'Example MP Token',
    address: 'HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs',
    decimals: 9,
    tags: ['test']
  },
];

// Export the common tokens list for use in components
export const defaultTokens = COMMON_TOKENS;

/**
 * Search for tokens by name, symbol, or address
 */
export async function searchTokens(query: string): Promise<TokenInfo[]> {
  if (!query) return COMMON_TOKENS;
  
  const lowerQuery = query.toLowerCase();
  
  return COMMON_TOKENS.filter((token) => {
    return (
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery) ||
      token.address.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get token by address
 */
export async function getTokenByAddress(address: string): Promise<TokenInfo | null> {
  const token = COMMON_TOKENS.find(t => t.address === address);
  return token || null;
}

/**
 * Get token by symbol
 */
export async function getTokenBySymbol(symbol: string): Promise<TokenInfo | null> {
  const token = COMMON_TOKENS.find(t => t.symbol === symbol);
  return token || null;
}

/**
 * Get token info by either address or symbol
 */
export async function getTokenInfo(identifierOrToken: string | TokenInfo): Promise<TokenInfo | null> {
  if (typeof identifierOrToken !== 'string') {
    return identifierOrToken; // It's already a TokenInfo
  }
  
  // Check if it looks like an address (long string)
  if (identifierOrToken.length > 30) {
    return getTokenByAddress(identifierOrToken);
  }
  
  // Otherwise treat as symbol
  return getTokenBySymbol(identifierOrToken);
}

export default {
  searchTokens,
  getTokenByAddress,
  getTokenBySymbol,
  getTokenInfo,
  COMMON_TOKENS
};