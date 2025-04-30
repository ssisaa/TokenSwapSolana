import { Connection, Transaction } from '@solana/web3.js';
import { sendTransaction } from './transaction-helper';

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
  return sendTransaction(wallet, transaction, connection);
}