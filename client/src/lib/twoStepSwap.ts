/**
 * Two-step SOL to YOT swap implementation
 * This implementation addresses the "account already borrowed" error by
 * breaking the transaction into two separate steps:
 * 1. First transaction: Send a minimal amount of SOL (0.000001) just to create the account
 * 2. Second transaction: Send the actual SOL amount for the swap
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
      await getAccount(connection, tokenAddress);
      console.log(`[TWO-STEP] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[TWO-STEP] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[TWO-STEP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[TWO-STEP] Error ensuring token account:', error);
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
  const [address] = findLiquidityContributionAddress(wallet.publicKey);
  console.log(`[TWO-STEP] Checking liquidity account: ${address.toString()}`);
  
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
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log(`[TWO-STEP] Creating transaction for ${solAmount} SOL swap`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Allow 0 min output to maximize chances of success
  const minAmountOut = 0;
  
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
 * Two-step SOL to YOT swap implementation
 * First sends a minimal SOL amount to create the account, then sends the actual amount
 */
export async function twoStepSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  stepOneSignature?: string;
  error?: string;
  message?: string;
}> {
  console.log(`[TWO-STEP] Starting SOL to YOT swap for ${solAmount} SOL with two-step approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[TWO-STEP] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Check if liquidity contribution account exists
    const liquidityAccountInfo = await checkLiquidityAccount(wallet);
    console.log(`[TWO-STEP] Liquidity account exists: ${liquidityAccountInfo.exists}`);
    
    // If account already exists, we can just do a normal swap
    if (liquidityAccountInfo.exists) {
      console.log('[TWO-STEP] Liquidity account already exists, performing normal swap');
      
      const transaction = await createSwapTransaction(
        wallet,
        solAmount,
        userYotAccount,
        userYosAccount,
        liquidityAccountInfo.address
      );
      
      console.log('[TWO-STEP] Sending swap transaction...');
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log(`[TWO-STEP] Transaction sent: ${signature}`);
      
      // Wait for confirmation
      const result = await connection.confirmTransaction(signature);
      
      if (result.value.err) {
        console.error('[TWO-STEP] Transaction failed:', result.value.err);
        return {
          success: false,
          signature,
          error: 'Swap failed',
          message: `Transaction error: ${JSON.stringify(result.value.err)}`
        };
      }
      
      console.log('[TWO-STEP] Swap succeeded!');
      return {
        success: true,
        signature,
        message: `Successfully swapped ${solAmount} SOL for YOT tokens`
      };
    }
    
    // Account doesn't exist, use the two-step approach
    console.log('[TWO-STEP] Liquidity account does not exist, using two-step approach');
    
    // STEP 1: First send a minimal SOL amount just to create the account
    // Use a very small amount - 0.000001 SOL
    const microAmount = 0.000001;
    
    console.log(`\n--- STEP 1: Creating account with minimal swap (${microAmount} SOL) ---`);
    const stepOneTransaction = await createSwapTransaction(
      wallet,
      microAmount,
      userYotAccount,
      userYosAccount,
      liquidityAccountInfo.address
    );
    
    let stepOneSignature;
    try {
      const signedStepOneTransaction = await wallet.signTransaction(stepOneTransaction);
      stepOneSignature = await connection.sendRawTransaction(signedStepOneTransaction.serialize());
      console.log(`[TWO-STEP] Step 1 transaction sent: ${stepOneSignature}`);
      
      try {
        const stepOneResult = await connection.confirmTransaction(stepOneSignature);
        
        if (stepOneResult.value.err) {
          console.log('[TWO-STEP] Step 1 transaction failed:', stepOneResult.value.err);
          // It's expected to fail with the account borrow error, but we'll check if the account was created
        } else {
          console.log('[TWO-STEP] Step 1 succeeded unexpectedly!');
        }
      } catch (confirmError) {
        console.log('[TWO-STEP] Step 1 confirmation error:', 
          confirmError instanceof Error ? confirmError.message : String(confirmError));
      }
    } catch (sendError) {
      console.error('[TWO-STEP] Error sending step 1 transaction:', sendError);
      return {
        success: false,
        error: 'Failed to send account creation transaction',
        message: sendError instanceof Error ? sendError.message : String(sendError)
      };
    }
    
    // Wait a moment to ensure any changes propagate
    console.log('[TWO-STEP] Waiting 2 seconds before checking account and proceeding...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if the account was created
    const accountAfterStepOne = await connection.getAccountInfo(liquidityAccountInfo.address);
    if (accountAfterStepOne) {
      console.log('[TWO-STEP] Liquidity account was successfully created in step 1!');
      console.log(`[TWO-STEP] Account size: ${accountAfterStepOne.data.length} bytes`);
      console.log(`[TWO-STEP] Account owner: ${accountAfterStepOne.owner.toString()}`);
    } else {
      console.log('[TWO-STEP] Account was not created in step 1, proceeding anyway...');
    }
    
    // STEP 2: Now send the actual SOL amount
    console.log(`\n--- STEP 2: Performing actual swap (${solAmount} SOL) ---`);
    const stepTwoTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      userYotAccount,
      userYosAccount,
      liquidityAccountInfo.address
    );
    
    const signedStepTwoTransaction = await wallet.signTransaction(stepTwoTransaction);
    const stepTwoSignature = await connection.sendRawTransaction(signedStepTwoTransaction.serialize());
    console.log(`[TWO-STEP] Step 2 transaction sent: ${stepTwoSignature}`);
    
    // Wait for confirmation
    const stepTwoResult = await connection.confirmTransaction(stepTwoSignature);
    
    if (stepTwoResult.value.err) {
      console.error('[TWO-STEP] Step 2 transaction failed:', stepTwoResult.value.err);
      
      // If step 2 failed and the account still doesn't exist, try one more time with a higher amount
      if (!accountAfterStepOne) {
        console.log('[TWO-STEP] Account still does not exist, trying step 2 again with a higher amount...');
        
        // Try with a small amount, but higher than the first attempt (0.01 SOL)
        const smallAmount = 0.01;
        const retryTransaction = await createSwapTransaction(
          wallet,
          smallAmount,
          userYotAccount,
          userYosAccount,
          liquidityAccountInfo.address
        );
        
        const signedRetryTransaction = await wallet.signTransaction(retryTransaction);
        const retrySignature = await connection.sendRawTransaction(signedRetryTransaction.serialize());
        console.log(`[TWO-STEP] Retry transaction sent: ${retrySignature}`);
        
        // Wait for confirmation
        const retryResult = await connection.confirmTransaction(retrySignature);
        
        if (retryResult.value.err) {
          console.error('[TWO-STEP] Retry transaction also failed:', retryResult.value.err);
          return {
            success: false,
            signature: retrySignature,
            stepOneSignature,
            error: 'All swap attempts failed',
            message: `Transaction error: ${JSON.stringify(retryResult.value.err)}`
          };
        }
        
        console.log('[TWO-STEP] Retry swap succeeded!');
        return {
          success: true,
          signature: retrySignature,
          stepOneSignature,
          message: `Successfully swapped ${smallAmount} SOL for YOT tokens (after multiple attempts)`
        };
      }
      
      // Otherwise just report the failure
      return {
        success: false,
        signature: stepTwoSignature,
        stepOneSignature,
        error: 'Main swap transaction failed',
        message: `Transaction error: ${JSON.stringify(stepTwoResult.value.err)}`
      };
    }
    
    console.log('[TWO-STEP] Step 2 swap succeeded!');
    return {
      success: true,
      signature: stepTwoSignature,
      stepOneSignature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`
    };
  } catch (error) {
    console.error('[TWO-STEP] Error during swap:', error);
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
  console.log(`[TWO-STEP] Starting swap of ${solAmount} SOL`);
  
  const result = await twoStepSwap(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}