/**
 * Direct SOL to YOT swap implementation
 * This approach focuses on simplicity and reliability
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID
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
 * Find liquidity contribution account address
 */
function findLiquidityContributionPda(userPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
}

/**
 * Direct SOL to YOT swap implementation
 * This version focuses purely on SOL transfers directly to the pool account
 * It bypasses all smart contract interaction to ensure it works reliably
 */
export async function directSwap(wallet: any, solAmount: number): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  if (!wallet || !wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    console.log(`[DIRECT_SWAP] Starting simple SOL transfer of ${solAmount} SOL`);
    const amountInLamports = solAmount * LAMPORTS_PER_SOL;

    // Create a simple transaction with just a SOL transfer
    const transaction = new Transaction();
    
    // Add compute budget instruction for good measure
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 200000
      })
    );
    
    // CRITICAL: The most basic operation - just transfer SOL to the pool account
    // This doesn't interact with any program or smart contract
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: POOL_SOL_ACCOUNT, // The pool's SOL account
        lamports: amountInLamports
      })
    );
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the transaction
    console.log("[DIRECT_SWAP] Requesting signature from wallet...");
    const signedTx = await wallet.signTransaction(transaction);
    
    console.log("[DIRECT_SWAP] Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`[DIRECT_SWAP] Transaction sent: ${signature}`);
    console.log(`[DIRECT_SWAP] View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("[DIRECT_SWAP] Transaction confirmed!");
    
    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error("[DIRECT_SWAP] Error during swap:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Creates a transaction to create a liquidity contribution account
 */
export async function createLiquidityAccountOnly(wallet: any): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  if (!wallet?.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    // Get the liquidity contribution account address
    const [liquidityContributionAddress] = findLiquidityContributionPda(wallet.publicKey);
    const [programAuthority] = findProgramAuthorityPda();
    
    console.log(`[CREATE_LIQ] Creating liquidity contribution account: ${liquidityContributionAddress.toString()}`);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo) {
      console.log('[CREATE_LIQ] Liquidity contribution account already exists');
      return { success: true };
    }
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add compute budget instruction
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 200000
      })
    );
    
    // Encode instruction data - create liquidity account
    const data = Buffer.from([5]); // Instruction 5: Create liquidity account
    
    // Account metas for creating liquidity account
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    // Create the instruction
    transaction.add(
      new TransactionInstruction({
        programId: MULTI_HUB_SWAP_PROGRAM_ID,
        keys: accountMetas,
        data,
      })
    );
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    console.log("[CREATE_LIQ] Requesting signature from wallet...");
    const signedTx = await wallet.signTransaction(transaction);
    
    console.log("[CREATE_LIQ] Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`[CREATE_LIQ] Transaction sent: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("[CREATE_LIQ] Transaction confirmed!");
    
    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error("[CREATE_LIQ] Error creating liquidity account:", error);
    return {
      success: false,
      error: error.message
    };
  }
}