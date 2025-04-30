import { Connection, Transaction } from '@solana/web3.js';

/**
 * Universal helper function to send transactions across different wallet adapters
 * Works with multiple Solana wallets including Phantom, Solflare, Metamask, and others
 * 
 * @param wallet The wallet adapter (Phantom, Solflare, etc.)
 * @param transaction The transaction to send
 * @param connection The Solana connection
 * @returns Transaction signature
 */
export async function sendTransactionWithWallet(
  wallet: any, 
  transaction: Transaction, 
  connection: Connection
): Promise<string> {
  console.log("Sending transaction with universal wallet adapter");
  
  if (!wallet) {
    throw new Error("Wallet is not connected");
  }
  
  if (!wallet.publicKey) {
    throw new Error("Wallet public key is not available");
  }
  
  // Make sure the transaction has the wallet's public key as the fee payer
  transaction.feePayer = wallet.publicKey;
  
  // First try the standard sendTransaction method (works with Phantom)
  if (typeof wallet.sendTransaction === 'function') {
    try {
      console.log("Using standard sendTransaction method");
      const signature = await wallet.sendTransaction(transaction, connection);
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("Standard sendTransaction failed:", error.message);
      
      // If we get a specific error about the method, continue to fallbacks
      // Otherwise, rethrow the error
      if (!error.message.includes("is not a function")) {
        throw error;
      }
    }
  }
  
  // Fallback 1: Try signTransaction + send (works with some wallets including Solflare)
  if (typeof wallet.signTransaction === 'function') {
    try {
      console.log("Using signTransaction + send method");
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("signTransaction + send failed:", error.message);
      if (!error.message.includes("is not a function")) {
        throw error;
      }
    }
  }
  
  // Fallback 2: Try signAndSendTransaction (used by some wallets)
  if (typeof wallet.signAndSendTransaction === 'function') {
    try {
      console.log("Using signAndSendTransaction method");
      const { signature } = await wallet.signAndSendTransaction(transaction);
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("signAndSendTransaction failed:", error.message);
      throw error; // No more fallbacks, so throw the error
    }
  }
  
  // Fallback 3: For Metamask and EVM wallets that might be connected to Solana
  if (typeof wallet.sendTransaction !== 'function' && 
      typeof wallet.request === 'function' && 
      typeof wallet.request === 'function') {
    try {
      console.log("Using EVM wallet method (Metamask)");
      // Serialize the transaction to base64
      const serializedTransaction = transaction.serialize().toString('base64');
      
      // Send via wallet.request() method (Metamask style)
      const signature = await wallet.request({
        method: 'signAndSendTransaction',
        params: {
          message: serializedTransaction,
        },
      });
      
      console.log("Transaction sent successfully with signature:", signature);
      return signature;
    } catch (error: any) {
      console.warn("EVM wallet method failed:", error.message);
      throw error;
    }
  }
  
  throw new Error("No compatible transaction sending method found on wallet. Please try a different wallet.");
}