/**
 * Token search API utility with common token definitions
 */

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  icon?: string;
}

// Default token list for the application
export const defaultTokens: TokenInfo[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    icon: "🌟"
  },
  {
    address: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
    symbol: "YOT",
    name: "YOT Token",
    decimals: 9,
    icon: "🪙"
  },
  {
    address: "GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n",
    symbol: "YOS",
    name: "YOS Token",
    decimals: 9,
    icon: "🌱"
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "💵"
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "USDT",
    decimals: 6,
    icon: "💰"
  }
];

/**
 * Get a token by its symbol
 * @param symbol Token symbol to look up
 * @returns TokenInfo object if found, undefined otherwise
 */
export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return defaultTokens.find(token => token.symbol === symbol);
}

/**
 * Get a token by its address
 * @param address Token address to look up
 * @returns TokenInfo object if found, undefined otherwise
 */
export function getTokenByAddress(address: string): TokenInfo | undefined {
  return defaultTokens.find(token => token.address === address);
}