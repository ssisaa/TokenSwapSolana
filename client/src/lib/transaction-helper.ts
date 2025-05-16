import { Connection, Transaction } from '@solana/web3.js';

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