/**
 * MultihubSwap Transaction Recovery System
 * 
 * This module provides functions for tracking failed transactions and refunding users
 * when their swap transactions fail but their SOL/tokens have been deducted.
 * 
 * There are two main recovery scenarios:
 * 
 * 1. SOL → YOT: Transaction fails after SOL is deducted but before YOT is received
 *    Solution: Return SOL to the user's wallet
 * 
 * 2. YOT → SOL: Transaction fails after YOT is deducted but before SOL is received
 *    Solution: Return YOT to the user's token account
 */

import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { connectionManager } from './connection-manager';
import { config } from './config';
import { findProgramAuthorityAddress, findProgramStateAddress } from './multihub-contract-v3';

// Store failed transactions for recovery
interface FailedTransactionRecord {
  signature: string;
  wallet: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'refunded' | 'failed';
}

// Constants
const SOL_TOKEN_MINT = 'So11111111111111111111111111111111111111112';
const YOT_TOKEN_MINT = config.tokens.YOT;
// Use the accounts info from config if available, otherwise use findProgramAuthorityAddress for PDAs
const PROGRAM_AUTHORITY = config.accounts?.admin || "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ";
const POOL_AUTHORITY = config.accounts?.poolAuthority || "7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK";

/**
 * Record a failed transaction for later recovery
 * @param wallet User's wallet address
 * @param signature Transaction signature
 * @param tokenIn Input token mint address
 * @param tokenOut Output token mint address
 * @param amount Amount of input token
 */
export function recordFailedTransaction(
  wallet: PublicKey,
  signature: string,
  tokenIn: string,
  tokenOut: string,
  amount: number
): void {
  try {
    const walletAddress = wallet.toString();
    
    // Create the record
    const record: FailedTransactionRecord = {
      signature,
      wallet: walletAddress,
      tokenIn,
      tokenOut,
      amount,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    // Get existing records for this wallet
    const existingRecordsJson = localStorage.getItem(`failed_transactions_${walletAddress}`);
    const existingRecords: FailedTransactionRecord[] = existingRecordsJson 
      ? JSON.parse(existingRecordsJson) 
      : [];
    
    // Add new record if it doesn't exist
    if (!existingRecords.some(r => r.signature === signature)) {
      const updatedRecords = [...existingRecords, record];
      localStorage.setItem(`failed_transactions_${walletAddress}`, JSON.stringify(updatedRecords));
      console.log(`Recorded failed transaction ${signature} for recovery`);
    }
  } catch (error) {
    console.error('Error recording failed transaction:', error);
  }
}

/**
 * Utility: Convert SOL amount to lamports (1 SOL = 1,000,000,000 lamports)
 */
function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000));
}

/**
 * Utility: Convert token amount to raw amount with decimals
 * For YOT/YOS tokens with 9 decimals
 */
function tokenToRaw(amount: number): bigint {
  return BigInt(Math.floor(amount * 1_000_000_000));
}

/**
 * Refund SOL to user when a SOL→YOT swap fails
 * @param connection Solana connection
 * @param wallet User's wallet for signing
 * @param amount Amount of SOL to refund in SOL units (e.g., 0.1 for 0.1 SOL)
 * @returns Transaction signature
 */
async function refundSol(
  connection: Connection,
  wallet: any,
  amount: number
): Promise<string> {
  try {
    // Get the program authority PDA which holds the SOL
    const [programAuthorityAddress, _bump] = findProgramAuthorityAddress();
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    
    // Convert amount to lamports
    const lamports = solToLamports(amount);
    
    // Create transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Get blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // First try to use Program Authority as the source
    const programAuthSolBalance = await connectionManager.executeWithFallback(
      conn => conn.getBalance(programAuthorityAddress)
    );
    
    // Then try Pool Authority if Program Authority doesn't have enough
    const poolAuthSolBalance = await connectionManager.executeWithFallback(
      conn => conn.getBalance(poolAuthorityAddress)
    );
    
    // Determine which authority to use for refund
    let refundSource = programAuthorityAddress;
    
    // If Program Authority doesn't have enough SOL, use Pool Authority instead
    if (BigInt(programAuthSolBalance) < lamports) {
      if (BigInt(poolAuthSolBalance) >= lamports) {
        console.log(`Program Authority has insufficient balance (${programAuthSolBalance}). Using Pool Authority (${poolAuthSolBalance}) for refund`);
        refundSource = poolAuthorityAddress;
      } else {
        throw new Error(`Both Program Authority (${programAuthSolBalance}) and Pool Authority (${poolAuthSolBalance}) have insufficient SOL for refund`);
      }
    }
    
    // Create a system transfer instruction to return SOL to user
    // This requires admin privileges in the actual contract
    // Ideally, we would have a dedicated refund instruction in the program
    const transferIx = SystemProgram.transfer({
      fromPubkey: refundSource,
      toPubkey: wallet.publicKey,
      lamports: lamports
    });
    
    // Add instruction to transaction
    transaction.add(transferIx);
    
    // Send transaction
    console.log(`Refunding ${amount} SOL to ${wallet.publicKey.toString()}...`);
    const signature = await wallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Refund successful: ${signature}`);
    
    return signature;
  } catch (error) {
    console.error('Error refunding SOL:', error);
    throw new Error(`SOL refund failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Refund YOT to user when a YOT→SOL swap fails
 * @param connection Solana connection
 * @param wallet User's wallet for signing
 * @param amount Amount of YOT to refund in token units
 * @returns Transaction signature
 */
async function refundYot(
  connection: Connection,
  wallet: any,
  amount: number
): Promise<string> {
  try {
    // Get program PDAs
    const [programAuthorityAddress, _bump] = findProgramAuthorityAddress();
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    
    // Get the source token account (program's YOT account)
    const yotMint = new PublicKey(YOT_TOKEN_MINT);
    const programYotAta = await getAssociatedTokenAddress(
      yotMint,
      programAuthorityAddress,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Also try the pool authority's YOT account as fallback
    const poolYotAta = await getAssociatedTokenAddress(
      yotMint,
      poolAuthorityAddress,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Get the destination token account (user's YOT account)
    const userYotAta = await getAssociatedTokenAddress(
      yotMint,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Create transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Get blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Create a token transfer instruction to return YOT to user
    // Convert amount to raw amount
    const rawAmount = tokenToRaw(amount);
    
    // Check balances to determine which source to use
    const programBalance = await connectionManager.getTokenBalance(programYotAta);
    const poolBalance = await connectionManager.getTokenBalance(poolYotAta);
    
    let sourceAccount: PublicKey;
    
    // Determine which account to use based on available balance
    if (programBalance >= rawAmount) {
      sourceAccount = programYotAta;
      console.log(`Using Program Authority YOT account for refund (${programBalance} YOT available)`);
    } else if (poolBalance >= rawAmount) {
      sourceAccount = poolYotAta;
      console.log(`Using Pool Authority YOT account for refund (${poolBalance} YOT available)`);
    } else {
      throw new Error(`Insufficient YOT in both Program Authority (${programBalance}) and Pool Authority (${poolBalance}) for refund`);
    }
    
    // Create transfer instruction
    const transferIx = createTransferInstruction(
      sourceAccount, // source
      userYotAta, // destination
      programAuthorityAddress, // authority
      rawAmount, // amount
      [], // multisigners
      TOKEN_PROGRAM_ID
    );
    
    // Add instruction to transaction
    transaction.add(transferIx);
    
    // Send transaction
    console.log(`Refunding ${amount} YOT to ${wallet.publicKey.toString()}...`);
    const signature = await wallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Refund successful: ${signature}`);
    
    return signature;
  } catch (error) {
    console.error('Error refunding YOT:', error);
    throw new Error(`YOT refund failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main function to refund a failed swap
 * @param connection Solana connection
 * @param wallet User's wallet for signing
 * @param signature Original failed transaction signature
 * @param isSolToYot True if refunding SOL, false if refunding YOT
 * @param amount Amount to refund in token units
 * @returns Transaction signature
 */
export async function refundFailedSwap(
  connection: Connection,
  wallet: any,
  signature: string,
  isSolToYot: boolean,
  amount: number
): Promise<string> {
  try {
    // Refund SOL or YOT based on swap direction
    let refundSignature: string;
    
    if (isSolToYot) {
      // SOL→YOT swap failed, refund SOL
      refundSignature = await refundSol(connection, wallet, amount);
    } else {
      // YOT→SOL swap failed, refund YOT
      refundSignature = await refundYot(connection, wallet, amount);
    }
    
    // Update the failed transaction record
    updateFailedTransactionStatus(wallet.publicKey.toString(), signature, 'refunded');
    
    return refundSignature;
  } catch (error) {
    console.error('Error refunding failed swap:', error);
    
    // Update the transaction status to failed
    updateFailedTransactionStatus(wallet.publicKey.toString(), signature, 'failed');
    
    throw error;
  }
}

/**
 * Update the status of a failed transaction in localStorage
 */
function updateFailedTransactionStatus(
  walletAddress: string,
  signature: string,
  status: 'pending' | 'refunded' | 'failed'
): void {
  try {
    const recordsJson = localStorage.getItem(`failed_transactions_${walletAddress}`);
    if (recordsJson) {
      const records: FailedTransactionRecord[] = JSON.parse(recordsJson);
      const updatedRecords = records.map(record => 
        record.signature === signature 
          ? { ...record, status } 
          : record
      );
      
      localStorage.setItem(`failed_transactions_${walletAddress}`, JSON.stringify(updatedRecords));
    }
  } catch (error) {
    console.error('Error updating transaction status:', error);
  }
}

/**
 * Hook into the swap function to track potential failures
 * This should be called at the start of a swap operation
 */
export function trackSwapTransaction(
  wallet: PublicKey,
  tokenIn: string,
  tokenOut: string,
  amount: number
): () => void {
  // Create a unique ID for this transaction attempt
  const swapAttemptId = `swap_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Store the swap attempt with 'pending' status
  const pendingSwap = {
    wallet: wallet.toString(),
    tokenIn,
    tokenOut,
    amount,
    timestamp: Date.now(),
    id: swapAttemptId
  };
  
  // Store in session storage (temporary, lost on refresh/close)
  sessionStorage.setItem(`pending_swap_${swapAttemptId}`, JSON.stringify(pendingSwap));
  
  // Return a function to call when the swap completes or fails
  return () => {
    // Remove the pending swap record
    sessionStorage.removeItem(`pending_swap_${swapAttemptId}`);
  };
}

/**
 * Check for incomplete swaps when the application loads
 * This is a simple implementation - in a production environment,
 * you would query an API or scan the blockchain for unfinished transactions
 */
export function checkForIncompleteSwaps(): FailedTransactionRecord[] {
  const incompleteSwaps: FailedTransactionRecord[] = [];
  
  // In a real implementation, we would check the blockchain for unprocessed transactions
  // For this prototype, we just return an empty array
  
  return incompleteSwaps;
}

/**
 * Add transaction tracking to ConnectionManager
 * Extend with a method to get token balances
 */
connectionManager.getTokenBalance = async function(tokenAccount: PublicKey): Promise<bigint> {
  try {
    const { value } = await this.executeWithFallback(
      conn => conn.getTokenAccountBalance(tokenAccount)
    );
    
    return BigInt(value.amount);
  } catch (error) {
    console.error(`Error getting token balance for ${tokenAccount.toString()}:`, error);
    return BigInt(0);
  }
};