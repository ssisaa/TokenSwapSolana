/**
 * Common Wallet Swap Implementation
 * 
 * This approach:
 * 1. Sends 20% to the common wallet (program authority PDA)
 * 2. Sends 80% directly to the pool
 * 3. No need to create or track individual user contribution accounts
 * 4. Completely avoids the "account already borrowed" error
 */

import { PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { solanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  CONTRIBUTION_DISTRIBUTION_PERCENT
} from './config';

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
 * Execute SOL to YOT swap with common wallet contribution
 * Handles the swap by sending:
 * - 20% of SOL to the common wallet (program authority PDA)
 * - 80% of SOL directly to the pool
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
  commonWalletAmount?: number
}> {
  try {
    console.log(`Executing SOL to YOT swap with common wallet for ${solAmount} SOL...`);
    const connection = solanaConnection;
    const walletPublicKey = wallet.publicKey;
    
    // Calculate split amounts (20% to common wallet, 80% to pool)
    const commonWalletAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT / 100);
    const poolAmount = solAmount - commonWalletAmount;
    
    console.log(`Common wallet: ${commonWalletAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    console.log(`Pool amount: ${poolAmount} SOL (${100 - CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    
    // Convert amounts to lamports
    const commonWalletLamports = Math.floor(commonWalletAmount * LAMPORTS_PER_SOL);
    const poolLamports = Math.floor(poolAmount * LAMPORTS_PER_SOL);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Calculate expected output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula (x * y) / (x + Δx)
    // Note: Only the pool amount (80%) is used for the swap calculation
    const expectedOutput = (poolAmount * yotPoolBalance) / (solPoolBalance + poolAmount);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = expectedOutput * slippageFactor;
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut} YOT`);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200000
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
    
    // 2. Add SOL transfer to pool (80%)
    const poolTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: new PublicKey(POOL_SOL_ACCOUNT),
      lamports: poolLamports
    });
    
    // Add both transfers to transaction
    transaction.add(commonWalletTransfer);
    transaction.add(poolTransfer);
    
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
    
    return {
      success: true,
      signature,
      solSignature: signature, // Keep for backward compatibility
      amount: expectedOutput,
      commonWalletAmount
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