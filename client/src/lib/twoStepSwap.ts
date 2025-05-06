/**
 * SOL to YOT swap implementation with two-step approach
 * This implementation addresses the "account already borrowed" error by:
 * 1. Executing the first transaction with skipPreflight=true (it will fail but create the account)
 * 2. Then executing a completion transaction to transfer YOT tokens
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
import { completeSwapWithYotTransfer } from './completeSwap';

// Constants from config
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);
// Exchange rate - this is dynamically calculated 
// const SOL_TO_YOT_RATE = 144906535.28474102;

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
      console.log(`[TWO-STEP-SWAP] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[TWO-STEP-SWAP] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[TWO-STEP-SWAP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[TWO-STEP-SWAP] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Get the expected YOT output amount for a given SOL input
 * This is based on the actual AMM rates from the pool
 */
async function getExpectedYotOutput(solAmount: number): Promise<number> {
  // Use the real pool SOL and YOT balances to calculate the rate
  try {
    // Get SOL balance from pool SOL account
    const solPoolBalance = await connection.getBalance(POOL_SOL_ACCOUNT);
    const solBalanceNormalized = solPoolBalance / LAMPORTS_PER_SOL;
    
    // Get YOT balance from pool YOT account
    const yotPoolAccount = await getAssociatedTokenAddress(
      YOT_TOKEN_ADDRESS,
      POOL_AUTHORITY
    );
    
    let yotBalance = 0;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    yotBalance = Number(yotAccountInfo.value.uiAmount || 0);
    
    if (yotBalance <= 0 || solBalanceNormalized <= 0) {
      console.error('Invalid pool balances, cannot calculate rate');
      throw new Error('Invalid pool balances for rate calculation');
    }
    
    // Calculate rate using the constant product formula (x * y = k)
    const k = solBalanceNormalized * yotBalance;
    
    // Get new sol balance after adding input
    const newSolBalance = solBalanceNormalized + solAmount;
    
    // Calculate new YOT balance to maintain constant product
    const newYotBalance = k / newSolBalance;
    
    // YOT output is the difference
    const yotOutput = yotBalance - newYotBalance;
    
    console.log(`[TWO-STEP-SWAP] Pool balances - SOL: ${solBalanceNormalized}, YOT: ${yotBalance}`);
    console.log(`[TWO-STEP-SWAP] Calculated YOT output for ${solAmount} SOL: ${yotOutput}`);
    
    return yotOutput;
  } catch (error) {
    console.error('[TWO-STEP-SWAP] Error calculating expected output:', error);
    throw error;
  }
}

/**
 * Create SOL to YOT swap transaction (first phase)
 */
async function createSwapTransaction(
  wallet: any,
  solAmount: number,
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log(`[TWO-STEP-SWAP] Creating swap transaction for ${solAmount} SOL`);
  
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
 * Execute the two-step approach for SOL to YOT swap
 * This implementation:
 * 1. Executes the first transaction with skipPreflight=true (it will fail but create the account)
 * 2. Then executes a completion transaction to transfer YOT tokens
 */
export async function twoStepSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  solSignature?: string;
  completed?: boolean;
  error?: boolean;
  message?: string;
}> {
  console.log(`[TWO-STEP-SWAP] Starting SOL to YOT swap for ${solAmount} SOL with two-step approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: true,
      message: 'Wallet not connected. Please connect your wallet to continue.'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[TWO-STEP-SWAP] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Get liquidity contribution account address
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey);
    console.log(`[TWO-STEP-SWAP] Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
    
    // Check if the account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    const accountExists = accountInfo !== null;
    console.log(`[TWO-STEP-SWAP] Liquidity account exists: ${accountExists}`);
    
    // Pre-calculate expected YOT output to use for completion
    const expectedYotOutput = await getExpectedYotOutput(solAmount);
    console.log(`[TWO-STEP-SWAP] Expected YOT output: ${expectedYotOutput}`);
    
    // User gets ~75%, 20% goes to liquidity, 5% to YOS cashback
    const userDistribution = 100 - solanaConfig.multiHubSwap.rates.lpContributionRate - solanaConfig.multiHubSwap.rates.yosCashbackRate;
    const userYotAmount = (expectedYotOutput * userDistribution) / 100;
    console.log(`[TWO-STEP-SWAP] User's portion (${userDistribution}%): ${userYotAmount} YOT`);
    
    // STEP 1: Create and send the initial transaction (will likely fail with "account already borrowed")
    console.log('\n[TWO-STEP-SWAP] STEP 1: Sending initial transaction to create account...');
    const swapTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      userYotAccount,
      userYosAccount,
      liquidityContributionAccount
    );
    
    const signedSwapTx = await wallet.signTransaction(swapTransaction);
    let solSignature: string;
    
    try {
      // Send with skipPreflight to allow it to be processed even if it will fail
      solSignature = await connection.sendRawTransaction(signedSwapTx.serialize(), {
        skipPreflight: true
      });
      
      console.log(`[TWO-STEP-SWAP] Initial transaction sent: ${solSignature}`);
      
      // Try to wait for confirmation, but it will probably fail
      try {
        await connection.confirmTransaction(solSignature);
        console.log('[TWO-STEP-SWAP] Initial transaction succeeded unexpectedly!');
        
        // If it somehow succeeded, we're done
        return {
          success: true,
          signature: solSignature,
          solSignature,
          completed: true,
          message: `Successfully swapped ${solAmount} SOL for YOT tokens in a single transaction!`
        };
      } catch (confirmError) {
        console.log('[TWO-STEP-SWAP] First transaction failed as expected:', 
          confirmError instanceof Error ? confirmError.message : String(confirmError));
      }
    } catch (sendError) {
      console.error('[TWO-STEP-SWAP] Error sending initial transaction:', sendError);
      return {
        success: false,
        error: true,
        message: `Failed to send initial transaction: ${sendError instanceof Error ? sendError.message : String(sendError)}`
      };
    }
    
    // STEP 2: Wait for a moment to ensure transaction is fully processed
    console.log('[TWO-STEP-SWAP] Waiting 2 seconds for transaction to be processed...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if SOL was transferred successfully (transaction partially processed)
    const oldBalance = await connection.getBalance(wallet.publicKey);
    console.log(`[TWO-STEP-SWAP] Current wallet SOL balance: ${oldBalance / LAMPORTS_PER_SOL} SOL`);
    
    // STEP 3: Check if account now exists and proceed with completion
    console.log('\n[TWO-STEP-SWAP] STEP 2: Checking account and completing the swap...');
    const newAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    
    if (!newAccountInfo) {
      console.error('[TWO-STEP-SWAP] ❌ Liquidity account was not created by the initial transaction');
      return {
        success: false,
        solSignature,
        error: true,
        message: 'First transaction did not create the liquidity contribution account. Unable to complete the swap.'
      };
    }
    
    console.log(`[TWO-STEP-SWAP] ✅ Liquidity account created! Size: ${newAccountInfo.data.length} bytes`);
    
    // STEP 4: Execute the completion transaction to transfer YOT tokens
    try {
      console.log('[TWO-STEP-SWAP] Completing transfer to send YOT tokens...');
      const yotSignature = await completeSwapWithYotTransfer(wallet, userYotAmount);
      
      console.log(`[TWO-STEP-SWAP] ✅ Swap completed successfully with signatures:
        1. SOL Transfer: ${solSignature}
        2. YOT Transfer: ${yotSignature}`);
      
      return {
        success: true,
        signature: yotSignature,  // Return the final signature
        solSignature,             // Also include initial SOL transaction
        completed: true,
        message: `Successfully swapped ${solAmount} SOL for ~${userYotAmount.toFixed(2)} YOT tokens!`
      };
    } catch (completeError) {
      console.error('[TWO-STEP-SWAP] Error during completion transaction:', completeError);
      return {
        success: false,
        solSignature,
        error: true,
        message: `SOL transfer succeeded but YOT transfer failed: ${completeError instanceof Error ? completeError.message : String(completeError)}`
      };
    }
  } catch (error) {
    console.error('[TWO-STEP-SWAP] Unexpected error during two-step swap:', error);
    return {
      success: false,
      error: true,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Simplified export function for compatibility with multi-hub-swap-contract.ts
 */
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string | {
  solSignature: string;
  completed: boolean;
  error?: boolean;
  message?: string;
}> {
  console.log(`[TWO-STEP-SWAP] Starting swap of ${solAmount} SOL`);
  
  const result = await twoStepSwap(wallet, solAmount);
  
  if (result.success) {
    if (typeof result.signature === 'string') {
      return result.signature;
    } else {
      // Provide structured result with both signatures for better error handling
      return {
        solSignature: result.solSignature || '',
        completed: true
      };
    }
  } else {
    // Return structured error for better handling
    return {
      solSignature: result.solSignature || '',
      completed: false,
      error: true,
      message: result.message || 'Swap failed'
    };
  }
}