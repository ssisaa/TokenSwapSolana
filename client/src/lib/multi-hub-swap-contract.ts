import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, ENDPOINT } from './constants';

// Program ID from the deployed Anchor program
export const MULTI_HUB_SWAP_PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWxqSWib32jBzv4U5mpdKqHR3rXY';

// Connection to Solana network
export const connection = new Connection(ENDPOINT, 'confirmed');

// Instruction discriminators for the program
const BUY_AND_DISTRIBUTE_DISCRIMINATOR = Buffer.from([97, 208, 4, 103, 223, 94, 26, 42]);
const CLAIM_REWARD_DISCRIMINATOR = Buffer.from([140, 176, 3, 173, 23, 2, 90, 79]);
const WITHDRAW_CONTRIBUTION_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

/**
 * Find the program state PDA
 */
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find the liquidity contribution account for a user
 */
export function findLiquidityContributionAddress(userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liq"), userWallet.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Encode a u64 for the program
 */
function encodeU64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

/**
 * Buy and distribute YOT tokens with cashback in YOS
 * This implements the buy_and_distribute instruction from the program
 */
export async function buyAndDistribute(
  wallet: any,
  amountIn: number,
  buyUserPercent: number = 75,
  buyLiquidityPercent: number = 20,
  buyCashbackPercent: number = 5
): Promise<string> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);

    // Find user's token accounts
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);

    // Find program controlled accounts
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    
    // Find vault and liquidity pool addresses (these would be program controlled accounts)
    const vaultYotAddress = await getAssociatedTokenAddress(yotMint, new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID), true);
    const liquidityYotAddress = await getAssociatedTokenAddress(yotMint, new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID), true);

    // Convert amount to raw token amount
    const rawAmount = Math.floor(amountIn * Math.pow(10, 9)); // Assuming 9 decimals for YOT/YOS

    // Create the instruction data
    const data = Buffer.concat([
      BUY_AND_DISTRIBUTE_DISCRIMINATOR,
      encodeU64(rawAmount)
    ]);

    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: vaultYotAddress, isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: liquidityYotAddress, isSigner: false, isWritable: true },
        { pubkey: yosMint, isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: program,
      data
    });

    // Create and sign transaction
    const transaction = new Transaction().add(instruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userPublicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Buy and distribute transaction confirmed:", signature);
    
    return signature;
  } catch (error) {
    console.error("Error in buyAndDistribute:", error);
    throw error;
  }
}

/**
 * Claim weekly YOS rewards from liquidity contributions
 * This implements the claim_weekly_reward instruction from the program
 */
export async function claimWeeklyYosReward(wallet: any): Promise<{ signature: string, claimedAmount: number }> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);

    // Find user's token accounts
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);

    // Find program controlled accounts
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);

    // Create the instruction data
    const data = CLAIM_REWARD_DISCRIMINATOR;

    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
        { pubkey: yosMint, isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      programId: program,
      data
    });

    // Create and sign transaction
    const transaction = new Transaction().add(instruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userPublicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Claim reward transaction confirmed:", signature);
    
    // Get liquidity contribution account to calculate claimed amount
    // This would typically be retrieved from on-chain data after the transaction
    const liquidityContributionInfo = await getLiquidityContributionInfo(userPublicKey.toString());
    const yearlyReward = liquidityContributionInfo.contributedAmount;
    const weeklyReward = yearlyReward / 52;
    
    return {
      signature,
      claimedAmount: weeklyReward
    };
  } catch (error) {
    console.error("Error in claimWeeklyYosReward:", error);
    throw error;
  }
}

/**
 * Withdraw liquidity contribution
 * This implements the withdraw_contribution instruction from the program
 */
export async function withdrawLiquidityContribution(wallet: any): Promise<{ signature: string, withdrawnAmount: number }> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);

    // Find user's token account
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);

    // Find program controlled accounts
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    const liquidityYotAddress = await getAssociatedTokenAddress(yotMint, new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID), true);

    // Get the current contribution amount before withdrawal
    const liquidityContributionInfo = await getLiquidityContributionInfo(userPublicKey.toString());
    const withdrawnAmount = liquidityContributionInfo.contributedAmount;

    // Create the instruction data
    const data = WITHDRAW_CONTRIBUTION_DISCRIMINATOR;

    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
        { pubkey: liquidityYotAddress, isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      programId: program,
      data
    });

    // Create and sign transaction
    const transaction = new Transaction().add(instruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userPublicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Withdraw contribution transaction confirmed:", signature);
    
    return {
      signature,
      withdrawnAmount
    };
  } catch (error) {
    console.error("Error in withdrawLiquidityContribution:", error);
    throw error;
  }
}

/**
 * Get liquidity contribution info for a user
 */
export async function getLiquidityContributionInfo(walletAddressStr: string): Promise<{
  contributedAmount: number;
  startTimestamp: number;
  lastClaimTime: number;
  totalClaimedYos: number;
  canClaimReward: boolean;
  nextClaimAvailable: string | null;
  estimatedWeeklyReward: number;
}> {
  try {
    const walletAddress = new PublicKey(walletAddressStr);
    const [liquidityContributionAddress] = findLiquidityContributionAddress(walletAddress);
    
    try {
      // Attempt to fetch the account data
      const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
      
      if (!accountInfo || !accountInfo.data) {
        // Account doesn't exist, return default values
        return {
          contributedAmount: 0,
          startTimestamp: 0,
          lastClaimTime: 0,
          totalClaimedYos: 0,
          canClaimReward: false,
          nextClaimAvailable: null,
          estimatedWeeklyReward: 0
        };
      }
      
      // Parse the account data according to our schema
      // Assuming data layout: 32 bytes for user pubkey, 8 bytes for amount, 8 bytes for start_time, 8 bytes for last_claim_time
      const data = accountInfo.data;
      const amount = data.readBigUInt64LE(32);
      const startTime = data.readBigInt64LE(40);
      const lastClaimTime = data.readBigInt64LE(48);
      
      // Convert to UI values
      const contributedAmount = Number(amount) / Math.pow(10, 9); // Assuming 9 decimals for YOT
      const startTimestamp = Number(startTime) * 1000; // Convert to milliseconds
      const lastClaimTimeMs = Number(lastClaimTime) * 1000; // Convert to milliseconds
      
      // Calculate next claim time (7 days after last claim)
      const nextClaimTime = lastClaimTimeMs + (7 * 24 * 60 * 60 * 1000);
      const now = Date.now();
      const canClaimReward = now >= nextClaimTime;
      
      // Calculate estimated weekly reward (1.92% of contributed amount - 100% APR / 52 weeks)
      const estimatedWeeklyReward = contributedAmount * 0.0192;
      
      // Calculate total claimed YOS (estimating based on time since start)
      const weeksSinceStart = Math.floor((now - startTimestamp) / (7 * 24 * 60 * 60 * 1000));
      const totalClaimedYos = weeksSinceStart * estimatedWeeklyReward;
      
      return {
        contributedAmount,
        startTimestamp,
        lastClaimTime: lastClaimTimeMs,
        totalClaimedYos,
        canClaimReward,
        nextClaimAvailable: canClaimReward ? null : new Date(nextClaimTime).toISOString(),
        estimatedWeeklyReward
      };
    } catch (error) {
      console.error("Error fetching liquidity contribution account:", error);
      // If there's an error fetching the account, assume it doesn't exist
      return {
        contributedAmount: 0,
        startTimestamp: 0,
        lastClaimTime: 0,
        totalClaimedYos: 0,
        canClaimReward: false,
        nextClaimAvailable: null,
        estimatedWeeklyReward: 0
      };
    }
  } catch (error) {
    console.error("Error in getLiquidityContributionInfo:", error);
    throw error;
  }
}

/**
 * Update multi-hub swap parameters (admin only)
 */
export async function updateMultiHubSwapParameters(
  wallet: any,
  buyUserPercent: number = 75,
  buyLiquidityPercent: number = 20,
  buyCashbackPercent: number = 5,
  sellUserPercent: number = 75,
  sellLiquidityPercent: number = 20,
  sellCashbackPercent: number = 5,
  weeklyRewardRate: number = 1.92
) {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // In a real implementation, we would:
    // 1. Create an admin-only instruction to update parameters
    // 2. Send and confirm a transaction
    
    console.log("Admin would update these parameters on-chain:", {
      buyDistribution: {
        userPercent: buyUserPercent,
        liquidityPercent: buyLiquidityPercent,
        cashbackPercent: buyCashbackPercent
      },
      sellDistribution: {
        userPercent: sellUserPercent,
        liquidityPercent: sellLiquidityPercent,
        cashbackPercent: sellCashbackPercent
      },
      weeklyRewardRate
    });
    
    // For now, we'll return a mock success response
    return {
      success: true,
      message: "Parameters would be updated on-chain by admin"
    };
  } catch (error) {
    console.error("Error updating multi-hub swap parameters:", error);
    throw error;
  }
}

/**
 * Get global statistics for the multi-hub swap program
 */
export async function getMultiHubSwapStats() {
  try {
    // In a full implementation:
    // 1. Get the program state account
    // 2. Deserialize and return statistics
    
    // For now, we'll return simulated data
    return {
      totalLiquidityContributed: 25000,
      totalContributors: 12,
      totalYosRewarded: 1250,
      weeklyRewardRate: 1.92, // 1.92% per week (100% APR / 52 weeks)
      yearlyAPR: 100, // 100% APR
      buyDistribution: {
        userPercent: 75,
        liquidityPercent: 20,
        cashbackPercent: 5
      },
      sellDistribution: {
        userPercent: 75,
        liquidityPercent: 20,
        cashbackPercent: 5
      }
    };
  } catch (error) {
    console.error("Error getting multi-hub swap stats:", error);
    throw error;
  }
}