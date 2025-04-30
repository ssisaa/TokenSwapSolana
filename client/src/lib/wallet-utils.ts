import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ENDPOINT } from './constants';

// Cache token balances to avoid excessive RPC calls
const tokenBalanceCache: Record<string, { 
  balance: number, 
  timestamp: number 
}> = {};

const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Finds all token accounts owned by the wallet
 * @param walletAddress Wallet public key
 * @returns Map of token mint addresses to token balances
 */
export async function getWalletTokenAccounts(walletAddress: string): Promise<Map<string, number>> {
  try {
    const connection = new Connection(ENDPOINT);
    const walletPublicKey = new PublicKey(walletAddress);
    
    // Get all token accounts owned by this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey, 
      { programId: TOKEN_PROGRAM_ID }
    );
    
    // Create a map of token mint addresses to token balances
    const tokenBalances = new Map<string, number>();
    
    for (const { account } of tokenAccounts.value) {
      const parsedInfo = account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const balance = parsedInfo.tokenAmount.uiAmount;
      
      // Only include tokens with non-zero balance
      if (balance > 0) {
        tokenBalances.set(mintAddress, balance);
      }
    }
    
    return tokenBalances;
  } catch (error) {
    console.error('Error fetching token accounts:', error);
    return new Map();
  }
}

/**
 * Gets the SOL balance for a wallet
 * @param walletAddress Wallet public key
 * @returns SOL balance in SOL units (not lamports)
 */
export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    // Check cache first
    const cacheKey = `sol:${walletAddress}`;
    const now = Date.now();
    const cached = tokenBalanceCache[cacheKey];
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.balance;
    }
    
    // Fetch from blockchain
    const connection = new Connection(ENDPOINT);
    const walletPublicKey = new PublicKey(walletAddress);
    
    const lamports = await connection.getBalance(walletPublicKey);
    const solBalance = lamports / LAMPORTS_PER_SOL;
    
    // Update cache
    tokenBalanceCache[cacheKey] = {
      balance: solBalance,
      timestamp: now
    };
    
    return solBalance;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
}

/**
 * Gets the balance of a specific token
 * @param walletAddress Wallet public key
 * @param tokenMintAddress Token mint address
 * @returns Token balance
 */
export async function getTokenBalance(walletAddress: string, tokenMintAddress: string): Promise<number> {
  try {
    // Special case for SOL
    if (tokenMintAddress === 'So11111111111111111111111111111111111111112') {
      return getSolBalance(walletAddress);
    }
    
    // Check cache first
    const cacheKey = `${tokenMintAddress}:${walletAddress}`;
    const now = Date.now();
    const cached = tokenBalanceCache[cacheKey];
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.balance;
    }
    
    // Get all token accounts
    const tokenBalances = await getWalletTokenAccounts(walletAddress);
    const balance = tokenBalances.get(tokenMintAddress) || 0;
    
    // Update cache
    tokenBalanceCache[cacheKey] = {
      balance,
      timestamp: now
    };
    
    return balance;
  } catch (error) {
    console.error(`Error fetching balance for token ${tokenMintAddress}:`, error);
    return 0;
  }
}

/**
 * Format a token balance for display
 * @param balance Token balance
 * @returns Formatted balance string
 */
export function formatTokenBalance(balance: number | null | undefined): string {
  if (balance === null || balance === undefined) return '0.00';
  
  if (balance === 0) return '0.00';
  if (balance < 0.001) return '<0.001';
  if (balance < 1) return balance.toFixed(4);
  if (balance < 10000) return balance.toFixed(2);
  
  return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
}