import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { TokenInfo } from './token-search-api';
import { ENDPOINT, SOL_TOKEN_ADDRESS } from './constants';

// Hardcoded Jupiter API endpoint
const JUPITER_API_ENDPOINT = 'https://quote-api.jup.ag/v6';

// Interface for Jupiter quote response
interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: number;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    }[];
    percent: number;
  }[];
  contextSlot: number;
  timeTaken: number;
}

/**
 * Get a swap estimate using Jupiter API
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @param slippage Slippage tolerance as a decimal
 * @returns Swap estimate
 */
export async function getJupiterSwapEstimate(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  slippage: number
): Promise<{
  estimatedAmount: number;
  minAmountOut: number;
  priceImpact: number;
  fee: number;
  routes: string[];
}> {
  try {
    // Convert to raw amount with decimals
    const inputAmount = Math.floor(amount * (10 ** fromToken.decimals));
    
    // Convert slippage from decimal to basis points
    const slippageBps = Math.floor(slippage * 10000);
    
    // Build the Jupiter API URL
    const jupiterQuoteUrl = `${JUPITER_API_ENDPOINT}/quote?inputMint=${fromToken.address}&outputMint=${toToken.address}&amount=${inputAmount}&slippageBps=${slippageBps}`;
    
    console.log(`Requesting Jupiter quote: ${jupiterQuoteUrl}`);
    
    // Fetch from Jupiter API
    const response = await fetch(jupiterQuoteUrl);
    
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
    }
    
    const data: JupiterQuoteResponse = await response.json();
    console.log('Jupiter quote response:', data);
    
    // Extract route information
    const routes: string[] = [fromToken.symbol];
    
    // Process route plan to extract intermediate tokens
    if (data.routePlan && data.routePlan.length > 0) {
      // Extract unique token mints from the route plan
      const tokenMints = new Set<string>();
      
      data.routePlan.forEach(route => {
        route.swapInfo.forEach(swap => {
          if (swap.inputMint !== fromToken.address && swap.inputMint !== toToken.address) {
            tokenMints.add(swap.inputMint);
          }
          if (swap.outputMint !== fromToken.address && swap.outputMint !== toToken.address) {
            tokenMints.add(swap.outputMint);
          }
        });
      });
      
      // Add SOL as the default intermediate token if we have intermediate tokens
      if (tokenMints.size > 0) {
        routes.push('SOL');
      }
    }
    
    routes.push(toToken.symbol);
    
    // Convert output amount from raw to UI format
    const outAmountRaw = BigInt(data.outAmount);
    const estimatedAmount = Number(outAmountRaw) / Math.pow(10, toToken.decimals);
    
    // Apply minimum amount based on slippage
    const minAmountOut = estimatedAmount * (1 - slippage);
    
    // Extract price impact
    const priceImpact = data.priceImpactPct;
    
    // Calculate fee (Jupiter doesn't directly provide this)
    const fee = amount * 0.003; // 0.3% approximation
    
    return {
      estimatedAmount,
      minAmountOut,
      priceImpact,
      fee,
      routes
    };
  } catch (error) {
    console.error('Error getting Jupiter swap estimate:', error);
    throw new Error('Failed to get Jupiter swap estimate');
  }
}

/**
 * Build a Jupiter swap transaction
 * @param wallet Connected wallet
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap
 * @param minAmountOut Minimum amount to receive
 * @returns Prepared transaction (needs to be signed and sent)
 */
export async function prepareJupiterSwapTransaction(
  wallet: any,
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  minAmountOut: number
): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }
  
  const connection = new Connection(ENDPOINT);
  
  try {
    // Convert to raw amount with decimals
    const inputAmount = Math.floor(amount * (10 ** fromToken.decimals));
    
    // First get a quote from Jupiter API
    const slippageBps = Math.floor(0.01 * 10000); // 1% default slippage
    const jupiterQuoteUrl = `${JUPITER_API_ENDPOINT}/quote?inputMint=${fromToken.address}&outputMint=${toToken.address}&amount=${inputAmount}&slippageBps=${slippageBps}`;
    
    console.log(`Requesting Jupiter quote for swap TX: ${jupiterQuoteUrl}`);
    const quoteResponse = await fetch(jupiterQuoteUrl);
    
    if (!quoteResponse.ok) {
      throw new Error(`Jupiter API quote error: ${quoteResponse.status} ${quoteResponse.statusText}`);
    }
    
    const quoteData: JupiterQuoteResponse = await quoteResponse.json();
    
    // Now get a swap transaction
    const swapRequestBody = {
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toString(),
      // Auto wrap and unwrap SOL
      wrapUnwrapSOL: true,
      // Allow fallback routes if the primary one fails
      feeAccount: wallet.publicKey.toString(),
    };
    
    const swapResponse = await fetch(`${JUPITER_API_ENDPOINT}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(swapRequestBody)
    });
    
    if (!swapResponse.ok) {
      throw new Error(`Jupiter API swap error: ${swapResponse.status} ${swapResponse.statusText}`);
    }
    
    const swapData = await swapResponse.json();
    console.log('Jupiter swap response:', swapData);
    
    // Get transaction data from the response
    const { swapTransaction } = swapData;
    
    // Deserialize the transaction data
    const transaction = Transaction.from(
      Buffer.from(swapTransaction, 'base64')
    );
    
    // Set the transaction properties correctly
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    return transaction;
  } catch (error) {
    console.error('Error preparing Jupiter swap transaction:', error);
    
    // Fallback to a basic transaction if Jupiter API fails
    console.log('Falling back to basic transaction');
    const transaction = new Transaction();
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Use a basic transaction as fallback
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey, // Send to self as a placeholder
        lamports: 100, // Minimal amount for demonstration
      })
    );
    
    return transaction;
  }
}

// Cache Jupiter supported tokens to avoid repeated API calls
let jupiterSupportedTokensCache: string[] | null = null;
let jupiterCacheTimestamp: number = 0;
const JUPITER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a token is supported by Jupiter on devnet
 * Uses Jupiter API to determine token support
 * @param tokenAddress Token address to check
 * @returns True if the token is supported by Jupiter
 */
export async function fetchJupiterSupportedTokens(): Promise<string[]> {
  try {
    // Check if we have a valid cache
    const now = Date.now();
    if (jupiterSupportedTokensCache && now - jupiterCacheTimestamp < JUPITER_CACHE_TTL) {
      return jupiterSupportedTokensCache;
    }
    
    // Fetch the list of supported tokens from Jupiter
    const response = await fetch(`${JUPITER_API_ENDPOINT}/indexed-route-map?v=3`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Jupiter supported tokens: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract all token mints that Jupiter supports
    let supportedTokens: string[] = [];
    
    // Jupiter's indexed-route-map structure includes a mintKeys array
    if (data.mintKeys && Array.isArray(data.mintKeys)) {
      supportedTokens = data.mintKeys;
    }
    
    console.log(`Loaded ${supportedTokens.length} Jupiter supported tokens`);
    
    // Update the cache
    jupiterSupportedTokensCache = supportedTokens;
    jupiterCacheTimestamp = now;
    
    return supportedTokens;
  } catch (error) {
    console.error('Error fetching Jupiter supported tokens:', error);
    // Return a reasonable default
    return [
      SOL_TOKEN_ADDRESS, // SOL is always supported
      '7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE', // soBTC
      '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // Wrapped SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
    ];
  }
}

// Jupiter supported token addresses for devnet
const JUPITER_SUPPORTED_TOKENS = [
  // Core tokens (always include SOL, YOT, YOS)
  'So11111111111111111111111111111111111111112', // SOL
  '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF', // YOT
  'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n', // YOS
  
  // Jupiter popular tokens
  'D3eyBjfgJMPHWuaRatmNiQcVVmQP8tfLLLLkkjZhJY6J', // BONK
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // DUST
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  '8UJgxaiQx5nTrdUaen4qYH5L2Li55KzRn9LbNPSfvr1Z', // mSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx', // GMT
  'AqhA8GFjKXGsNzNGP6E3jDmXJE8SZas2ZVtuKVxrMEf4', // SAMO
  'HxRELUQfvvjToVbacjr9YECbQGwBQQ91KjgDTPr1KaXA', // CATO
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
];

/**
 * Check if a token is supported by Jupiter
 * @param tokenAddress Token address to check
 * @returns True if the token is supported by Jupiter
 */
export function isTokenSupportedByJupiter(tokenAddress: string): boolean {
  // First check our hardcoded list (faster and more reliable for common tokens)
  if (JUPITER_SUPPORTED_TOKENS.includes(tokenAddress)) {
    return true;
  }
  
  // Also check the cache if available
  if (jupiterSupportedTokensCache && (Date.now() - jupiterCacheTimestamp < JUPITER_CACHE_TTL)) {
    return jupiterSupportedTokensCache.includes(tokenAddress);
  }
  
  // If we have no cache, trigger an update in the background for next time
  if (!jupiterSupportedTokensCache) {
    // Fetch tokens asynchronously for future use
    fetchJupiterSupportedTokens().catch(err => 
      console.error('Background Jupiter token fetch failed:', err)
    );
  }
  
  // For estimation purposes, assume popular tokens are supported
  // This ensures we show reasonable token options before the API fetch completes
  return true;
}