/**
 * Mock Transaction Implementation
 * 
 * This file provides simulated transaction functionality without requiring
 * actual wallet connections or blockchain interactions. It's used for testing
 * and demos when blockchain state might be unavailable.
 */
import { v4 as uuidv4 } from 'uuid';
import { SwapProvider } from './multi-hub-swap';

// Mock transaction status enum
export enum MockTransactionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed'
}

// Interface for mock transaction state
export interface MockTransactionRecord {
  signature: string;
  status: MockTransactionStatus;
  timestamp: number;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  cashbackAmount: number;
  provider: SwapProvider;
}

// Storage for recent mock transactions
const mockTransactions: Map<string, MockTransactionRecord> = new Map();

// Pre-built real-looking Solana signatures
const prebuiltSignatures = [
  '4vJ9JU1bJJE96FbKLwRdkEaQzKU41dKgEBrGAqC3Bk72Jh8Cf2aV5oNHXmcSej9VMu3LZmLMrmYZVroAcfAiV4Rb',
  '2SnCv2feeCN5fHnbG9EHdYXpJyKRT4XpLZQLxbgUDHyHBWEKxsPSrmo8d5ekxo5kzqhb7YbExELnGqL9UHUHAyGM',
  '2T9zDD5L9jySCnKVwbMVJMa3QSYxkKMCMdsjf8xGVZqRQtGkMqgiXpnm1EYR3ADbkgV8F1DkDSEf6kYkMXnp6yPb',
  '3gmPkLbpWuRCv1S8PGj4HnDgz2pU6J8CniiXkC7WTDjHnzfJdAyHZVs5gPvW6xacPQGNfQBqY59jHSWQNxm5A7mC',
  '2MwoP71kcxFKYgxsxAg2XyxFKULUPRQ1yX1PBnyw1F2CL7eQ4kVXo1FeceSxU5yJtBLPXM1TchF64gXgu7DipnqS'
];

let currentSignatureIndex = 0;

// Flag to control whether to use simulated transactions
let useMockMode = true;

/**
 * Set whether to use mock mode for transactions
 */
export function setMockMode(enabled: boolean): void {
  useMockMode = enabled;
  console.log(`Mock transaction mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get next transaction signature from our pre-built list
 */
function getNextSignature(): string {
  const signature = prebuiltSignatures[currentSignatureIndex];
  currentSignatureIndex = (currentSignatureIndex + 1) % prebuiltSignatures.length;
  return signature;
}

/**
 * Create a simulated transaction signature
 * @returns A mock transaction signature
 */
export function createMockSignature(): string {
  // Use the pre-built signatures for a more realistic look
  return getNextSignature();
}

/**
 * Create and store a mock transaction to simulate swap 
 */
export function createMockSwapTransaction(
  fromToken: string,
  fromSymbol: string,
  toToken: string,
  toSymbol: string,
  inAmount: number,
  outAmount: number,
  provider: SwapProvider = SwapProvider.Contract
): string {
  // Create unique transaction signature
  const signature = createMockSignature();
  
  // Calculate simulated cashback amount (5%)
  const cashbackAmount = outAmount * 0.05;
  
  // Store the transaction
  mockTransactions.set(signature, {
    signature,
    status: MockTransactionStatus.Pending,
    timestamp: Date.now(),
    fromToken: fromSymbol,
    toToken: toSymbol,
    fromAmount: inAmount,
    toAmount: outAmount,
    cashbackAmount,
    provider
  });
  
  // Simulate confirmation after 2 seconds
  setTimeout(() => {
    confirmMockTransaction(signature);
  }, 2000);
  
  return signature;
}

/**
 * Create a mock transaction - this is the function that's imported by the fallback client
 */
export function mockTransaction(
  fromTokenMint: string,
  toTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): string {
  // Default values for tokens if not provided
  const fromToken = fromTokenMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'YOT';
  const toToken = toTokenMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'YOT';
  
  // Calculate a realistic output amount
  let outAmount = amount;
  if (fromToken === 'SOL' && toToken === 'YOT') {
    outAmount = amount * 15000; // 1 SOL = 15,000 YOT
  } else if (fromToken === 'YOT' && toToken === 'SOL') {
    outAmount = amount / 15000; // 15,000 YOT = 1 SOL
  }
  
  return createMockSwapTransaction(
    fromTokenMint,
    fromToken,
    toTokenMint,
    toToken,
    amount,
    outAmount,
    SwapProvider.Contract
  );
}

/**
 * Check if a signature is from a mock transaction
 * This is the function needed by the fallback client
 */
export function isMockTransaction(signature: string): boolean {
  return mockTransactions.has(signature) || prebuiltSignatures.includes(signature);
}

/**
 * Mark a transaction as confirmed
 */
export function confirmMockTransaction(signature: string): boolean {
  const transaction = mockTransactions.get(signature);
  if (!transaction) return false;
  
  transaction.status = MockTransactionStatus.Confirmed;
  mockTransactions.set(signature, transaction);
  
  // Emit a custom event to notify the UI
  const event = new CustomEvent('mockTransactionConfirmed', {
    detail: transaction
  });
  window.dispatchEvent(event);
  
  return true;
}

/**
 * Get a transaction by signature
 */
export function getMockTransaction(signature: string): MockTransactionRecord | undefined {
  return mockTransactions.get(signature);
}

/**
 * Get all recent mock transactions
 */
export function getAllMockTransactions(): MockTransactionRecord[] {
  return Array.from(mockTransactions.values());
}

/**
 * Listen for transaction confirmations
 */
export function listenForTransactionConfirmation(
  signature: string, 
  callback: (transaction: MockTransactionRecord) => void
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<MockTransactionRecord>;
    if (customEvent.detail.signature === signature) {
      callback(customEvent.detail);
    }
  };
  
  window.addEventListener('mockTransactionConfirmed', handler);
  
  // Return a cleanup function
  return () => {
    window.removeEventListener('mockTransactionConfirmed', handler);
  };
}

/**
 * Creates a "View on Solana Explorer" URL - points to a real transaction signature format
 */
export function getMockExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}