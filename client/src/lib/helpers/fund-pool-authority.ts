import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ENDPOINT, POOL_AUTHORITY } from '../constants';
import { poolAuthorityKeypair } from '../completeSwap';

const connection = new Connection(ENDPOINT, 'confirmed');

// Function to check pool authority SOL balance
export async function checkPoolAuthorityBalance(): Promise<number> {
  try {
    const poolAuthorityPubkey = new PublicKey(POOL_AUTHORITY);
    const balance = await connection.getBalance(poolAuthorityPubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`Pool authority SOL balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Error checking pool authority balance:', error);
    throw error;
  }
}

// Function to fund pool authority with SOL (using airdrop for devnet)
export async function fundPoolAuthorityWithAirdrop(amount: number = 1): Promise<string> {
  try {
    const poolAuthorityPubkey = new PublicKey(POOL_AUTHORITY);
    
    console.log(`Requesting airdrop of ${amount} SOL to pool authority...`);
    
    // Request airdrop (only works on devnet)
    const signature = await connection.requestAirdrop(
      poolAuthorityPubkey,
      amount * LAMPORTS_PER_SOL
    );
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`Airdrop successful! Transaction: ${signature}`);
    
    // Check new balance
    const newBalance = await checkPoolAuthorityBalance();
    console.log(`Pool authority now has ${newBalance} SOL`);
    
    return signature;
  } catch (error) {
    console.error('Error funding pool authority with airdrop:', error);
    throw error;
  }
}

// Alternative: Fund pool authority from another account (for production)
export async function fundPoolAuthorityFromAccount(
  sourceWallet: any,
  amount: number
): Promise<string> {
  try {
    if (!sourceWallet.publicKey) {
      throw new Error('Source wallet not connected');
    }
    
    const poolAuthorityPubkey = new PublicKey(POOL_AUTHORITY);
    
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Create transaction to transfer SOL
    const transaction = new Transaction({
      feePayer: sourceWallet.publicKey,
      blockhash,
      lastValidBlockHeight
    });
    
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: sourceWallet.publicKey,
        toPubkey: poolAuthorityPubkey,
        lamports: amount * LAMPORTS_PER_SOL
      })
    );
    
    // Send transaction using wallet
    const signature = await sourceWallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    console.log(`Pool authority funded with ${amount} SOL from wallet. Transaction: ${signature}`);
    
    // Check new balance
    const newBalance = await checkPoolAuthorityBalance();
    console.log(`Pool authority now has ${newBalance} SOL`);
    
    return signature;
  } catch (error) {
    console.error('Error funding pool authority from wallet:', error);
    throw error;
  }
}