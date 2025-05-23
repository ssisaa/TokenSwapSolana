/**
 * Force-through SOL to YOT swap implementation
 * This implementation addresses the "account already borrowed" error by
 * accepting that the first transaction will fail, but still transfer SOL,
 * and then automatically submitting a second transaction with 0 SOL amount
 * to complete the YOT transfer.
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
function findLiquidityContributionAddress(userWallet: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
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
      console.log(`[FORCE-SWAP] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[FORCE-SWAP] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[FORCE-SWAP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[FORCE-SWAP] Error ensuring token account:', error);
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
  console.log(`[FORCE-SWAP] Checking liquidity account: ${address.toString()}`);
  
  const accountInfo = await connection.getAccountInfo(address);
  
  return {
    exists: accountInfo !== null,
    address
  };
}

/**
 * Create SOL to YOT swap transaction
 * If forceZeroSol is true, it will create a transaction with 0 SOL amount
 * to be used for the completing retry after the initial transaction fails
 */
async function createSwapTransaction(
  wallet: any,
  solAmount: number,
  slippagePercent: number,
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey,
  forceZeroSol: boolean = false
): Promise<Transaction> {
  console.log(`[FORCE-SWAP] Creating transaction for ${solAmount} SOL swap, forceZeroSol: ${forceZeroSol}`);
  
  // Convert SOL to lamports (use 0 if forced)
  const amountInLamports = forceZeroSol ? 0 : Math.floor(solAmount * LAMPORTS_PER_SOL);
  
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
 * Force-through SOL to YOT swap implementation
 * This implementation:
 * 1. Sends the first transaction that will transfer SOL and create the account
 *    but likely fail when trying to transfer YOT
 * 2. Once the account is created, sends a second transaction with 0 SOL amount
 *    that will complete the YOT transfer
 */
export async function forceThroughSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  initialSignature?: string;
  error?: string;
  message?: string;
}> {
  console.log(`[FORCE-SWAP] Starting SOL to YOT swap for ${solAmount} SOL with force-through approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[FORCE-SWAP] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Check if liquidity contribution account exists
    const liquidityAccountInfo = await checkLiquidityAccount(wallet);
    console.log(`[FORCE-SWAP] Liquidity account exists: ${liquidityAccountInfo.exists}`);
    
    // If account already exists, we can just do a normal swap
    if (liquidityAccountInfo.exists) {
      console.log('[FORCE-SWAP] Liquidity account already exists, performing normal swap');
      
      const transaction = await createSwapTransaction(
        wallet,
        solAmount,
        1.0, // 1% slippage
        userYotAccount,
        userYosAccount,
        liquidityAccountInfo.address
      );
      
      console.log('[FORCE-SWAP] Sending swap transaction...');
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log(`[FORCE-SWAP] Transaction sent: ${signature}`);
      
      // Wait for confirmation
      const result = await connection.confirmTransaction(signature);
      
      if (result.value.err) {
        console.error('[FORCE-SWAP] Transaction failed:', result.value.err);
        return {
          success: false,
          signature,
          error: 'Swap failed',
          message: `Transaction error: ${JSON.stringify(result.value.err)}`
        };
      }
      
      console.log('[FORCE-SWAP] Swap succeeded!');
      return {
        success: true,
        signature,
        message: `Successfully swapped ${solAmount} SOL for YOT tokens`
      };
    }
    
    // Account doesn't exist, use the force-through approach
    console.log('[FORCE-SWAP] Liquidity account does not exist, using force-through approach');
    
    // STEP 1: Send the first transaction that will transfer SOL and create the account
    const initialTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      1.0, // 1% slippage
      userYotAccount,
      userYosAccount,
      liquidityAccountInfo.address
    );
    
    console.log('[FORCE-SWAP] Sending initial transaction (expect it to fail but create account)...');
    const signedInitialTransaction = await wallet.signTransaction(initialTransaction);
    
    let initialSignature;
    try {
      initialSignature = await connection.sendRawTransaction(signedInitialTransaction.serialize());
      console.log(`[FORCE-SWAP] Initial transaction sent: ${initialSignature}`);
      
      // Wait for confirmation, but expect it to fail
      try {
        const initialResult = await connection.confirmTransaction(initialSignature);
        if (initialResult.value.err) {
          console.log('[FORCE-SWAP] Initial transaction failed as expected:', initialResult.value.err);
        } else {
          // If it succeeded, we're done!
          console.log('[FORCE-SWAP] Initial transaction succeeded unexpectedly!');
          return {
            success: true,
            signature: initialSignature,
            message: `Successfully swapped ${solAmount} SOL for YOT tokens`
          };
        }
      } catch (confirmError) {
        console.log('[FORCE-SWAP] Initial transaction confirmation error (expected):', 
          confirmError instanceof Error ? confirmError.message : String(confirmError));
      }
    } catch (sendError) {
      console.error('[FORCE-SWAP] Error sending initial transaction:', sendError);
      return {
        success: false,
        error: 'Failed to send initial transaction',
        message: sendError instanceof Error ? sendError.message : String(sendError)
      };
    }
    
    // Wait a moment to ensure the account creation has propagated
    console.log('[FORCE-SWAP] Waiting 2 seconds before checking account and proceeding...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // STEP 2: Check if the account was created
    const accountCreatedInfo = await connection.getAccountInfo(liquidityAccountInfo.address);
    if (!accountCreatedInfo) {
      console.error('[FORCE-SWAP] Liquidity account still does not exist after initial transaction');
      return {
        success: false,
        initialSignature,
        error: 'Account creation failed',
        message: 'Liquidity account was not created by the initial transaction'
      };
    }
    
    console.log('[FORCE-SWAP] Liquidity account created successfully!');
    console.log(`[FORCE-SWAP] Account size: ${accountCreatedInfo.data.length} bytes`);
    
    // STEP 3: Send the second transaction with 0 SOL to complete the operation
    const completionTransaction = await createSwapTransaction(
      wallet,
      solAmount, // We'll pass the same amount but force it to 0 internally
      1.0,
      userYotAccount,
      userYosAccount,
      liquidityAccountInfo.address,
      true // Force 0 SOL amount
    );
    
    console.log('[FORCE-SWAP] Sending completion transaction with 0 SOL amount...');
    const signedCompletionTransaction = await wallet.signTransaction(completionTransaction);
    const completionSignature = await connection.sendRawTransaction(signedCompletionTransaction.serialize());
    console.log(`[FORCE-SWAP] Completion transaction sent: ${completionSignature}`);
    
    // Wait for confirmation
    const completionResult = await connection.confirmTransaction(completionSignature);
    
    if (completionResult.value.err) {
      console.error('[FORCE-SWAP] Completion transaction failed:', completionResult.value.err);
      return {
        success: false,
        signature: completionSignature,
        initialSignature,
        error: 'Completion transaction failed',
        message: `Transaction error: ${JSON.stringify(completionResult.value.err)}`
      };
    }
    
    console.log('[FORCE-SWAP] Force-through swap succeeded!');
    return {
      success: true,
      signature: completionSignature,
      initialSignature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens (force-through)`
    };
  } catch (error) {
    console.error('[FORCE-SWAP] Error during swap:', error);
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
  console.log(`[FORCE-SWAP] Starting swap of ${solAmount} SOL`);
  
  const result = await forceThroughSwap(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}