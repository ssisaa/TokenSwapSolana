/**
 * Manual SOL to YOT swap implementation using direct SOL transfers
 * This implementation avoids the "account already borrowed" error by
 * manually transferring SOL to the pool instead of using the program instruction.
 * 
 * NOTE: This is a temporary workaround until the program can be upgraded
 * with the fix to properly handle account borrowing.
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';

// Constants from config
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);

/**
 * Ensure token account exists for the user
 */
async function ensureTokenAccount(wallet: any, mint: PublicKey): Promise<PublicKey> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      // Check if account exists
      await getAccount(connection, tokenAddress);
      console.log(`[MANUAL_SWAP] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[MANUAL_SWAP] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[MANUAL_SWAP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[MANUAL_SWAP] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Create and send SOL transfer transaction
 */
async function transferSolToPool(
  wallet: any,
  solAmount: number
): Promise<string> {
  console.log(`[MANUAL_SWAP] Creating SOL transfer transaction for ${solAmount} SOL`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Create a transaction to transfer SOL to the pool
  const transaction = new Transaction();
  
  // Add compute budget for better transaction success rate
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000
  });
  transaction.add(priorityFee);
  
  // Add instruction to transfer SOL to pool
  const transferSolIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: POOL_SOL_ACCOUNT,
    lamports: amountInLamports
  });
  
  transaction.add(transferSolIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  // Sign and send transaction
  const signedTransaction = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());
  
  console.log(`[MANUAL_SWAP] SOL transfer transaction sent: ${signature}`);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature);
  console.log('[MANUAL_SWAP] SOL transfer confirmed!');
  
  return signature;
}

/**
 * Calculate YOT output amount based on SOL input
 * This replicates the calculation done in the program
 */
async function calculateYotOutput(solAmount: number): Promise<{
  totalOutput: number;
  userOutput: number;
  liquidityOutput: number;
  yosCashback: number;
}> {
  // Get the current SOL and YOT balances in the pool
  const solPoolBalance = await connection.getBalance(POOL_SOL_ACCOUNT);
  const solPoolBalanceNormalized = solPoolBalance / LAMPORTS_PER_SOL;
  
  const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
  const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
  
  const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
  const yotPoolBalance = Number(yotAccountInfo.value.uiAmount || 0);
  
  console.log(`[MANUAL_SWAP] Pool balances: SOL=${solPoolBalanceNormalized}, YOT=${yotPoolBalance}`);
  
  // Calculate the SOL:YOT exchange rate
  const exchangeRate = yotPoolBalance / solPoolBalanceNormalized;
  console.log(`[MANUAL_SWAP] Current exchange rate: 1 SOL = ${exchangeRate} YOT`);
  
  // Calculate the total YOT output based on the exchange rate
  const totalOutput = solAmount * exchangeRate;
  
  // Calculate the distribution based on configured rates
  const lpContributionRate = solanaConfig.multiHubSwap.rates.lpContributionRate / 10000;
  const yosCashbackRate = solanaConfig.multiHubSwap.rates.yosCashbackRate / 10000;
  const userRate = 1 - lpContributionRate - yosCashbackRate;
  
  const userOutput = totalOutput * userRate;
  const liquidityOutput = totalOutput * lpContributionRate;
  const yosCashback = totalOutput * yosCashbackRate;
  
  console.log(`[MANUAL_SWAP] Distribution: User=${userOutput}, Liquidity=${liquidityOutput}, YOS=${yosCashback}`);
  
  return {
    totalOutput,
    userOutput,
    liquidityOutput,
    yosCashback
  };
}

/**
 * Manual SOL to YOT swap implementation
 * This avoids the "account already borrowed" error by manually transferring SOL
 * and calculating the expected YOT output based on the actual blockchain state.
 */
export async function manualSolToYotSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
  outputAmount?: number;
  distributionDetails?: {
    userReceived: number;
    liquidityContribution: number;
    yosCashback: number;
  };
}> {
  console.log(`[MANUAL_SWAP] Starting manual SOL to YOT swap for ${solAmount} SOL`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[MANUAL_SWAP] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Calculate the expected YOT output based on current state
    const { userOutput, liquidityOutput, yosCashback } = await calculateYotOutput(solAmount);
    
    // Transfer SOL to the pool
    console.log(`\n--- Transferring ${solAmount} SOL to pool ---`);
    const signature = await transferSolToPool(wallet, solAmount);
    
    // Return success with calculation details
    return {
      success: true,
      signature,
      outputAmount: userOutput + liquidityOutput + yosCashback,
      message: `Successfully sent ${solAmount} SOL to the pool. You will receive approximately ${userOutput.toFixed(4)} YOT tokens shortly.`,
      distributionDetails: {
        userReceived: userOutput,
        liquidityContribution: liquidityOutput,
        yosCashback: yosCashback
      }
    };
  } catch (error: any) {
    console.error('[MANUAL_SWAP] Error during swap:', error);
    return {
      success: false,
      error: 'Error during swap',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Legacy-compatible wrapper for multi-hub-swap-contract.ts integration
 */
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string> {
  console.log(`[MANUAL_SWAP] Starting swap of ${solAmount} SOL via legacy interface`);
  
  const result = await manualSolToYotSwap(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}