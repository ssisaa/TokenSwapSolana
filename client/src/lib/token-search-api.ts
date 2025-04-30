import { TokenMetadata } from './multi-hub-swap';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, SOL_TOKEN_ADDRESS, YOT_SYMBOL, YOS_SYMBOL, SOL_SYMBOL } from './constants';

// Default token list for the application
export const defaultTokens: TokenMetadata[] = [
  {
    address: SOL_TOKEN_ADDRESS,
    symbol: SOL_SYMBOL,
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024'
  },
  {
    address: YOT_TOKEN_ADDRESS,
    symbol: YOT_SYMBOL,
    name: 'YieldOptimizationToken',
    decimals: 9,
    logoURI: 'https://via.placeholder.com/50/4F46E5/FFFFFF?text=YOT'
  },
  {
    address: YOS_TOKEN_ADDRESS,
    symbol: YOS_SYMBOL,
    name: 'YieldOptimizationShard',
    decimals: 9,
    logoURI: 'https://via.placeholder.com/50/EA580C/FFFFFF?text=YOS'
  },
  // These are example tokens for development
  {
    address: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U',
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    decimals: 6,
    logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=024'
  },
  {
    address: 'EbgWXRY4N5SZYrELtrrQzPpGUT4bz3UYpCDJTNdVdYuj',
    symbol: 'BTC',
    name: 'Bitcoin (Devnet)',
    decimals: 8,
    logoURI: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=024'
  },
  {
    address: 'EnYAyJ2AQxXfcmfeMjvQQiNMrTn7jGEcFYxVc8FvpRt4',
    symbol: 'ETH',
    name: 'Ethereum (Devnet)',
    decimals: 18,
    logoURI: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=024'
  }
];

/**
 * Search for tokens by symbol or address
 * @param query Search query string
 * @param excludeAddresses Addresses to exclude from results
 * @returns Array of matching tokens
 */
export function searchTokens(query: string, excludeAddresses: string[] = []): TokenMetadata[] {
  if (!query) {
    return defaultTokens.filter(token => !excludeAddresses.includes(token.address));
  }
  
  const lowerQuery = query.toLowerCase();
  
  return defaultTokens.filter(token => {
    // Skip excluded addresses
    if (excludeAddresses.includes(token.address)) {
      return false;
    }
    
    // Match by symbol or address
    return (
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery) ||
      token.address.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get token by address
 * @param address Token address
 * @returns Token metadata if found, undefined otherwise
 */
export function getTokenByAddress(address: string): TokenMetadata | undefined {
  return defaultTokens.find(token => token.address === address);
}

/**
 * Get token by symbol
 * @param symbol Token symbol
 * @returns Token metadata if found, undefined otherwise
 */
export function getTokenBySymbol(symbol: string): TokenMetadata | undefined {
  return defaultTokens.find(token => token.symbol === symbol);
}