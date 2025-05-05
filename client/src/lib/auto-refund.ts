/**
 * Automatic Refund System for Failed Transactions
 * 
 * This module provides functionality to automatically refund SOL
 * when transactions fail, ensuring users never lose funds.
 */

import { Connection, Transaction, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { connectionManager } from './connection-manager';
import { toast } from '@/hooks/use-toast';

/**
 * Tracks SOL balances before and after a transaction
 * and automatically refunds if the transaction fails
 */
export async function executeWithAutoRefund(
  connection: Connection,
  wallet: any,
  transaction: Transaction,
  description: string = "transaction"
): Promise<string> {
  // First check if all program IDs are valid
  for (const ix of transaction.instructions) {
    if (!ix.programId || ix.programId.toString() === '11111111111111111111111111111111') {
      // System program is fine
      continue;
    }
    
    // Verify this is a valid program ID
    if (ix.programId.toString().length < 32) {
      throw new Error(`Invalid program ID in transaction: ${ix.programId.toString()}`);
    }
  }
  
  // Check initial balance
  console.log(`Checking initial SOL balance before ${description}...`);
  const walletPublicKey = wallet.publicKey;
  const initialBalance = await connection.getBalance(walletPublicKey);
  console.log(`Initial balance: ${initialBalance / 1e9} SOL`);

  // Prepare transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  try {
    // Send the transaction
    console.log(`Sending ${description} transaction...`);
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log(`Transaction sent: ${signature}`);
    
    // Wait for confirmation
    const confirmResult = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    // Check if the transaction failed
    if (confirmResult?.value?.err) {
      console.error(`Transaction confirmed with error: ${JSON.stringify(confirmResult.value.err)}`);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmResult.value.err)}`);
    }
    
    console.log(`Transaction confirmed successfully: ${signature}`);
    
    // Check final balance for reporting
    const finalBalance = await connection.getBalance(walletPublicKey);
    const balanceChange = (initialBalance - finalBalance) / 1e9;
    console.log(`Transaction fee: ~${balanceChange.toFixed(6)} SOL`);
    
    return signature;
  } catch (error: any) {
    console.error(`Transaction failed:`, error);
    
    // Check if SOL was deducted
    console.log(`Checking if SOL was deducted...`);
    const currentBalance = await connection.getBalance(walletPublicKey);
    const change = initialBalance - currentBalance;
    
    if (change > 0) {
      console.warn(`SOL was deducted (${change / 1e9} SOL) but transaction failed. Processing refund...`);
      
      try {
        // Process a refund transaction to return SOL to the user
        await processRefund(connection, walletPublicKey, change);
        
        toast({
          title: "Transaction failed but SOL was refunded",
          description: `The ${description} failed, but ${change / 1e9} SOL was automatically refunded to your wallet.`,
          variant: "default"
        });
      } catch (refundError: any) {
        console.error(`Failed to refund SOL:`, refundError);
        
        toast({
          title: "Transaction failed",
          description: `The ${description} failed and we couldn't automatically refund your SOL: ${refundError.message}`,
          variant: "destructive"
        });
      }
    } else {
      console.log(`No SOL was deducted, no refund needed.`);
      
      toast({
        title: "Transaction failed",
        description: `The ${description} failed. Error: ${error.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
    
    // Rethrow the original error
    throw error;
  }
}

/**
 * Process a refund transaction to return SOL to the user
 * This is a separate function to avoid any issues with the main transaction
 */
async function processRefund(
  connection: Connection,
  walletPublicKey: PublicKey,
  amountToRefund: number
): Promise<string> {
  // Create a keypair to use for the refund
  const refundKeypair = connectionManager.getRefundKeypair();
  
  // Create a new transaction to refund the SOL
  const refundTransaction = new Transaction();
  refundTransaction.add(
    SystemProgram.transfer({
      fromPubkey: refundKeypair.publicKey,
      toPubkey: walletPublicKey,
      lamports: amountToRefund
    })
  );
  
  // Send and confirm the refund transaction
  const refundSignature = await connectionManager.sendAndConfirmTransaction(
    connection,
    refundTransaction,
    refundKeypair
  );
  
  console.log(`SOL refunded successfully: ${refundSignature}`);
  return refundSignature;
}

/**
 * Execute a transaction with simulation first, then use auto-refund
 * This is a more robust version that simulates first before execution
 */
export async function executeWithSimulationAndAutoRefund(
  connection: Connection,
  wallet: any,
  transaction: Transaction,
  description: string = "transaction"
): Promise<string> {
  // First simulate the transaction
  console.log(`Simulating ${description} transaction...`);
  try {
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      console.error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    console.log(`Simulation successful, proceeding with actual transaction`);
  } catch (simError: any) {
    console.error(`Error during transaction simulation: ${simError.message || simError}`);
    throw new Error(`Transaction simulation error: ${simError.message || simError}`);
  }
  
  // Now execute the transaction with auto-refund
  return executeWithAutoRefund(connection, wallet, transaction, description);
}