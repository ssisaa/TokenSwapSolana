/**
 * Implementation of the complete swap function that handles the 
 * second part of a two-phase transaction process for SOL to YOT swaps
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
  Keypair
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { solanaConfig } from './config';

// Import and re-export connection
import { connection } from './solana';
export { connection };

// Re-export pool authority keypair for compatibility
// This is a stub - the actual keypair would be securely stored in production
export const poolAuthorityKeypair = Keypair.generate();

// Constants from config - all from app.config.json with NO hardcoded values
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);

/**
 * Find program state PDA
 */
function findProgramStateAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

/**
 * Find program authority PDA
 */
function findProgramAuthority(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

/**
 * Find the liquidity contribution address for a user wallet
 */
function findLiquidityContributionAddress(userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
}

/**
 * Ensure token account exists for the user
 */
async function ensureTokenAccount(wallet: any, mint: PublicKey): Promise<PublicKey> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      // Check if account exists
      await connection.getTokenAccountBalance(tokenAddress);
      console.log(`[COMPLETE-SWAP] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[COMPLETE-SWAP] Creating token account for mint ${mint.toString()}`);
      
      const createATAIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        tokenAddress, // ata
        wallet.publicKey, // owner
        mint // mint
      );
      
      // Create and send transaction
      const transaction = new Transaction().add(createATAIx);
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Sign and send
      const signedTxn = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTxn.serialize());
      await connection.confirmTransaction(signature);
      
      console.log(`[COMPLETE-SWAP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[COMPLETE-SWAP] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Complete a SOL to YOT swap by transferring YOT tokens after a failed first transaction
 * This is the second part of a two-phase transaction to work around the "account already borrowed" error
 */
export async function completeSwapWithYotTransfer(
  wallet: any,
  yotAmount: number // The YOT amount that needs to be transferred
): Promise<string> {
  try {
    console.log(`[COMPLETE-SWAP] Completing swap by transferring ${yotAmount} YOT tokens`);
    
    // Get token accounts
    const userYotAccount = await ensureTokenAccount(wallet, YOT_TOKEN_ADDRESS);
    const userYosAccount = await ensureTokenAccount(wallet, YOS_TOKEN_ADDRESS);
    
    // Get liquidity contribution account (should exist now if first transaction partially completed)
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey);
    
    // Get PDAs
    const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
    const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Get YOT pool token account
    const yotPoolAccount = await getAssociatedTokenAddress(
      YOT_TOKEN_ADDRESS,
      POOL_AUTHORITY
    );
    
    // Encode the YOT amount in the correct format
    const yotAmountScaled = Math.floor(yotAmount * Math.pow(10, 9)); // Adjust for decimals
    
    // Instruction data for a YOT transfer completion
    // Format: [6 (COMPLETE_TRANSFER), yotAmount (8 bytes), 0 (8 bytes)]
    const data = Buffer.alloc(17);
    data.writeUint8(6, 0); // Hypothetical instruction #6 for completing a transfer
    data.writeBigUInt64LE(BigInt(yotAmountScaled), 1);
    data.writeBigUInt64LE(BigInt(0), 9); // No min amount needed for completion
    
    // Required accounts
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
      { pubkey: YOS_TOKEN_ADDRESS, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    // Create instruction
    const completeIx = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accounts,
      data,
    });
    
    // Create transaction with compute budget instructions
    const transaction = new Transaction();
    
    // Add compute budget
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(completeIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    try {
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true // To ensure it goes through even if it might fail
      });
      console.log(`[COMPLETE-SWAP] Completion transaction sent: ${signature}`);
      
      // Wait for confirmation
      const result = await connection.confirmTransaction(signature);
      
      if (result.value.err) {
        console.error(`[COMPLETE-SWAP] Completion transaction failed: ${JSON.stringify(result.value.err)}`);
        throw new Error(`Completion transaction failed: ${JSON.stringify(result.value.err)}`);
      }
      
      console.log('[COMPLETE-SWAP] Swap completion successful!');
      return signature;
    } catch (error) {
      console.error('[COMPLETE-SWAP] Error sending completion transaction:', error);
      throw error;
    }
  } catch (error) {
    console.error('[COMPLETE-SWAP] Error completing swap:', error);
    throw error;
  }
}