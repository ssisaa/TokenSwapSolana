/**
 * Transaction Testing Utilities
 * Diagnostic tools to test wallet transaction signing capabilities
 */

import { Connection, Transaction, PublicKey, SystemProgram } from '@solana/web3.js';

// Devnet endpoint
const ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Test if the wallet can sign and send a simple SOL transfer transaction
 * This is a diagnostic function to test wallet compatibility
 * 
 * @param wallet The wallet to test
 * @returns Result of the test transaction
 */
export async function testWalletTransaction(wallet: any): Promise<{ success: boolean; message: string; signature?: string }> {
  try {
    if (!wallet?.publicKey) {
      return { success: false, message: 'Wallet not connected' };
    }

    console.log('Testing wallet transaction signing capability...');
    console.log('Wallet public key:', wallet.publicKey.toString());

    // Create a connection to Solana
    const connection = new Connection(ENDPOINT, 'confirmed');

    // Create a simple transaction that transfers a tiny amount of SOL to self
    const transaction = new Transaction();
    
    // Add a transfer instruction to send 0.000001 SOL to self
    // This is a minimal transaction that should always work if wallet is functioning
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,  // Send to self
        lamports: 1, // Smallest possible amount (1 lamport = 0.000000001 SOL)
      })
    );

    // Get a recent blockhash
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    console.log('Sending test transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Test transaction sent with signature:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Test transaction confirmed successfully');

    return {
      success: true,
      message: 'Wallet can sign and send transactions successfully',
      signature
    };
  } catch (error) {
    console.error('Wallet transaction test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      message: `Wallet transaction test failed: ${errorMessage}`
    };
  }
}

/**
 * Create a simple SOL transfer transaction
 * 
 * @param wallet The wallet to use
 * @param destination Destination address for SOL
 * @param amount Amount of SOL to send
 * @returns The transaction
 */
export async function createSimpleTransferTransaction(
  wallet: any,
  destination: string,
  amount: number // In SOL
): Promise<Transaction> {
  if (!wallet?.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Create a connection to Solana
  const connection = new Connection(ENDPOINT, 'confirmed');
  
  // Create transaction
  const transaction = new Transaction();
  
  // Add transfer instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: new PublicKey(destination),
      lamports: Math.floor(amount * 1_000_000_000), // Convert SOL to lamports
    })
  );
  
  // Get a recent blockhash
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = wallet.publicKey;
  
  return transaction;
}

/**
 * Execute a simple SOL transfer transaction
 * 
 * @param wallet The wallet to use
 * @param destination Destination address for SOL
 * @param amount Amount of SOL to send
 * @returns Transaction result
 */
export async function executeSimpleTransfer(
  wallet: any,
  destination: string,
  amount: number // In SOL
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // Create a connection to Solana
    const connection = new Connection(ENDPOINT, 'confirmed');
    
    // Create the transaction
    const transaction = await createSimpleTransferTransaction(wallet, destination, amount);
    
    // Sign and send transaction
    console.log(`Sending ${amount} SOL to ${destination}...`);
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Transaction sent with signature:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed successfully');
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error('Transfer failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      error: errorMessage
    };
  }
}