import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { ENDPOINT } from './constants';

const connection = new Connection(ENDPOINT, 'confirmed');

export async function sendTransaction(wallet: any, transaction: Transaction, confirmation: string = 'confirmed'): Promise<string> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    // Add a recent blockhash
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Request signing from the wallet adapter
    const signedTransaction = await wallet.signTransaction(transaction);

    // Send the signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    // Confirm transaction
    await connection.confirmTransaction(signature, confirmation);

    return signature;
  } catch (error) {
    console.error("Error sending transaction:", error);
    throw error;
  }
}