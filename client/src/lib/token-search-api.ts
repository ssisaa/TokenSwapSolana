import { Connection, PublicKey } from '@solana/web3.js';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, SOL_TOKEN_ADDRESS, YOT_DECIMALS, YOS_DECIMALS, SOL_DECIMALS } from './constants';

const connection = new Connection(ENDPOINT);

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

// Default tokens to include in the list
const defaultTokens: TokenMetadata[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: SOL_TOKEN_ADDRESS,
    decimals: SOL_DECIMALS,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    tags: ['native']
  },
  {
    symbol: 'YOT',
    name: 'YieldOrToken',
    address: YOT_TOKEN_ADDRESS,
    decimals: YOT_DECIMALS,
    tags: ['project']
  },
  {
    symbol: 'YOS',
    name: 'YieldOrStake',
    address: YOS_TOKEN_ADDRESS,
    decimals: YOS_DECIMALS,
    tags: ['project']
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    address: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U', // Devnet USDC address
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    tags: ['stablecoin']
  }
];

/**
 * Search for tokens by name, symbol, or address
 * @param query Search query (empty for popular tokens)
 * @returns Array of matching tokens
 */
export async function searchTokens(query: string): Promise<TokenMetadata[]> {
  // For now, return the default tokens or filter by query if provided
  if (!query) {
    return defaultTokens;
  }

  const lowercaseQuery = query.toLowerCase();
  return defaultTokens.filter(token => 
    token.symbol.toLowerCase().includes(lowercaseQuery) || 
    token.name.toLowerCase().includes(lowercaseQuery) ||
    token.address.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Validate token address by checking if it's a valid SPL token
 * @param addressString Token address to validate
 * @returns Token metadata or null if invalid
 */
export async function validateTokenAddress(addressString: string): Promise<TokenMetadata | null> {
  try {
    // First check if it's one of our known tokens
    const knownToken = defaultTokens.find(t => t.address === addressString);
    if (knownToken) {
      return knownToken;
    }
    
    // Try to parse as a PublicKey
    const publicKey = new PublicKey(addressString);
    
    // Check if this is an actual valid token account
    const tokenInfo = await connection.getTokenSupply(publicKey);
    
    if (tokenInfo) {
      return {
        symbol: 'Unknown',
        name: `Token ${addressString.slice(0, 4)}...${addressString.slice(-4)}`,
        address: addressString,
        decimals: tokenInfo.value.decimals,
        tags: ['custom']
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
  // Check if it's one of our known tokens
  const knownToken = defaultTokens.find(t => t.address === address);
  if (knownToken) {
    return knownToken;
  }
  
  // Otherwise try to validate it
  return await validateTokenAddress(address);
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
  // For demo, we'll generate reasonable-looking estimates
  const price = fromToken.symbol === 'SOL' ? 25 : 
                fromToken.symbol === 'USDC' ? 0.04 :
                fromToken.symbol === 'YOT' ? 0.1 : 1.0;
                
  const outputAmount = amount * price;
  const slippage = 0.005; // 0.5%
  
  // Determine route based on token pair
  const route = [];
  if (fromToken.symbol !== 'SOL' && toToken.symbol !== 'SOL') {
    route.push(fromToken.symbol, 'SOL', toToken.symbol);
  } else {
    route.push(fromToken.symbol, toToken.symbol);
  }
  
  return {
    inputAmount: amount,
    outputAmount,
    price,
    priceImpact: 0.2, // 0.2%
    minimumReceived: outputAmount * (1 - slippage),
    route,
    provider: 'Raydium'
  };
}