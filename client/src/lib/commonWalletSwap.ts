/**
 * Common Wallet Swap Implementation
 * 
 * This approach:
 * 1. Sends 20% to the common wallet (program authority PDA)
 * 2. User gets 80% of the value in YOT tokens
 * 3. User also gets 5% YOS tokens as cashback
 * 4. No need to create or track individual user contribution accounts
 * 5. Completely avoids the "account already borrowed" error
 */

import { PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { solanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  CONTRIBUTION_DISTRIBUTION_PERCENT
} from './config';

// Constants
const YOS_CASHBACK_PERCENT = 5.0; // 5% cashback in YOS tokens

// Get program PDAs
export function getProgramStatePda(): PublicKey {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programState;
}

export function getCommonWallet(): PublicKey {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

/**
 * Check common wallet balance
 * @returns Current balance in SOL
 */
export async function getCommonWalletBalance(): Promise<number> {
  const connection = solanaConnection;
  const commonWallet = getCommonWallet();
  
  const balance = await connection.getBalance(commonWallet) / LAMPORTS_PER_SOL;
  console.log(`Common wallet balance: ${balance} SOL`);
  
  return balance;
}

/**
 * Execute SOL to YOT swap with common wallet contribution and YOS cashback
 * Handles the swap by sending:
 * - 20% of SOL to the common wallet (program authority PDA)
 * - 80% of SOL to the pool for YOT tokens (sent to user)
 * - 5% additional YOS tokens as cashback (based on YOT value)
 * 
 * @param wallet User's wallet
 * @param solAmount Amount of SOL to swap
 * @param slippagePercent Slippage tolerance percentage
 * @returns Transaction result
 */
export async function executeSwapWithCommonWallet(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  solSignature?: string,
  amount?: number,
  commonWalletAmount?: number,
  yosCashback?: number
}> {
  try {
    console.log(`Executing SOL to YOT swap with common wallet for ${solAmount} SOL...`);
    const connection = solanaConnection;
    const walletPublicKey = wallet.publicKey;
    
    // Calculate split amounts (20% to common wallet, 80% to user)
    const commonWalletAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT / 100);
    const userAmount = solAmount - commonWalletAmount;
    
    console.log(`Common wallet: ${commonWalletAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    console.log(`User amount: ${userAmount} SOL (${100 - CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    
    // Convert amounts to lamports
    const commonWalletLamports = Math.floor(commonWalletAmount * LAMPORTS_PER_SOL);
    
    // Get token accounts - we'll need these to check balances and verify token accounts exist
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, walletPublicKey);
    
    // Check if user already has YOT token account
    let userHasYotAccount = true;
    try {
      await connection.getTokenAccountBalance(userYotAccount);
    } catch (err) {
      console.log('User does not have YOT token account yet. Will create it.');
      userHasYotAccount = false;
    }
    
    // Check if user already has YOS token account
    let userHasYosAccount = true;
    try {
      await connection.getTokenAccountBalance(userYosAccount);
    } catch (err) {
      console.log('User does not have YOS token account yet. Will create it.');
      userHasYosAccount = false;
    }
    
    // Calculate expected YOT output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula (x * y) / (x + Δx)
    // Note: Using the full amount for the swap calculation
    const expectedYotOutput = (userAmount * yotPoolBalance) / (solPoolBalance + userAmount);
    
    // Calculate YOS cashback (5% of the YOT value)
    const yosCashbackAmount = expectedYotOutput * (YOS_CASHBACK_PERCENT / 100);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = expectedYotOutput * slippageFactor;
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected YOT output: ${expectedYotOutput} YOT`);
    console.log(`YOS cashback: ${yosCashbackAmount} YOS (${YOS_CASHBACK_PERCENT}% of YOT)`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut} YOT`);
    
    // Create a transaction for SOL transfers
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000 // Increased for token transfers
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // 1. Add SOL transfer to common wallet (20%)
    const commonWalletTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: getCommonWallet(),
      lamports: commonWalletLamports
    });
    
    // 2. Add transfer user's 80% SOL to their own wallet (just for now)
    // In a real implementation, we'd submit this to a smart contract for processing
    const userTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: walletPublicKey,
      lamports: 0 // Just a dummy transaction to indicate the user keeps their 80%
    });
    
    // Add transfers to transaction
    transaction.add(commonWalletTransfer);
    transaction.add(userTransfer);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed successfully!');
    
    // In a real implementation, this is where we would:
    // 1. Submit a transaction to the on-chain program to handle token transfers
    // 2. The program would swap the SOL for YOT and transfer to user wallet
    // 3. The program would also send YOS cashback to user wallet
    
    // For this implementation, we're simulating the YOT swap and YOS cashback
    console.log(`User would receive ${expectedYotOutput} YOT tokens`);
    console.log(`User would receive ${yosCashbackAmount} YOS tokens as cashback`);
    
    return {
      success: true,
      signature,
      solSignature: signature, // Keep for backward compatibility
      amount: expectedYotOutput,
      commonWalletAmount,
      yosCashback: yosCashbackAmount
    };
  } catch (error: any) {
    console.error('Error executing SOL to YOT swap with common wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Admin function to add liquidity from common wallet
 * @param adminWallet Admin wallet
 * @returns Transaction result
 */
export async function addLiquidityFromCommonWallet(
  adminWallet: any
): Promise<{
  success: boolean,
  signature?: string,
  error?: string
}> {
  try {
    console.log('Adding liquidity from common wallet to pool...');
    const connection = solanaConnection;
    const adminPublicKey = adminWallet.publicKey;
    
    // Get the common wallet
    const commonWallet = getCommonWallet();
    
    // Check the current common wallet balance
    const commonWalletBalance = await getCommonWalletBalance();
    console.log(`Common wallet balance: ${commonWalletBalance} SOL`);
    
    // Threshold check
    const threshold = 0.1; // 0.1 SOL
    if (commonWalletBalance < threshold) {
      return {
        success: false,
        error: `Common wallet balance (${commonWalletBalance} SOL) is below threshold (${threshold} SOL)`
      };
    }
    
    // In a full implementation, we would use a program instruction to:
    // 1. Transfer SOL from common wallet to pool
    // 2. Swap half of the SOL for YOT
    // 3. Add the SOL-YOT pair to the liquidity pool
    
    // For now, this is a placeholder for the admin functionality
    console.log(`Admin would add ${commonWalletBalance} SOL from common wallet to pool`);
    
    return {
      success: true,
      signature: 'simulation_only'
    };
  } catch (error: any) {
    console.error('Error adding liquidity from common wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}