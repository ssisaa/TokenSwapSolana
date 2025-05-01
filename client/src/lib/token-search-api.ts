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
import { SwapProvider } from './multi-hub-swap';

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

// Raydium-specific tokens
const raydiumTokens: TokenInfo[] = [
  // Include default SOL token
  defaultTokens[0],
  // Include YOT token
  defaultTokens[1],
  // Include YOS token
  defaultTokens[2],
  // Add Raydium-specific tokens
  {
    address: 'DK5hLNKKF9kFXZ6ZjnaaQWiwLZ5j6hVNgfxTD19GxhzL',
    symbol: 'RAY',
    name: 'Raydium',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    decimals: 6,
    tags: ['raydium', 'dex']
  },
  {
    address: '8UJgxaiQx5nTrdUaen4qYH5L2Li55KzRn9LbNPSfvr1Z',
    symbol: 'mSOL',
    name: 'Marinade staked SOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
    decimals: 9,
    tags: ['staking']
  },
  {
    address: 'AqhA8GFjKXGsNzNGP6E3jDmXJE8SZas2ZVtuKVxrMEf4',
    symbol: 'SAMO',
    name: 'Samoyedcoin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/logo.png',
    decimals: 9,
    tags: ['meme']
  },
  {
    address: 'CK2gdXem6UxTg6XijLF2FrzcfAHt6Age7Y9NR2zTtvRX',
    symbol: 'ORCA',
    name: 'Orca',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
    decimals: 6,
    tags: ['dex']
  },
  // Add requested test tokens for Raydium pools
  {
    address: 'XMP9SXVv3Kj6JcnJEyLaQzYEuWEGsHjhJNpkha2Vk5M',
    symbol: 'XMP',
    name: 'Xample Token',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    decimals: 9,
    tags: ['raydium', 'test']
  },
  {
    address: 'XAR18RSUr4pRGnmmM5Zz9vAz3EXmvWPx7cMuFB8mvCh',
    symbol: 'XAR',
    name: 'Xar Finance',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    decimals: 9,
    tags: ['raydium', 'test']
  }
];

// Jupiter-specific tokens
const jupiterTokens: TokenInfo[] = [
  // Include default SOL token
  defaultTokens[0],
  // Include YOT token
  defaultTokens[1],
  // Include YOS token
  defaultTokens[2],
  // Add Jupiter-specific tokens
  {
    address: 'BZ2yxTpJnmrRxpj7JFtMLWs7vQGGpZniKYCDLWQMapUq',
    symbol: 'JUP',
    name: 'Jupiter',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png',
    decimals: 6,
    tags: ['dex', 'aggregator']
  },
  {
    address: 'AZsHEMXd32h5gAyrZLxLHMjYWrYh8DjpVH1HYFWtNxS3',
    symbol: 'BONK',
    name: 'Bonk',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
    decimals: 5,
    tags: ['meme']
  },
  {
    address: 'D3Fv6nnQXe2VK7hzrMFBuYs6mQNkCZ9RSRBnJMSPMK2x',
    symbol: 'PYTH',
    name: 'Pyth Network',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png',
    decimals: 6,
    tags: ['oracle']
  },
  {
    address: '7wgZS8KSZAemVztjNpUC2W4R7cZ9MuKmQd7Drp1crDVp',
    symbol: 'RENDER',
    name: 'Render Token',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/render8AKPfDw6zrqQBjgwgMvBwAqvdXDcKgqqdYa/logo.png',
    decimals: 6,
    tags: ['utility']
  },
  // Add requested test tokens for Jupiter pools
  {
    address: 'RAMXd3mgY5XFyWbfgNh9LT7BcuW5w7jqRFgNkwZEhhsu',
    symbol: 'RAMX',
    name: 'Ramses Exchange',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    decimals: 9,
    tags: ['jupiter', 'test']
  },
  {
    address: 'TRXXpN1Y4tAYcfp3QxCKLeVDvUnjGWQvA2HTQ5VTytA',
    symbol: 'TRAXX',
    name: 'Traxx Protocol',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    decimals: 9,
    tags: ['jupiter', 'test']
  }
];

// YOT Contract-specific tokens - keep it simple with just our core tokens
const contractTokens: TokenInfo[] = [
  // Include default SOL token
  defaultTokens[0],
  // Include YOT token
  defaultTokens[1],
  // Include YOS token
  defaultTokens[2],
  // Add a few other test tokens
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
 * @param provider Optional provider to filter tokens by
 */
export async function fetchSolanaTokens(provider?: SwapProvider): Promise<TokenInfo[]> {
  // If a provider is specified, return provider-specific tokens
  if (provider !== undefined) {
    switch (provider) {
      case SwapProvider.Raydium:
        console.log('Fetching Raydium-specific tokens');
        return raydiumTokens;
      case SwapProvider.Jupiter:
        console.log('Fetching Jupiter-specific tokens');
        return jupiterTokens;
      case SwapProvider.Contract:
        console.log('Fetching YOT Contract-specific tokens');
        return contractTokens;
      default:
        // Fall through to the default token fetching logic
        break;
    }
  }
  
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