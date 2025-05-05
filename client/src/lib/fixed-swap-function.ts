/**
 * Fixed version of the performSwap function that uses auto-refund protection.
 * This file will be imported in multihub-contract-v3.ts to replace the existing function.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { connectionManager } from './connection-manager';
// Import from multihub contract file
import { MULTIHUB_SWAP_PROGRAM_ID } from './multihub-contract-v3';

// Convert program ID to PublicKey for use in transaction instructions
const PROGRAM_ID_PUBKEY = new PublicKey(MULTIHUB_SWAP_PROGRAM_ID);

/**
 * Perform a token swap using the multihub swap V3 program
 * IMPROVED VERSION: Uses auto-refund functionality to automatically return SOL on failed transactions
 * 
 * @param connection Solana connection
 * @param wallet Connected wallet
 * @param tokenFromMint From token mint address
 * @param tokenToMint To token mint address
 * @param amountIn Amount to swap
 * @param minAmountOut Minimum amount to receive
 * @param transaction Optional pre-built transaction (if null, one will be created)
 */
export async function performSwapWithAutoRefund(
  connection: Connection,
  wallet: any,
  tokenFromMint: PublicKey,
  tokenToMint: PublicKey,
  amountIn: number | bigint,
  minAmountOut: number | bigint,
  transaction: Transaction,
  allAccountsSetup: boolean
): Promise<string> {
  try {
    // Use the hardcoded program ID
    console.log(`Using MultihubSwap Program ID: ${MULTIHUB_SWAP_PROGRAM_ID}`);
    
    // CRITICAL VALIDATION: Verify program ID is valid before proceeding
    if (!MULTIHUB_SWAP_PROGRAM_ID || typeof MULTIHUB_SWAP_PROGRAM_ID !== 'string' || MULTIHUB_SWAP_PROGRAM_ID.length < 32) {
      console.error(`Invalid program ID: ${MULTIHUB_SWAP_PROGRAM_ID}`);
      throw new Error(`Invalid program ID. This is likely a configuration error. Please refresh the page and try again.`);
    }
    
    // CRITICAL ENHANCEMENT: Verify all transaction instructions have valid program IDs
    for (const ix of transaction.instructions) {
      if (!ix.programId) {
        console.error("Transaction instruction has undefined program ID", ix);
        throw new Error("Transaction contains an instruction with an undefined program ID. This is likely a configuration error.");
      }
    }
    
    // CRITICAL IMPROVEMENT: Use the new automatic refund system
    // This will track balances and automatically refund SOL if the transaction fails
    console.log("Using automatic SOL refund protection for this transaction");
    
    // Use our new auto-refund system - this will handle simulation, execution, confirmation, and automatic refund
    const signature = await connectionManager.executeTransactionWithAutoRefund(
      wallet,
      transaction,
      'token swap',
      true // Simulate first to catch errors early
    );
    
    console.log('Swap transaction confirmed successfully:', signature);
    return signature;
  } catch (error: any) {
    console.error('Error in swap transaction with auto-refund:', error);
    
    // Provide a clear, user-friendly error message
    if (typeof error.message === 'string') {
      // Handle specific error types
      if (error.message.includes('Transaction simulation failed')) {
        throw new Error(`Swap simulation failed. This could be due to insufficient balance or invalid parameters.`);
      } else if (error.message.includes('User rejected')) {
        throw new Error('Transaction was rejected by the wallet.');
      } else if (error.message.includes('failed to send transaction') || 
                error.message.includes('connection error')) {
        throw new Error(`Network error: ${error.message}. Please try again.`);
      } else if (error.message.includes('undefined program id')) {
        throw new Error('Program ID is not properly loaded. Please refresh the page and try again.');
      }
    }
    
    // Generic error fallback with refund information
    throw new Error(`Swap failed: ${error.message || 'Unknown error'}. Any deducted SOL has been automatically refunded.`);
  }
}