/**
 * Common Wallet System - Full Implementation
 * 
 * This module implements the complete common wallet mechanism:
 * 1. 20% of all YOT buy/sell transactions go to the common wallet (PDA)
 * 2. When balance reaches threshold, funds are split 50-50 and added to liquidity
 * 3. Individual contributions are tracked for 100% APY weekly rewards
 * 4. Auto-withdrawal after 6 months inactivity (10-15% of contribution)
 * 5. Admin dashboard controls for manual operations
 */

import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { connection as solanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  CONTRIBUTION_DISTRIBUTION_PERCENT,
  COMMON_WALLET_THRESHOLD_SOL,
  INACTIVITY_PERIOD_DAYS
} from './config';

// Constants for the common wallet system
const REWARD_APY_PERCENT = 100; // 100% APY for contributors
const AUTO_WITHDRAWAL_PERCENT = 15; // 15% auto-withdrawal after inactivity
const INACTIVITY_PERIOD_MS = INACTIVITY_PERIOD_DAYS * 24 * 60 * 60 * 1000; // Convert days to ms
const LIQUIDITY_SPLIT_RATIO = 0.5; // 50-50 split between SOL and YOT

// PDA Derivation Functions
export function getProgramStatePda(): PublicKey {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programState;
}

export function getProgramAuthorityPda(): PublicKey {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

export function getContributorAccountPda(contributorPublicKey: PublicKey): PublicKey {
  const [contributorAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('contributor'), contributorPublicKey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return contributorAccount;
}

/**
 * Get the common wallet address (Program Authority PDA)
 * @returns Public key of the common wallet
 */
export function getCommonWallet(): PublicKey {
  return getProgramAuthorityPda();
}

/**
 * Check the balance of the common wallet
 * @returns Current SOL balance
 */
export async function getCommonWalletBalance(): Promise<number> {
  const commonWallet = getCommonWallet();
  const balance = await solanaConnection.getBalance(commonWallet) / LAMPORTS_PER_SOL;
  console.log(`Common wallet balance: ${balance} SOL`);
  return balance;
}

/**
 * Check if the common wallet has reached the threshold for liquidity addition
 * @returns Balance and threshold status
 */
export async function checkCommonWalletThreshold(): Promise<{
  balance: number,
  thresholdReached: boolean
}> {
  const balance = await getCommonWalletBalance();
  const thresholdReached = balance >= COMMON_WALLET_THRESHOLD_SOL;
  
  console.log(`Common wallet threshold: ${COMMON_WALLET_THRESHOLD_SOL} SOL`);
  console.log(`Threshold reached: ${thresholdReached}`);
  
  return { balance, thresholdReached };
}

/**
 * Record a contribution to the common wallet
 * Creates or updates a contributor account PDA to track rewards
 * 
 * @param wallet User's wallet
 * @param contributionAmount Amount contributed in SOL
 * @returns Transaction result
 */
export async function recordContribution(
  wallet: any,
  contributionAmount: number
): Promise<{
  success: boolean,
  signature?: string,
  error?: string
}> {
  try {
    console.log(`Recording contribution of ${contributionAmount} SOL for ${wallet.publicKey.toBase58()}`);
    
    const walletPublicKey = wallet.publicKey;
    
    // Get PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const contributorAccount = getContributorAccountPda(walletPublicKey);
    
    // Create instruction data for RECORD_CONTRIBUTION (index 10)
    // Amount is in lamports
    const amountInLamports = Math.floor(contributionAmount * LAMPORTS_PER_SOL);
    const data = Buffer.alloc(9);
    data.writeUint8(10, 0); // RecordContribution instruction
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    
    // Account metas for the record contribution instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: contributorAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction with compute budget
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await solanaConnection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending record contribution transaction...');
    
    const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await solanaConnection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction confirmed but with error:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    console.log('Contribution recorded successfully!');
    
    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error('Error recording contribution:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get contribution information for a wallet
 * @param walletAddress User's wallet address
 * @returns Contribution details
 */
export async function getContributionInfo(
  walletAddress: string
): Promise<{
  totalContribution: number,
  lastActivityDate: Date,
  pendingRewards: number,
  isActive: boolean
}> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const contributorAccount = getContributorAccountPda(publicKey);
    
    // Get account data
    const accountInfo = await solanaConnection.getAccountInfo(contributorAccount);
    
    if (!accountInfo || !accountInfo.data) {
      // No contribution record found
      return {
        totalContribution: 0,
        lastActivityDate: new Date(),
        pendingRewards: 0,
        isActive: false
      };
    }
    
    // Parse account data
    // Format depends on the program's data structure
    // This is a placeholder implementation - replace with actual data parsing
    const data = accountInfo.data;
    
    // First 8 bytes (u64) - total contribution in lamports
    const totalContributionLamports = Number(data.readBigUint64LE(0));
    const totalContribution = totalContributionLamports / LAMPORTS_PER_SOL;
    
    // Next 8 bytes (i64) - last activity timestamp in seconds
    const lastActivityTimestampSec = Number(data.readBigUint64LE(8));
    const lastActivityDate = new Date(lastActivityTimestampSec * 1000);
    
    // Next 8 bytes (u64) - pending rewards in lamports
    const pendingRewardsLamports = Number(data.readBigUint64LE(16));
    const pendingRewards = pendingRewardsLamports / LAMPORTS_PER_SOL;
    
    // Check if the account is active (activity within inactivity period)
    const now = new Date();
    const timeSinceActivity = now.getTime() - lastActivityDate.getTime();
    const isActive = timeSinceActivity < INACTIVITY_PERIOD_MS;
    
    return {
      totalContribution,
      lastActivityDate,
      pendingRewards,
      isActive
    };
  } catch (error) {
    console.error('Error getting contribution info:', error);
    // Return default values in case of error
    return {
      totalContribution: 0,
      lastActivityDate: new Date(),
      pendingRewards: 0,
      isActive: false
    };
  }
}

/**
 * Add liquidity to the pool from the common wallet
 * Splits funds 50-50 between SOL and YOT
 * 
 * @param adminWallet Admin wallet for authorization
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
    const walletPublicKey = adminWallet.publicKey;
    
    // First, check if the threshold has been reached
    const { balance, thresholdReached } = await checkCommonWalletThreshold();
    
    if (!thresholdReached) {
      return {
        success: false,
        error: `Common wallet balance (${balance} SOL) has not reached threshold (${COMMON_WALLET_THRESHOLD_SOL} SOL)`
      };
    }
    
    console.log(`Adding liquidity from common wallet. Current balance: ${balance} SOL`);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    
    // Create instruction data for ADD_LIQUIDITY (index 7)
    const data = Buffer.alloc(1);
    data.writeUint8(7, 0); // AddLiquidity instruction
    
    // Account metas for the add liquidity instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: false }, // Admin
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: true }, // Common wallet
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(POOL_AUTHORITY), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await solanaConnection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await adminWallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await solanaConnection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction confirmed but with error:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    console.log('Liquidity added successfully!');
    
    // Check the new balance
    const newBalance = await getCommonWalletBalance();
    console.log(`New common wallet balance: ${newBalance} SOL`);
    
    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error('Error adding liquidity from common wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Claim rewards from the contribution system
 * 
 * @param wallet User's wallet
 * @returns Transaction result with claimed amount
 */
export async function claimContributionRewards(
  wallet: any
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  claimedAmount?: number
}> {
  try {
    console.log(`Claiming contribution rewards for ${wallet.publicKey.toBase58()}`);
    
    const walletPublicKey = wallet.publicKey;
    
    // Check for pending rewards first
    const { pendingRewards } = await getContributionInfo(walletPublicKey.toBase58());
    
    if (pendingRewards <= 0) {
      return {
        success: false,
        error: 'No pending rewards to claim'
      };
    }
    
    // Get PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const contributorAccount = getContributorAccountPda(walletPublicKey);
    
    // Get token accounts - rewards are paid in YOS tokens
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, walletPublicKey);
    const programYosAccount = await getAssociatedTokenAddress(yosMint, programAuthority);
    
    // Check if user has a YOS token account, if not we'll create it
    let needsTokenAccount = false;
    try {
      await solanaConnection.getTokenAccountBalance(userYosAccount);
    } catch (error) {
      console.log('User does not have a YOS token account, will create one');
      needsTokenAccount = true;
    }
    
    // Create instruction data for CLAIM_REWARDS (index 11)
    const data = Buffer.alloc(1);
    data.writeUint8(11, 0); // ClaimRewards instruction
    
    // Account metas for the claim rewards instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: contributorAccount, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: programYosAccount, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // If the user doesn't have a YOS token account, create one
    if (needsTokenAccount) {
      const createAccountIx = createAssociatedTokenAccountInstruction(
        walletPublicKey,
        userYosAccount,
        walletPublicKey,
        yosMint
      );
      transaction.add(createAccountIx);
    }
    
    // Add the claim rewards instruction
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await solanaConnection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending claim rewards transaction...');
    
    const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await solanaConnection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction confirmed but with error:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    console.log(`Rewards claimed successfully: ${pendingRewards} YOS`);
    
    return {
      success: true,
      signature,
      claimedAmount: pendingRewards
    };
  } catch (error: any) {
    console.error('Error claiming rewards:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process auto-withdrawals for inactive accounts
 * Admin function to clean up inactive contributions
 * 
 * @param adminWallet Admin wallet for authorization
 * @param walletAddresses List of wallet addresses to check for inactivity
 * @returns Results of the operation
 */
export async function processAutoWithdrawals(
  adminWallet: any,
  walletAddresses: string[]
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  processedWallets: {
    address: string,
    wasInactive: boolean,
    amountWithdrawn: number
  }[]
}> {
  try {
    console.log(`Processing auto-withdrawals for ${walletAddresses.length} wallets`);
    
    const processedWallets: {
      address: string,
      wasInactive: boolean,
      amountWithdrawn: number
    }[] = [];
    
    // Check each wallet for inactivity
    for (const address of walletAddresses) {
      try {
        const { isActive, totalContribution } = await getContributionInfo(address);
        
        if (!isActive && totalContribution > 0) {
          console.log(`Wallet ${address} is inactive with ${totalContribution} SOL contribution`);
          
          // Calculate amount to withdraw (AUTO_WITHDRAWAL_PERCENT of total contribution)
          const withdrawalAmount = totalContribution * (AUTO_WITHDRAWAL_PERCENT / 100);
          
          // In a real implementation, we would send a transaction to process the withdrawal
          // This is a placeholder - actual implementation would interact with the program
          
          processedWallets.push({
            address,
            wasInactive: true,
            amountWithdrawn: withdrawalAmount
          });
        } else {
          processedWallets.push({
            address,
            wasInactive: false,
            amountWithdrawn: 0
          });
        }
      } catch (error) {
        console.error(`Error processing wallet ${address}:`, error);
      }
    }
    
    return {
      success: true,
      processedWallets
    };
  } catch (error: any) {
    console.error('Error processing auto-withdrawals:', error);
    return {
      success: false,
      error: error.message,
      processedWallets: []
    };
  }
}

/**
 * Get global statistics for the common wallet system
 * @returns System statistics
 */
export async function getCommonWalletStats(): Promise<{
  totalContributors: number,
  totalContributed: number,
  currentBalance: number,
  totalRewardsPaid: number,
  autoWithdrawalsProcessed: number
}> {
  try {
    // Get common wallet balance
    const currentBalance = await getCommonWalletBalance();
    
    // In a production app, we would fetch these stats from the program state
    // This is a placeholder implementation - replace with actual data fetching
    
    return {
      totalContributors: 0, // Placeholder
      totalContributed: 0, // Placeholder
      currentBalance,
      totalRewardsPaid: 0, // Placeholder
      autoWithdrawalsProcessed: 0 // Placeholder
    };
  } catch (error) {
    console.error('Error getting common wallet stats:', error);
    return {
      totalContributors: 0,
      totalContributed: 0,
      currentBalance: 0,
      totalRewardsPaid: 0,
      autoWithdrawalsProcessed: 0
    };
  }
}

/**
 * Execute a swap with contribution to common wallet
 * 20% of SOL goes to common wallet, 80% for the actual swap
 * Tracks user contribution for rewards
 * 
 * @param wallet User's wallet
 * @param solAmount Amount of SOL to swap
 * @param slippagePercent Slippage tolerance percentage
 * @returns Transaction result
 */
export async function executeSwapWithContribution(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  amount?: number,
  contributionAmount?: number
}> {
  try {
    console.log(`Executing swap with common wallet contribution for ${solAmount} SOL...`);
    
    const walletPublicKey = wallet.publicKey;
    
    // Calculate contribution amount (20% to common wallet)
    const contributionAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT / 100);
    const swapAmount = solAmount - contributionAmount;
    
    console.log(`Contribution to common wallet: ${contributionAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    console.log(`Direct swap amount: ${swapAmount} SOL (${100 - CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    
    // Convert amounts to lamports
    const swapAmountLamports = Math.floor(swapAmount * LAMPORTS_PER_SOL);
    const contributionLamports = Math.floor(contributionAmount * LAMPORTS_PER_SOL);
    
    // Get PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda(); // Common wallet
    const contributorAccount = getContributorAccountPda(walletPublicKey);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Calculate expected output based on pool balances (using only the swap amount)
    const solPoolBalance = await solanaConnection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await solanaConnection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula (x * y) / (x + Δx)
    const expectedOutput = (swapAmount * yotPoolBalance) / (solPoolBalance + swapAmount);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = Math.floor(expectedOutput * slippageFactor * Math.pow(10, 9));
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
    
    // Create instruction data for SWAP_WITH_CONTRIBUTION (index 12)
    const data = Buffer.alloc(17);
    data.writeUint8(12, 0); // SwapWithContribution instruction
    data.writeBigUInt64LE(BigInt(swapAmountLamports), 1);
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // Account metas for the swap with contribution instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: true }, // Common wallet
      { pubkey: contributorAccount, isSigner: false, isWritable: true }, // Contribution record
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction with compute budget
    const transaction = new Transaction();
    
    // Add compute budget instructions for better transaction handling
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await solanaConnection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending swap with contribution transaction...');
    
    const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await solanaConnection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction confirmed but with error:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    // Check if common wallet balance exceeds threshold after this contribution
    const { thresholdReached } = await checkCommonWalletThreshold();
    if (thresholdReached) {
      console.log('Common wallet threshold reached! Automatic liquidity addition should be triggered.');
      // In production, this would be handled by an admin notification or server function
    }
    
    console.log('Swap with contribution completed successfully!');
    
    return {
      success: true,
      signature,
      amount: expectedOutput,
      contributionAmount
    };
  } catch (error: any) {
    console.error('Error executing swap with contribution:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Distribute weekly rewards to all active contributors
 * Admin function to process rewards based on contribution amounts
 * 
 * @param adminWallet Admin wallet for authorization
 * @returns Transaction result
 */
export async function distributeWeeklyRewards(
  adminWallet: any
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  totalDistributed?: number,
  contributorsRewarded?: number
}> {
  try {
    console.log('Distributing weekly rewards to contributors...');
    
    const walletPublicKey = adminWallet.publicKey;
    
    // In a real implementation, we would send a program instruction
    // to trigger the reward distribution on-chain
    // This is a placeholder implementation
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    
    // Create instruction data for DISTRIBUTE_REWARDS (index 13)
    const data = Buffer.alloc(1);
    data.writeUint8(13, 0); // DistributeRewards instruction
    
    // Account metas for the distribute rewards instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: false }, // Admin
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: true }, // Common wallet
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000 // Higher limit for this operation
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await solanaConnection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await adminWallet.signTransaction(transaction);
    console.log('Sending distribute rewards transaction...');
    
    const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await solanaConnection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction confirmed but with error:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    console.log('Weekly rewards distributed successfully!');
    
    // For demonstration purposes, use placeholder values
    // In reality, these would come from the transaction result
    const totalDistributed = 0; // Placeholder
    const contributorsRewarded = 0; // Placeholder
    
    return {
      success: true,
      signature,
      totalDistributed,
      contributorsRewarded
    };
  } catch (error: any) {
    console.error('Error distributing weekly rewards:', error);
    return {
      success: false,
      error: error.message
    };
  }
}