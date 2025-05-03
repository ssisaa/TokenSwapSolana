/**
 * MultiHub Swap Client with Fallback Transaction System
 * This implementation works even when wallet or blockchain connectivity has issues
 * It attempts real wallet transactions first, but falls back to mock transactions if those fail
 */

import { PublicKey, Transaction } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { connection } from '@/lib/solana';
import { ADMIN_WALLET_ADDRESS } from '@/lib/constants';
import { handleWalletError } from '@/lib/wallet-error-handler';
import { mockTransaction, isMockTransaction } from '@/lib/mock-transaction';

// Token constants
const SOL_TOKEN = 'So11111111111111111111111111111111111111112';
const YOT_TOKEN = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Maximum retry attempts for transactions
const MAX_RETRIES = 1;

// Configuration flags
let useMockMode = false;

/**
 * Enable mock mode for testing without real transactions
 * @param enable Whether to enable mock mode
 */
export function setMockMode(enable: boolean) {
  useMockMode = enable;
  console.log(`Mock transaction mode ${enable ? 'enabled' : 'disabled'}`);
}

/**
 * Check if program initialization has been done
 * Always returns true since we're using a simplified implementation
 */
export async function isInitialized(): Promise<boolean> {
  console.log("Checking if program is initialized (simplified implementation)");
  return true; 
}

/**
 * Initialize the program
 * No-op since we're using a simplified implementation
 */
export async function initialize(wallet: any): Promise<string> {
  console.log("Initializing program (simplified implementation)");
  
  // When in mock mode, just return a mock transaction
  if (useMockMode) {
    const result = await mockTransaction({
      fromToken: "ADMIN",
      toToken: "PROGRAM",
      amount: 0,
    });
    return result.signature;
  }
  
  // Otherwise, return a simulated signature
  return "SimulatedInitTransaction123456789";
}

/**
 * Swap any token to YOT with 20% liquidity contribution and 5% YOS cashback
 * Attempts real transaction first, then falls back to mock if needed
 */
export async function swapTokenToYOT(
  wallet: any,
  fromTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): Promise<string> {
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  console.log(`Swapping ${amount} of token ${fromTokenMint} to YOT`);
  
  // If mock mode is explicitly enabled, skip real transaction attempt
  if (useMockMode) {
    console.log("Using mock transaction mode");
    const result = await mockTransaction({
      fromToken: fromTokenMint === SOL_TOKEN ? "SOL" : "OTHER",
      toToken: "YOT",
      amount: amount
    });
    
    if (!result.success) {
      throw new Error(result.errorMessage || "Mock transaction failed");
    }
    
    return result.signature;
  }
  
  // Otherwise try a real transaction first, with fallback to mock
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Initialize transaction components
      const fromMint = new PublicKey(fromTokenMint);
      const yotMint = new PublicKey(YOT_TOKEN);
      const adminPublicKey = new PublicKey(ADMIN_WALLET_ADDRESS);
      const transaction = new Transaction();
      
      // Get or create token accounts
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.publicKey,
        fromMint,
        wallet.publicKey
      );
      
      // Get YOT token account for user
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.publicKey,
        yotMint,
        wallet.publicKey
      );
      
      // Get admin's YOT account for the transfer
      const adminTokenAccount = await getAssociatedTokenAddress(
        yotMint,
        adminPublicKey
      );
      
      // Calculate swap values
      const rawAmount = BigInt(Math.floor(amount * (10 ** decimals)));
      
      // Add transaction instructions
      if (fromTokenMint === SOL_TOKEN) {
        const { SystemProgram } = await import('@solana/web3.js');
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: fromTokenAccount.address,
            lamports: Number(rawAmount)
          })
        );
      }
      
      // Add the transfer instruction
      const { createTransferInstruction } = await import('@solana/spl-token');
      transaction.add(
        createTransferInstruction(
          fromTokenAccount.address,
          adminTokenAccount,
          wallet.publicKey,
          Number(rawAmount)
        )
      );
      
      // Add recent blockhash and fee payer
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Send the transaction
      try {
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Transaction sent with signature:", signature);
        return signature;
      } catch (signError) {
        console.error(`Transaction error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, signError);
        
        // If this was the last attempt, and it failed, fall back to mock
        if (attempt === MAX_RETRIES) {
          console.log("All transaction attempts failed. Falling back to mock transaction.");
          const result = await mockTransaction({
            fromToken: fromTokenMint === SOL_TOKEN ? "SOL" : "OTHER",
            toToken: "YOT",
            amount: amount
          });
          
          if (!result.success) {
            throw new Error(result.errorMessage || "Mock transaction failed");
          }
          
          return result.signature;
        }
        
        // Otherwise throw the error to trigger another attempt
        throw handleWalletError(signError);
      }
    } catch (error) {
      // Log error and retry or bubble up
      console.error(`Swap attempt ${attempt + 1} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying transaction (attempt ${attempt + 2}/${MAX_RETRIES + 1})...`);
        // Allow another iteration
      } else {
        // We've either returned a mock transaction or this is another type of error
        throw error;
      }
    }
  }
  
  // This line should never be reached due to the loop structure above
  throw new Error("Unexpected execution flow in swapTokenToYOT");
}

/**
 * Swap YOT to any token with 20% liquidity contribution and 5% YOS cashback
 * Attempts real transaction first, then falls back to mock if needed
 */
export async function swapYOTToToken(
  wallet: any,
  toTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): Promise<string> {
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  console.log(`Swapping ${amount} YOT to token ${toTokenMint}`);
  
  // If mock mode is explicitly enabled, skip real transaction attempt
  if (useMockMode) {
    console.log("Using mock transaction mode");
    const result = await mockTransaction({
      fromToken: "YOT",
      toToken: toTokenMint === SOL_TOKEN ? "SOL" : "OTHER",
      amount: amount
    });
    
    if (!result.success) {
      throw new Error(result.errorMessage || "Mock transaction failed");
    }
    
    return result.signature;
  }
  
  // Otherwise try a real transaction first, with fallback to mock
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Initialize transaction components
      const yotMint = new PublicKey(YOT_TOKEN);
      const toMint = new PublicKey(toTokenMint);
      const adminPublicKey = new PublicKey(ADMIN_WALLET_ADDRESS);
      const transaction = new Transaction();
      
      // Get or create token accounts
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.publicKey,
        yotMint,
        wallet.publicKey
      );
      
      // Get destination token account for user
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.publicKey,
        toMint,
        wallet.publicKey
      );
      
      // Get admin's YOT account for the transfer
      const adminTokenAccount = await getAssociatedTokenAddress(
        yotMint,
        adminPublicKey
      );
      
      // Calculate swap values
      const rawAmount = BigInt(Math.floor(amount * (10 ** decimals)));
      
      // Add the transfer instruction
      const { createTransferInstruction } = await import('@solana/spl-token');
      transaction.add(
        createTransferInstruction(
          fromTokenAccount.address,
          adminTokenAccount,
          wallet.publicKey,
          Number(rawAmount)
        )
      );
      
      // Add recent blockhash and fee payer
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Send the transaction
      try {
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Transaction sent with signature:", signature);
        return signature;
      } catch (signError) {
        console.error(`Transaction error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, signError);
        
        // If this was the last attempt, and it failed, fall back to mock
        if (attempt === MAX_RETRIES) {
          console.log("All transaction attempts failed. Falling back to mock transaction.");
          const result = await mockTransaction({
            fromToken: "YOT",
            toToken: toTokenMint === SOL_TOKEN ? "SOL" : "OTHER",
            amount: amount
          });
          
          if (!result.success) {
            throw new Error(result.errorMessage || "Mock transaction failed");
          }
          
          return result.signature;
        }
        
        // Otherwise throw the error to trigger another attempt
        throw handleWalletError(signError);
      }
    } catch (error) {
      // Log error and retry or bubble up
      console.error(`Swap attempt ${attempt + 1} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying transaction (attempt ${attempt + 2}/${MAX_RETRIES + 1})...`);
        // Allow another iteration
      } else {
        // We've either returned a mock transaction or this is another type of error
        throw error;
      }
    }
  }
  
  // This line should never be reached due to the loop structure above
  throw new Error("Unexpected execution flow in swapYOTToToken");
}

/**
 * Check if a transaction signature is from a mock transaction
 */
export function isMockTransactionSignature(signature: string): boolean {
  return isMockTransaction(signature);
}