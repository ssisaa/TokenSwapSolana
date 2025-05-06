/**
 * Simplified SOL to YOT swap implementation
 * This version focuses on core functionality with minimal complexity
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';

// Configuration
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);

/**
 * Find program state PDA
 */
function findProgramStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
}

/**
 * Find program authority PDA
 */
function findProgramAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
}

/**
 * Simple SOL to YOT swap 
 * This implementation focuses on just sending SOL to get YOT in return
 */
export async function simpleSwap(wallet: any, solAmount: number): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  if (!wallet || !wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    console.log(`[SIMPLE_SWAP] Starting swap of ${solAmount} SOL for YOT`);
    const amountInLamports = solAmount * LAMPORTS_PER_SOL;

    // Get all the necessary token addresses and PDAs
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const [programStateAddress] = findProgramStatePda();
    const [programAuthority] = findProgramAuthorityPda();

    // Get token accounts
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);

    // Check if user YOT account exists
    let userYotAccountExists = false;
    try {
      const accountInfo = await connection.getAccountInfo(userYotAccount);
      userYotAccountExists = accountInfo !== null;
    } catch (error) {
      console.error('[SIMPLE_SWAP] Error checking user YOT account:', error);
    }

    // Create a transaction to create user YOT account if needed
    const transaction = new Transaction();
    if (!userYotAccountExists) {
      console.log('[SIMPLE_SWAP] Creating user YOT account...');
      const createYotAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userYotAccount,
        wallet.publicKey,
        yotMint
      );
      transaction.add(createYotAccountIx);
    }

    // Check if user YOS account exists
    let userYosAccountExists = false;
    try {
      const accountInfo = await connection.getAccountInfo(userYosAccount);
      userYosAccountExists = accountInfo !== null;
    } catch (error) {
      console.error('[SIMPLE_SWAP] Error checking user YOS account:', error);
    }

    // Create user YOS account if needed
    if (!userYosAccountExists) {
      console.log('[SIMPLE_SWAP] Creating user YOS account...');
      const createYosAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userYosAccount,
        wallet.publicKey,
        yosMint
      );
      transaction.add(createYosAccountIx);
    }

    // Add SOL transfer to system instruction
    // This simply transfers SOL to the SOL pool account
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: POOL_SOL_ACCOUNT,
      lamports: amountInLamports
    });
    transaction.add(transferInstruction);

    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Sign transaction
    const signedTx = await wallet.signTransaction(transaction);

    // Send transaction
    console.log('[SIMPLE_SWAP] Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`[SIMPLE_SWAP] Transaction sent: ${signature}`);
    console.log(`[SIMPLE_SWAP] View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('[SIMPLE_SWAP] Transaction confirmed!');

    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error('[SIMPLE_SWAP] Error during swap:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}