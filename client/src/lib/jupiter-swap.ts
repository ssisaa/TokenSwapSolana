/**
 * Jupiter Swap Integration
 * Provides utilities for multi-hop swaps via Jupiter
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';

// Constants
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap-instructions';

// The Raydium router contract address
const RAYDIUM_ROUTER_ADDRESS = 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU';

// Common token addresses
export const TOKEN_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U',
  YOT: '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF',
  YOS: 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n'
};

/**
 * Interface representing a swap route returned by Jupiter API
 */
export interface JupiterRoute {
  inAmount: string;
  outAmount: string;
  amount: string;
  otherAmountThreshold: string;
  swapMode: string;
  priceImpactPct: number;
  marketInfos: any[];
  routePlan: {
    swapInfo: {
      amountIn: number;
      amountOut: number;
      inputMint: string;
      outputMint: string;
      sourceLabel?: string;
      sourceProgramId?: string;
      quoteMint?: string;
    };
  }[];
}

/**
 * Get a quote for a token swap from Jupiter
 * 
 * @param inputMint Source token mint address
 * @param outputMint Destination token mint address
 * @param amount Amount in the smallest unit (lamports/raw amount)
 * @param slippageBps Slippage in basis points (1 = 0.01%)
 * @returns Quote data from Jupiter
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50 // Default 0.5% slippage
): Promise<JupiterRoute | null> {
  try {
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    
    console.log(`Fetching Jupiter quote for ${inputMint} -> ${outputMint}`);
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Jupiter quote error:', data);
      return null;
    }
    
    return data.data as JupiterRoute;
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    return null;
  }
}

/**
 * Get swap instructions for a specific Jupiter quote
 * 
 * @param quoteResponse The quote response from Jupiter
 * @param userPublicKey User's wallet public key as string
 * @returns Transaction instructions from Jupiter
 */
export async function getJupiterSwapInstructions(
  quoteResponse: JupiterRoute,
  userPublicKey: string
): Promise<{ setup: any[], swap: any[], cleanup: any[] } | null> {
  try {
    const response = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Jupiter swap instructions error:', data);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching Jupiter swap instructions:', error);
    return null;
  }
}

/**
 * Create a transaction for a multi-hop swap via Jupiter
 * 
 * @param wallet User's wallet
 * @param fromToken Source token info
 * @param toToken Destination token info
 * @param amount Amount in UI units (e.g. 1.5 SOL)
 * @param slippage Slippage as a decimal (e.g. 0.01 for 1%)
 * @returns Swap transaction if successful, null otherwise
 */
export async function createJupiterSwapTransaction(
  wallet: any,
  fromToken: any,
  toToken: any,
  amount: number,
  slippage: number = 0.005
): Promise<Transaction | null> {
  try {
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Convert UI amount to raw amount
    const amountRaw = Math.floor(amount * Math.pow(10, fromToken.decimals)).toString();
    
    // Convert slippage to basis points (1% = 100 basis points)
    const slippageBps = Math.floor(slippage * 10000);
    
    // Get quote from Jupiter
    const quote = await getJupiterQuote(
      fromToken.address,
      toToken.address,
      amountRaw,
      slippageBps
    );
    
    if (!quote) {
      console.error('Failed to get Jupiter quote');
      return null;
    }
    
    // Calculate expected output
    const expectedOutput = parseFloat(quote.outAmount) / Math.pow(10, toToken.decimals);
    console.log(`Expected output: ${expectedOutput} ${toToken.symbol}`);
    
    // Get swap instructions
    const instructions = await getJupiterSwapInstructions(
      quote,
      wallet.publicKey.toString()
    );
    
    if (!instructions) {
      console.error('Failed to get Jupiter swap instructions');
      return null;
    }
    
    // Create transaction from instructions
    const connection = new Connection('https://api.devnet.solana.com');
    const transaction = new Transaction();
    
    // Add all instructions
    [...instructions.setup, ...instructions.swap, ...instructions.cleanup].forEach(ix => {
      // Convert instruction to TransactionInstruction
      const keys = ix.keys.map((key: any) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable
      }));
      
      transaction.add({
        keys,
        programId: new PublicKey(ix.programId),
        data: Buffer.from(ix.data, 'base64')
      });
    });
    
    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    return transaction;
  } catch (error) {
    console.error('Error creating Jupiter swap transaction:', error);
    return null;
  }
}

/**
 * Execute a multi-hop swap via Jupiter
 * 
 * @param wallet User's wallet
 * @param fromToken Source token info
 * @param toToken Destination token info
 * @param amount Amount in UI units (e.g. 1.5 SOL)
 * @param slippage Slippage as a decimal (e.g. 0.01 for 1%)
 * @returns Result of the swap with transaction signature
 */
export async function executeJupiterSwap(
  wallet: any,
  fromToken: any,
  toToken: any,
  amount: number,
  slippage: number = 0.005
): Promise<any> {
  try {
    const transaction = await createJupiterSwapTransaction(
      wallet,
      fromToken,
      toToken,
      amount,
      slippage
    );
    
    if (!transaction) {
      throw new Error('Failed to create Jupiter swap transaction');
    }
    
    // Sign and send the transaction
    const connection = new Connection('https://api.devnet.solana.com');
    console.log('Sending Jupiter swap transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Jupiter swap transaction sent with signature:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    // Calculate expected output (rough estimate)
    const amountRaw = Math.floor(amount * Math.pow(10, fromToken.decimals)).toString();
    const quote = await getJupiterQuote(
      fromToken.address,
      toToken.address,
      amountRaw,
      Math.floor(slippage * 10000)
    );
    
    const expectedOutput = quote ? parseFloat(quote.outAmount) / Math.pow(10, toToken.decimals) : 0;
    
    return {
      signature,
      success: true,
      fromAmount: amount,
      fromToken: fromToken.symbol,
      toAmount: expectedOutput,
      toToken: toToken.symbol,
      route: quote?.routePlan || []
    };
  } catch (error) {
    console.error('Jupiter swap failed:', error);
    
    // More descriptive error messages
    if (error.message && error.message.includes('insufficient funds')) {
      throw new Error('Insufficient funds to complete the transaction');
    } else if (error.message && error.message.includes('already in use')) {
      throw new Error('Transaction nonce already used. Please try again.');
    } else if (error.message && error.message.includes('blockhash')) {
      throw new Error('Blockhash expired. Please try again.');
    } else {
      throw new Error(`Swap failed: ${error.message || 'Unexpected wallet error'}`);
    }
  }
}

/**
 * Check if a direct path exists between two tokens in Jupiter
 * 
 * @param fromToken Source token info
 * @param toToken Destination token info
 * @returns True if a direct path exists, false otherwise
 */
export async function hasDirectJupiterPath(
  fromToken: any,
  toToken: any
): Promise<boolean> {
  try {
    // Use a very small amount for the quote to minimize API load
    const testAmount = '1000'; // 0.001 units for most tokens with 6 decimals
    
    const quote = await getJupiterQuote(
      fromToken.address,
      toToken.address,
      testAmount
    );
    
    return !!quote;
  } catch (error) {
    console.error('Error checking Jupiter route:', error);
    return false;
  }
}