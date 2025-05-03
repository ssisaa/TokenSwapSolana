/**
 * This module provides a mock transaction system for development and testing
 * when actual Solana blockchain transactions can't be processed due to wallet or network issues
 */

import { randomBytes } from 'crypto';

// Constants for the mock transaction system
const MOCK_TX_PREFIX = 'MOCK_TX_';
const MOCK_ERROR_RATE = 0; // Set to 0 to ensure successful mock transactions

// Mock token balances for simulation
const mockBalances = {
  SOL: 6.9898,
  YOT: 159627437.14554337,
  YOS: 437056995.7561587
};

/**
 * Simulates a blockchain transaction without actually sending one
 * Used when wallet/network issues prevent real transactions from working
 * 
 * @param options Configuration for the mock transaction
 * @returns A simulated transaction result with signature and success status
 */
export async function mockTransaction(options: {
  fromToken: string;
  toToken: string;
  amount: number;
  shouldFail?: boolean;
  failureReason?: string;
}): Promise<{ signature: string; success: boolean; errorMessage?: string }> {
  console.log(`[MOCK] Simulating transaction: ${options.amount} ${options.fromToken} -> ${options.toToken}`);
  
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Should this transaction fail? (based on parameter or random chance)
  const shouldFail = options.shouldFail || (Math.random() < MOCK_ERROR_RATE);
  
  if (shouldFail) {
    const failureReason = options.failureReason || "Transaction simulation failed";
    console.log(`[MOCK] Transaction failed: ${failureReason}`);
    return {
      signature: MOCK_TX_PREFIX + Date.now().toString(36),
      success: false,
      errorMessage: failureReason
    };
  }
  
  // Generate a random transaction signature
  const mockSignature = MOCK_TX_PREFIX + randomBytes(8).toString('hex');
  
  // Simulate transaction confirmation
  console.log(`[MOCK] Transaction successful with signature: ${mockSignature}`);
  
  // Update mock balances
  if (options.fromToken === 'SOL' && options.toToken === 'YOT') {
    mockBalances.SOL -= options.amount;
    mockBalances.YOT += options.amount * 0.8; // 80% after liquidity contribution
    mockBalances.YOS += options.amount * 0.05; // 5% cashback
  } else if (options.fromToken === 'YOT' && options.toToken === 'SOL') {
    mockBalances.YOT -= options.amount;
    mockBalances.SOL += options.amount * 0.8; // 80% after liquidity contribution
    mockBalances.YOS += options.amount * 0.05; // 5% cashback
  }
  
  console.log(`[MOCK] Updated balances:`, mockBalances);
  
  return {
    signature: mockSignature,
    success: true
  };
}

/**
 * Check if a signature represents a mock transaction
 * 
 * @param signature The transaction signature to check
 * @returns Boolean indicating whether this is a mock transaction
 */
export function isMockTransaction(signature: string): boolean {
  return typeof signature === 'string' && signature.startsWith(MOCK_TX_PREFIX);
}