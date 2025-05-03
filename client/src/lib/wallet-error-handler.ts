/**
 * Wallet Error Handler
 * 
 * This module provides utility functions to handle and categorize wallet-related errors
 * to provide more meaningful error messages to users
 */

/**
 * Handle wallet transaction errors with user-friendly messages
 * @param error The error caught from wallet transaction operations
 * @returns A user-friendly error object with appropriate message
 */
export function handleWalletError(error: any): Error {
  const errorMessage = String(error);
  
  // Rejection errors
  if (errorMessage.includes("User rejected the request")) {
    console.log("User rejected the transaction request in their wallet");
    return new Error("User rejected the transaction in the wallet. Please approve the transaction to complete the swap.");
  }
  
  // Connection errors
  if (errorMessage.includes("Unexpected error") || 
      errorMessage.includes("wallet adapter error") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("Connection")) {
    console.log("Wallet connection error detected:", errorMessage);
    return new Error("Wallet connection error. Please disconnect and reconnect your wallet, then try again.");
  }
  
  // Insufficient funds errors
  if (errorMessage.includes("insufficient") || 
      errorMessage.includes("Insufficient") || 
      errorMessage.includes("enough") || 
      errorMessage.includes("balance")) {
    console.log("Insufficient funds error detected:", errorMessage);
    return new Error("Insufficient funds in your wallet for this transaction. Please check your balance.");
  }
  
  // Program initialization errors
  if (errorMessage.includes("program") && errorMessage.includes("initialize")) {
    console.log("Program initialization error detected:", errorMessage);
    return new Error("The program needs to be initialized first. Please initialize the program before performing swaps.");
  }
  
  // Network/RPC errors
  if (errorMessage.includes("network") || 
      errorMessage.includes("timeout") || 
      errorMessage.includes("rate limit")) {
    console.log("Network error detected:", errorMessage);
    return new Error("Network error. The Solana network might be congested. Please try again later.");
  }
  
  // Default fallback
  console.error("Unhandled wallet error:", errorMessage);
  return new Error("Failed to send transaction: " + errorMessage);
}