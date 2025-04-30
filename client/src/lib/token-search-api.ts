import { Connection, PublicKey } from '@solana/web3.js';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, SOL_TOKEN_ADDRESS, YOT_SYMBOL, YOS_SYMBOL, SOL_SYMBOL } from './constants';

const connection = new Connection(ENDPOINT);

// Default tokens to show even when search is empty
const defaultTokens = [
  {
    symbol: SOL_SYMBOL,
    name: 'Solana',
    address: SOL_TOKEN_ADDRESS,
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  {
    symbol: YOT_SYMBOL,
    name: 'YOT Token',
    address: YOT_TOKEN_ADDRESS,
    decimals: 9,
    logoURI: 'https://via.placeholder.com/50/f4900c/ffffff?text=YOT'
  },
  {
    symbol: YOS_SYMBOL,
    name: 'YOS Token',
    address: YOS_TOKEN_ADDRESS,
    decimals: 9,
    logoURI: 'https://via.placeholder.com/50/0cf49b/ffffff?text=YOS'
  },
  // Add more popular/default tokens here
];

/**
 * Token metadata interface
 */
export interface TokenMetadata {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

/**
 * Swap estimate interface
 */
export interface SwapEstimate {
  inputAmount: number;
  outputAmount: number;
  price: number;
  priceImpact: number;
  minimumReceived: number;
  route: string[];
  provider: string;
}

/**
 * Search for tokens by name, symbol, or address
 * @param query Search query (empty for popular tokens)
 * @returns Array of matching tokens
 */
export async function searchTokens(query: string): Promise<TokenMetadata[]> {
  try {
    if (!query || query.trim() === '') {
      return defaultTokens;
    }

    const lowerQuery = query.toLowerCase();
    
    // First check if the query matches any of our default tokens
    const defaultMatches = defaultTokens.filter(token => 
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery) ||
      token.address.toLowerCase().includes(lowerQuery)
    );
    
    // If we have a match in default tokens, return it immediately
    if (defaultMatches.length > 0) {
      return defaultMatches;
    }
    
    // Check if the query is a valid Solana address and try to resolve it
    if (query.length >= 32 && query.length <= 44) {
      try {
        const validatedToken = await validateTokenAddress(query);
        if (validatedToken) {
          return [validatedToken];
        }
      } catch (error) {
        // Not a valid token address, continue with regular search
      }
    }
    
    // For a production app, we would integrate with a token list API
    // For now, just return default tokens that match the query
    return defaultMatches;
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

/**
 * Validate token address by checking if it's a valid SPL token
 * @param addressString Token address to validate
 * @returns Token metadata or null if invalid
 */
export async function validateTokenAddress(addressString: string): Promise<TokenMetadata | null> {
  try {
    // Check if it's one of our known tokens
    const knownToken = defaultTokens.find(token => token.address === addressString);
    if (knownToken) {
      return knownToken;
    }
    
    // Try to validate it as a real SPL token on Solana
    const address = new PublicKey(addressString);
    const tokenInfo = await connection.getTokenSupply(address);
    
    if (tokenInfo) {
      // Token exists! Create a placeholder metadata
      return {
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        address: addressString,
        decimals: tokenInfo.value.decimals,
        logoURI: 'https://via.placeholder.com/50/cccccc/ffffff?text=?'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error validating token address:', error);
    return null;
  }
}

/**
 * Get token by address
 * @param address Token address
 * @returns Token metadata or null if not found
 */
export async function getTokenByAddress(address: string): Promise<TokenMetadata | null> {
  try {
    // First check default tokens
    const defaultToken = defaultTokens.find(token => token.address === address);
    if (defaultToken) {
      return defaultToken;
    }
    
    // If not in default list, try to validate it
    return await validateTokenAddress(address);
  } catch (error) {
    console.error('Error getting token by address:', error);
    return null;
  }
}

/**
 * Get swap estimate between tokens
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @returns Swap estimate
 */
export async function getSwapEstimate(
  fromToken: TokenMetadata,
  toToken: TokenMetadata,
  amount: number
): Promise<SwapEstimate> {
  // For now, return simulated data with realistic values
  // In a real implementation, this would call the appropriate DEX API
  const basePrice = fromToken.symbol === SOL_SYMBOL ? 148.50 : 
                  fromToken.symbol === YOT_SYMBOL ? 0.12 : 0.03;
  
  const targetPrice = toToken.symbol === SOL_SYMBOL ? 148.50 : 
                    toToken.symbol === YOT_SYMBOL ? 0.12 : 0.03;
  
  const exchangeRate = targetPrice / basePrice;
  const outputAmount = amount * exchangeRate * 0.995; // 0.5% fee
  
  return {
    inputAmount: amount,
    outputAmount,
    price: exchangeRate,
    priceImpact: 0.5, // 0.5% impact
    minimumReceived: outputAmount * 0.99, // 1% slippage
    route: [fromToken.symbol, toToken.symbol],
    provider: 'Raydium'
  };
}