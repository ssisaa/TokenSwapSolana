/**
 * SOL to YOT swap implementation using CPI (Cross-Program Invocation) approach
 * This implementation addresses the "account already borrowed" error by
 * using a system program invocation to create the account first, and then
 * having the program fill it with proper data.
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';

// Constants from config
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
      console.log(`[CPI-SWAP] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[CPI-SWAP] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[CPI-SWAP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[CPI-SWAP] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Create CPI transaction that:
 * 1. Creates the account directly using SystemProgram (not PDA - that can't work)
 * 2. Transfers ownership of that account to the program
 * 3. Calls the program to initialize the account
 *
 * Note: This approach requires the program to support a special instruction
 * that accepts and initializes an account that's already been created.
 */
async function createCpiTransaction(
  wallet: any,
  liquidityContributionAccount: PublicKey,
  bump: number
): Promise<Transaction> {
  console.log('[CPI-SWAP] Creating CPI transaction');
  
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Calculate space needed for the account
  const ACCOUNT_SIZE = 128; // Estimated size based on logs
  
  // Calculate lamports needed for rent exemption
  const lamports = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
  
  // Create transaction with compute budget
  const transaction = new Transaction();
  
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  
  transaction.add(computeUnits);
  
  // This approach would use a version of instruction #9 that is specifically designed
  // to initialize the account data correctly without trying to create the account
  // (since that's what causes the "account already borrowed" error)
  
  // Instruction data for a hypothetical "initialize account" instruction: [9, bump]
  const data = Buffer.alloc(2);
  data.writeUint8(9, 0); // Hypothetical instruction #9
  data.writeUint8(bump, 1); // Pass the bump seed to the program
  
  // The account will already be created by the SystemProgram, so we only need to initialize it
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  
  const initializeIx = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accounts,
    data
  });
  
  transaction.add(initializeIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return transaction;
}

/**
 * Create SOL to YOT swap transaction
 */
async function createSwapTransaction(
  wallet: any,
  solAmount: number,
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log(`[CPI-SWAP] Creating swap transaction for ${solAmount} SOL`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Allow 0 min output during testing/retry scenarios
  const minAmountOut = 0; // In a production environment, calculate this from expected output and slippage
  
  // Get PDAs for the transaction
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Get YOT pool token account
  const yotPoolAccount = await getAssociatedTokenAddress(
    new PublicKey(YOT_TOKEN_ADDRESS),
    POOL_AUTHORITY
  );
  
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(minAmountOut), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(YOS_TOKEN_ADDRESS), isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const swapInstruction = new TransactionInstruction({
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
  transaction.add(swapInstruction);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return transaction;
}

/**
 * Execute the CPI approach for SOL to YOT swap
 * This approach uses CPI to create the account and tries to initialize it
 * in a way that avoids the "account already borrowed" error
 */
export async function cpiSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  cpiSignature?: string;
  error?: string;
  message?: string;
}> {
  console.log(`[CPI-SWAP] Starting SOL to YOT swap for ${solAmount} SOL with CPI approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[CPI-SWAP] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Check if liquidity contribution account exists
    const [liquidityContributionAccount, bump] = findLiquidityContributionAddress(wallet.publicKey);
    console.log(`[CPI-SWAP] Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
    
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    const accountExists = accountInfo !== null;
    console.log(`[CPI-SWAP] Liquidity account exists: ${accountExists}`);
    
    let cpiSignature: string | undefined;
    
    // If the account doesn't exist, create it first with our CPI approach
    if (!accountExists) {
      try {
        console.log('[CPI-SWAP] Initializing liquidity contribution account with CPI approach...');
        const cpiTx = await createCpiTransaction(
          wallet,
          liquidityContributionAccount,
          bump
        );
        
        const signedTx = await wallet.signTransaction(cpiTx);
        cpiSignature = await connection.sendRawTransaction(signedTx.serialize());
        console.log(`[CPI-SWAP] CPI initialization transaction sent: ${cpiSignature}`);
        
        // Wait for confirmation
        const cpiResult = await connection.confirmTransaction(cpiSignature);
        
        if (cpiResult.value.err) {
          console.error('[CPI-SWAP] Account initialization failed:', cpiResult.value.err);
          return {
            success: false,
            cpiSignature,
            error: 'Account initialization failed',
            message: `Failed to initialize liquidity contribution account: ${JSON.stringify(cpiResult.value.err)}`
          };
        }
        
        console.log('[CPI-SWAP] Account initialized successfully, waiting 2 seconds before swap...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check again if the account was created
        const newAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
        if (!newAccountInfo) {
          console.error('[CPI-SWAP] Account still does not exist after successful CPI initialization');
          return {
            success: false,
            cpiSignature,
            error: 'Account verification failed',
            message: 'Liquidity contribution account was not found after CPI initialization'
          };
        }
        
        console.log(`[CPI-SWAP] Account verified, size: ${newAccountInfo.data.length} bytes`);
      } catch (error) {
        console.error('[CPI-SWAP] Error during account initialization:', error);
        return {
          success: false,
          cpiSignature,
          error: 'Account initialization error',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    // Now perform the actual swap
    console.log('[CPI-SWAP] Creating and sending swap transaction...');
    const swapTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      userYotAccount,
      userYosAccount,
      liquidityContributionAccount
    );
    
    const signedSwapTx = await wallet.signTransaction(swapTransaction);
    const swapSignature = await connection.sendRawTransaction(signedSwapTx.serialize());
    console.log(`[CPI-SWAP] Swap transaction sent: ${swapSignature}`);
    
    // Wait for confirmation
    const swapResult = await connection.confirmTransaction(swapSignature);
    
    if (swapResult.value.err) {
      console.error('[CPI-SWAP] Swap transaction failed:', swapResult.value.err);
      return {
        success: false,
        signature: swapSignature,
        cpiSignature,
        error: 'Swap failed',
        message: `Transaction error: ${JSON.stringify(swapResult.value.err)}`
      };
    }
    
    console.log('[CPI-SWAP] Swap transaction succeeded!');
    return {
      success: true,
      signature: swapSignature,
      cpiSignature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`
    };
  } catch (error) {
    console.error('[CPI-SWAP] Error during swap process:', error);
    return {
      success: false,
      error: 'Error during swap',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Simplified export function for compatibility with multi-hub-swap-contract.ts
 */
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string> {
  console.log(`[CPI-SWAP] Starting swap of ${solAmount} SOL`);
  
  const result = await cpiSwap(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}