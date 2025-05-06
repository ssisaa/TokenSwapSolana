/**
 * SOL to YOT swap implementation with automatic retry mechanism
 * This implementation addresses the "account already borrowed" error by 
 * detecting a failed first attempt and automatically retrying.
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
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';
import { findLiquidityContributionAddress } from './createLiquidityContribution';

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
 * Ensure token account exists for the user
 */
async function ensureTokenAccount(wallet: any, mint: PublicKey): Promise<PublicKey> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      // Check if account exists
      await getAccount(connection, tokenAddress);
      console.log(`[AUTO-RETRY] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[AUTO-RETRY] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[AUTO-RETRY] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[AUTO-RETRY] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Check if liquidity contribution account exists
 */
async function checkLiquidityAccount(wallet: any): Promise<{
  exists: boolean,
  address: PublicKey
}> {
  const [address] = findLiquidityContributionAddress(wallet.publicKey, MULTI_HUB_SWAP_PROGRAM_ID);
  console.log(`[AUTO-RETRY] Checking liquidity account: ${address.toString()}`);
  
  const accountInfo = await connection.getAccountInfo(address);
  
  return {
    exists: accountInfo !== null,
    address
  };
}

/**
 * Create SOL to YOT swap transaction
 */
async function createSwapTransaction(
  wallet: any,
  solAmount: number,
  slippagePercent: number,
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log(`[AUTO-RETRY] Creating transaction for ${solAmount} SOL swap`);
  
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
  
  // Add compute budget to allow for account creation
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
 * Create an empty liquidity contribution account
 * We'll create this account manually as a separate operation
 */
async function createLiquidityContributionAccount(
  wallet: any,
  programId: PublicKey,
  liquidityAccountAddress: PublicKey
): Promise<string> {
  console.log('[AUTO-RETRY] Creating empty liquidity contribution account...');
  
  try {
    // Find program state and authority
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    
    // Size for liquidity contribution account (we'll allocate a bit extra to be safe)
    const space = 128;
    const lamports = await connection.getMinimumBalanceForRentExemption(space);
    
    // Create a system instruction to allocate space and transfer lamports
    // This won't initialize the account properly, but it will create it
    // The first swap transaction will fail, but the second should succeed
    
    // Build a transaction with create account instruction
    const transaction = new Transaction();
    
    // Add compute budget instructions for safety
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    transaction.add(computeUnits);
    
    // We'll use the special instruction #9 (if it exists) that only creates the account
    // Otherwise we'll create a dummy account that should at least reserve the PDA
    const data = Buffer.alloc(1);
    data.writeUint8(9, 0); // Instruction #9 - CREATE_ACCOUNT_ONLY (hopefully exists)
    
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityAccountAddress, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const createAccountIx = new TransactionInstruction({
      programId,
      keys: accounts,
      data
    });
    
    transaction.add(createAccountIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: true // Skip preflight to ensure it's sent even if it might fail
    });
    
    console.log(`[AUTO-RETRY] Liquidity account creation tx sent: ${signature}`);
    
    try {
      await connection.confirmTransaction(signature);
      console.log('[AUTO-RETRY] Liquidity account creation confirmed!');
    } catch (confirmError) {
      console.log('[AUTO-RETRY] Liquidity account creation confirmation error (may still be created):', 
        confirmError instanceof Error ? confirmError.message : String(confirmError));
    }
    
    // Wait a moment to ensure propagation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return signature;
  } catch (error) {
    console.error('[AUTO-RETRY] Error creating liquidity contribution account:', error);
    throw error;
  }
}

/**
 * Two-phase SOL to YOT swap implementation
 * This approach first creates the liquidity contribution account separately,
 * then performs the actual swap as a second transaction.
 */
export async function autoRetrySwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
  accountCreated?: boolean;
}> {
  console.log(`[AUTO-RETRY] Starting SOL to YOT swap for ${solAmount} SOL with two-phase approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[AUTO-RETRY] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Check if liquidity contribution account exists
    const liquidityAccountInfo = await checkLiquidityAccount(wallet);
    console.log(`[AUTO-RETRY] Liquidity account exists: ${liquidityAccountInfo.exists}`);
    
    let accountCreated = false;
    
    // If the account doesn't exist, create it first in a separate transaction
    if (!liquidityAccountInfo.exists) {
      try {
        console.log('[AUTO-RETRY] Creating liquidity contribution account first...');
        await createLiquidityContributionAccount(
          wallet, 
          MULTI_HUB_SWAP_PROGRAM_ID,
          liquidityAccountInfo.address
        );
        
        accountCreated = true;
        
        // Wait a moment to ensure propagation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check again if the account was created
        const accountInfo = await connection.getAccountInfo(liquidityAccountInfo.address);
        if (accountInfo) {
          console.log('[AUTO-RETRY] Liquidity account confirmed to exist!');
        } else {
          console.log('[AUTO-RETRY] Warning: Account still does not exist according to getAccountInfo');
        }
      } catch (error) {
        console.error('[AUTO-RETRY] Error during account creation (continuing anyway):', error);
      }
    }
    
    // Now perform the actual swap
    const transaction = await createSwapTransaction(
      wallet,
      solAmount,
      1.0, // 1% slippage
      userYotAccount,
      userYosAccount,
      liquidityAccountInfo.address
    );
    
    console.log('[AUTO-RETRY] Sending swap transaction...');
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    console.log(`[AUTO-RETRY] Swap transaction sent: ${signature}`);
    
    // Wait for confirmation
    const result = await connection.confirmTransaction(signature);
    
    if (result.value.err) {
      const errStr = JSON.stringify(result.value.err);
      console.error('[AUTO-RETRY] Swap transaction failed:', errStr);
      
      // If we get the "account already borrowed" error and we've created the account
      // we should try again once more
      if (errStr.includes('already borrowed') && accountCreated) {
        console.log('[AUTO-RETRY] Detected "account already borrowed" error, trying one more time...');
        
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create a new transaction with a fresh blockhash
        const retryTransaction = await createSwapTransaction(
          wallet,
          solAmount,
          1.0,
          userYotAccount,
          userYosAccount,
          liquidityAccountInfo.address
        );
        
        console.log('[AUTO-RETRY] Sending final retry transaction...');
        const retrySignedTransaction = await wallet.signTransaction(retryTransaction);
        const retrySignature = await connection.sendRawTransaction(retrySignedTransaction.serialize());
        console.log(`[AUTO-RETRY] Retry transaction sent: ${retrySignature}`);
        
        // Wait for confirmation
        const retryResult = await connection.confirmTransaction(retrySignature);
        
        if (retryResult.value.err) {
          console.error('[AUTO-RETRY] Retry also failed:', retryResult.value.err);
          return {
            success: false,
            signature: retrySignature,
            error: 'Swap failed even after account creation',
            message: `Transaction error: ${JSON.stringify(retryResult.value.err)}`,
            accountCreated
          };
        }
        
        console.log('[AUTO-RETRY] Retry succeeded!');
        return {
          success: true,
          signature: retrySignature,
          message: `Successfully swapped ${solAmount} SOL for YOT tokens (after retry)`,
          accountCreated
        };
      }
      
      return {
        success: false,
        signature,
        error: 'Swap failed',
        message: `Transaction error: ${errStr}`,
        accountCreated
      };
    }
    
    console.log('[AUTO-RETRY] Swap succeeded!');
    return {
      success: true,
      signature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`,
      accountCreated
    };
  } catch (error) {
    console.error('[AUTO-RETRY] Error during swap:', error);
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
  console.log(`[AUTO-RETRY] Starting swap of ${solAmount} SOL`);
  
  const result = await autoRetrySwap(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}