/**
 * MultiHub Client Safe - Entry point for selecting the best client implementation
 * 
 * This module tries to use the full client first, then falls back to the browser-compatible
 * version if there are crypto module issues, and finally to the fallback mock implementation
 * if network connectivity issues prevent real transactions.
 */

import { ADMIN_WALLET_ADDRESS } from '@/lib/constants';
import { PublicKey } from '@solana/web3.js';

// Import browser-safe implementation
import * as browserClient from './multihub-client-browser';
import * as fallbackClient from './multihub-client-fallback';

// Constants
export const MULTIHUB_PROGRAM_ID = 'Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L';
export const SOL_TOKEN = 'So11111111111111111111111111111111111111112';
export const YOT_TOKEN = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Use a flag to track if we should use mock mode
let useFallbackMode = false;

/**
 * Set whether to use fallback mock mode
 */
export function setFallbackMode(enabled: boolean): void {
  useFallbackMode = enabled;
  console.log(`Fallback mode ${enabled ? 'enabled' : 'disabled'}`);
  
  // Also set mock mode in the fallback client
  fallbackClient.setMockMode(enabled);
}

/**
 * Check if the MultiHub Swap Program is initialized
 */
export async function isMultiHubSwapProgramInitialized(): Promise<boolean> {
  if (useFallbackMode) {
    return fallbackClient.isInitialized();
  }
  
  try {
    return await browserClient.isMultiHubSwapProgramInitialized();
  } catch (error) {
    console.error("Browser client initialization check failed:", error);
    setFallbackMode(true);
    return fallbackClient.isInitialized();
  }
}

/**
 * Initialize the MultiHub Swap Program with default parameters
 */
export async function initializeMultiHubSwapProgram(wallet: any): Promise<string> {
  if (useFallbackMode) {
    return fallbackClient.initialize(wallet);
  }
  
  try {
    return await browserClient.initializeMultiHubSwapProgram(wallet);
  } catch (error) {
    console.error("Browser client initialization failed:", error);
    
    // Check if this is a crypto module error
    if (String(error).includes("Cannot access 'crypto'") || 
        String(error).includes("externalized for browser compatibility")) {
      console.log("Crypto module error detected, switching to fallback mode");
      setFallbackMode(true);
      return fallbackClient.initialize(wallet);
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Swap any token to YOT with 20% liquidity contribution and 5% YOS cashback
 */
export async function swapTokenToYOT(
  wallet: any,
  fromTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): Promise<string> {
  if (useFallbackMode) {
    return fallbackClient.swapTokenToYOT(
      wallet,
      fromTokenMint,
      amount,
      decimals,
      referrer
    );
  }
  
  try {
    return await browserClient.swapTokenToYOT(
      wallet,
      fromTokenMint,
      amount,
      decimals,
      referrer
    );
  } catch (error) {
    console.error("Browser client swap failed:", error);
    
    // Check if this is a crypto module error or connectivity error
    if (String(error).includes("Cannot access 'crypto'") || 
        String(error).includes("externalized for browser compatibility") ||
        String(error).includes("fetch failed") ||
        String(error).includes("Unexpected error")) {
      console.log("Browser error detected, switching to fallback mode");
      setFallbackMode(true);
      return fallbackClient.swapTokenToYOT(
        wallet,
        fromTokenMint,
        amount,
        decimals,
        referrer
      );
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Swap YOT to any token with 20% liquidity contribution and 5% YOS cashback
 */
export async function swapYOTToToken(
  wallet: any,
  toTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): Promise<string> {
  if (useFallbackMode) {
    return fallbackClient.swapYOTToToken(
      wallet,
      toTokenMint,
      amount,
      decimals,
      referrer
    );
  }
  
  try {
    return await browserClient.swapYOTToToken(
      wallet,
      toTokenMint,
      amount,
      decimals,
      referrer
    );
  } catch (error) {
    console.error("Browser client swap failed:", error);
    
    // Check if this is a crypto module error or connectivity error
    if (String(error).includes("Cannot access 'crypto'") || 
        String(error).includes("externalized for browser compatibility") ||
        String(error).includes("fetch failed") ||
        String(error).includes("Unexpected error")) {
      console.log("Browser error detected, switching to fallback mode");
      setFallbackMode(true);
      return fallbackClient.swapYOTToToken(
        wallet,
        toTokenMint,
        amount,
        decimals,
        referrer
      );
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Check if a transaction signature is from a mock transaction
 */
export function isMockTransactionSignature(signature: string): boolean {
  return fallbackClient.isMockTransactionSignature(signature);
}

/**
 * Initialize the MultiHub Swap Program (for admin use)
 * 
 * @param wallet The admin wallet
 * @returns Transaction signature
 */
export async function initializeProgram(wallet: any): Promise<string> {
  // This is an alias for initializeMultiHubSwapProgram for better naming consistency
  return initializeMultiHubSwapProgram(wallet);
}