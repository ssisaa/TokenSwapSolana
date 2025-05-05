import { Connection, Transaction, PublicKey, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';

/**
 * Enhanced transaction verification and error handling.
 * 
 * This module provides a set of utilities for transaction creation, sending and verification
 * that work reliably across different Solana wallets with proper error detection and handling.
 */

/**
 * Creates a properly initialized transaction to avoid the numRequiredSignatures error
 * 
 * @param wallet The wallet to use for signing
 * @param instructions Instructions to include in the transaction
 * @param connection Solana connection to use for blockhash
 * @param additionalSigners Optional additional signers
 * @returns A ready-to-sign transaction
 */
export async function createTransaction(
  wallet: { publicKey: PublicKey },
  instructions: TransactionInstruction[],
  connection: Connection,
  additionalSigners: Array<any> = []
): Promise<Transaction> {
  // Create a new transaction
  const transaction = new Transaction();
  
  // Add compute budget instruction first (if needed)
  // This helps prevent "out of compute budget" errors on complex transactions
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ 
    units: 400000  // Higher than default 200k units to handle complex operations
  });
  transaction.add(computeBudgetIx);
  
  // Add all provided instructions
  instructions.forEach(instruction => {
    transaction.add(instruction);
  });
  
  // Get a recent blockhash and set transaction properties in the correct order
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
  // Set these properties in this specific order to avoid errors
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = wallet.publicKey;
  
  return transaction;
}

/**
 * Verify if a transaction has succeeded on-chain
 * 
 * @param signature The transaction signature to verify
 * @param connection The Solana connection
 * @returns True if transaction succeeded, false otherwise
 */
export async function verifyTransaction(
  signature: string,
  connection: Connection
): Promise<boolean> {
  try {
    // First check with confirmTransaction to see if transaction succeeded
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error("Transaction failed during confirmation:", confirmation.value.err);
      return false;
    }
    
    // Double-check by getting the transaction details
    const txInfo = await connection.getTransaction(signature, {commitment: 'confirmed'});
    
    // Check if transaction exists and doesn't have errors
    if (!txInfo || !txInfo.meta || txInfo.meta.err) {
      const errorDetails = txInfo?.meta?.err ? JSON.stringify(txInfo.meta.err) : "Unknown failure";
      console.error("Transaction verification failed:", errorDetails);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return false;
  }
}

/**
 * Simulate a transaction before sending to detect errors
 * 
 * @param transaction The transaction to simulate
 * @param connection The Solana connection
 * @throws Error if simulation fails
 */
export async function simulateTransaction(
  transaction: Transaction,
  connection: Connection
): Promise<void> {
  try {
    // Simulate the transaction before sending
    console.log("Simulating transaction to detect potential errors...");
    const simulation = await connection.simulateTransaction(transaction);
    
    // Check for errors in the simulation
    if (simulation.value.err) {
      console.error("Transaction simulation failed:", simulation.value.err);
      console.error("Simulation logs:", simulation.value.logs?.join('\n'));
      throw new Error(`Transaction would fail on-chain: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Log success
    console.log("Transaction simulation successful");
  } catch (error) {
    console.error("Error during transaction simulation:", error);
    throw new Error(`Transaction simulation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Universal wallet adapter to ensure compatibility with multiple wallet types
 * (Phantom, Solflare, Metamask, etc.)
 * 
 * This function tries different transaction sending methods in a fallback pattern
 * to ensure maximum compatibility with various wallet types.
 */
export async function sendTransaction(
  wallet: any,
  transaction: Transaction,
  connection: Connection
): Promise<string> {
  console.log("Multi-wallet transaction handler initialized");
  
  if (!wallet) {
    throw new Error("Wallet is not connected");
  }
  
  if (!wallet.publicKey) {
    throw new Error("Wallet public key is not available");
  }
  
  // Make sure transaction has the wallet's public key as fee payer
  transaction.feePayer = wallet.publicKey;
  
  // Method 1: Use wallet.sendTransaction (Phantom's primary method)
  if (typeof wallet.sendTransaction === 'function') {
    try {
      console.log("Trying wallet.sendTransaction method");
      const signature = await wallet.sendTransaction(transaction, connection);
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("wallet.sendTransaction failed:", error.message);
      if (!error.message.includes("is not a function")) {
        throw error;
      }
      // Continue to fallback methods if it's a "not a function" error
    }
  }
  
  // Method 2: Use wallet.signTransaction + connection.sendRawTransaction
  // (Works with Solflare and some other wallets)
  if (typeof wallet.signTransaction === 'function') {
    try {
      console.log("Trying signTransaction + sendRawTransaction method");
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("signTransaction + sendRawTransaction failed:", error.message);
      if (!error.message.includes("is not a function")) {
        throw error;
      }
      // Continue to fallback methods if it's a "not a function" error
    }
  }
  
  // Method 3: Use wallet.signAndSendTransaction (used by some wallets)
  if (typeof wallet.signAndSendTransaction === 'function') {
    try {
      console.log("Trying signAndSendTransaction method");
      const { signature } = await wallet.signAndSendTransaction(transaction);
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("signAndSendTransaction failed:", error.message);
      throw error; // No more fallbacks, throw the error
    }
  }
  
  // If we got here, no method worked
  throw new Error(
    "No compatible transaction method found for this wallet. " +
    "Please try a different wallet like Phantom or Solflare."
  );
}