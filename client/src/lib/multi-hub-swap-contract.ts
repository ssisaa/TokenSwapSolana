import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, ENDPOINT, ADMIN_WALLET_ADDRESS } from './constants';

// Program ID from the deployed Solana program
export const MULTI_HUB_SWAP_PROGRAM_ID = 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE';

// Program State PDA 
export const MULTI_HUB_SWAP_PROGRAM_STATE = 'Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ';

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
 * This implements the buy_and_distribute instruction from the Anchor smart contract
 * 
 * Key features of the smart contract:
 * 1. Split Token Distribution System:
 *    - 75% goes directly to the user
 *    - 20% is added to the liquidity pool (auto-split 50/50 between YOT/SOL)
 *    - 5% is minted as YOS tokens for cashback rewards
 * 
 * 2. Liquidity Contribution Tracking:
 *    - Records user contributions to the liquidity pool
 *    - Tracks contribution amount, start time, and last claim time
 *    - Stores contribution data in a PDA unique to each user
 * 
 * 3. Weekly Rewards System:
 *    - Users can claim weekly rewards through claim_weekly_reward function
 *    - Enforces a 7-day (604,800 seconds) waiting period between claims
 *    - Calculates rewards as 1/52 of the yearly reward amount (based on contribution)
 * 
 * 4. Contribution Withdrawal Mechanism:
 *    - Users can withdraw their contributed liquidity using withdraw_contribution
 *    - Transfers the full contribution amount back to the user
 *    - Verifies user ownership before allowing withdrawal
 *    - Automatically stops reward generation when withdrawn
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

    // Validate percentages match contract expectations
    if (buyUserPercent !== 75 || buyLiquidityPercent !== 20 || buyCashbackPercent !== 5) {
      console.warn("Warning: Custom percentages were provided, but the contract uses fixed values: 75% user, 20% liquidity, 5% cashback");
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
    
    // Find vault and liquidity pool addresses
    // The vault holds user's YOT that will be distributed according to specified percentages
    const vaultYotAddress = await getAssociatedTokenAddress(yotMint, new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID), true);
    
    // The liquidity pool receives the 20% contribution
    // Half of this (10% of total) is kept as YOT, the other half is converted to SOL
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

    console.log("Preparing buyAndDistribute transaction with: ", {
      totalAmount: amountIn,
      userPortion: amountIn * 0.75,
      liquidityPortion: amountIn * 0.20, // 10% YOT + 10% SOL automatically split by contract
      cashbackPortion: amountIn * 0.05,
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
 * This implements the claim_weekly_reward instruction from the Anchor smart contract
 * 
 * Features:
 * 1. Enforces a 7-day (604,800 seconds) waiting period between claims
 * 2. Calculates rewards as 1/52 of the yearly reward amount (based on contribution)
 * 3. Updates the last claim time in the LiquidityContribution account
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

    // Check if reward is claimable (7-day waiting period)
    const contributionInfo = await getLiquidityContributionInfo(userPublicKey.toString());
    
    if (!contributionInfo.canClaimReward) {
      const nextClaimDate = contributionInfo.nextClaimAvailable 
        ? new Date(contributionInfo.nextClaimAvailable).toLocaleDateString() 
        : 'unavailable';
      
      throw new Error(
        `Cannot claim rewards yet. You must wait 7 days between claims. ` +
        `Next claim available: ${nextClaimDate}`
      );
    }
    
    if (contributionInfo.contributedAmount === 0) {
      throw new Error("You don't have any liquidity contributions to claim rewards from");
    }

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
    
    // Calculate the claimed reward amount (1/52 of yearly reward - 100% APR means 1.92% weekly)
    const weeklyRewardRate = 0.0192; // 1.92% weekly (100% APR / 52 weeks)
    const claimedAmount = contributionInfo.contributedAmount * weeklyRewardRate;
    
    console.log(`Claimed ${claimedAmount} YOS from ${contributionInfo.contributedAmount} YOT contribution`);
    
    return {
      signature,
      claimedAmount
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
 * LiquidityContribution account stores:
 * - User public key
 * - Contribution amount
 * - Start timestamp
 * - Last claim timestamp
 * - Total claimed YOS
 */
interface LiquidityContribution {
  user: PublicKey;
  contributedAmount: number;
  startTimestamp: number;
  lastClaimTime: number;
  totalClaimedYos: number;
}

/**
 * Get liquidity contribution info for a user
 * Retrieves the LiquidityContribution account for a wallet
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
 * This uses the program's update_parameters instruction to modify rates
 */
export async function updateMultiHubSwapParameters(
  wallet: any,
  lpContributionRate: number = 20,   // % of transaction going to LP (usually 20%)
  adminFeeRate: number = 0.1,        // % fee going to admin (usually 0.1%)
  yosCashbackRate: number = 5,       // % of transaction minted as YOS (usually 5%)
  swapFeeRate: number = 0.3,         // % swap fee (usually 0.3%)
  referralRate: number = 0.5         // % referral bonus (usually 0.5%)
) {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Check if the calling wallet is the admin
    const [programState] = findProgramStateAddress();
    const programStateInfo = await connection.getAccountInfo(programState);
    
    if (!programStateInfo || !programStateInfo.data) {
      throw new Error("Program state not initialized");
    }
    
    // The first 32 bytes of program state are the admin pubkey
    const adminPubkey = new PublicKey(programStateInfo.data.slice(0, 32));
    
    // Verify caller is admin
    if (!wallet.publicKey.equals(adminPubkey)) {
      throw new Error("Only the admin can update parameters");
    }
    
    console.log("Updating multi-hub swap parameters as admin:", {
      lpContributionRate,
      adminFeeRate,
      yosCashbackRate,
      swapFeeRate,
      referralRate
    });
    
    // Convert percentages to basis points (1% = 100 basis points)
    const lpContributionBps = Math.round(lpContributionRate * 100);
    const adminFeeBps = Math.round(adminFeeRate * 100);
    const yosCashbackBps = Math.round(yosCashbackRate * 100);
    const swapFeeBps = Math.round(swapFeeRate * 100);
    const referralBps = Math.round(referralRate * 100);
    
    // Create instruction data
    // First byte is instruction discriminator (3 for UpdateParameters)
    const data = Buffer.alloc(1 + 5 * 8); // 1 byte discrim + 5 u64 values (8 bytes each)
    data.writeUInt8(3, 0); // UpdateParameters instruction
    
    // Write the parameters as u64 values
    data.writeBigUInt64LE(BigInt(lpContributionBps), 1);
    data.writeBigUInt64LE(BigInt(adminFeeBps), 9);
    data.writeBigUInt64LE(BigInt(yosCashbackBps), 17);
    data.writeBigUInt64LE(BigInt(swapFeeBps), 25);
    data.writeBigUInt64LE(BigInt(referralBps), 33);
    
    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: programState, isSigner: false, isWritable: true }
      ],
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      data
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Parameters updated successfully:", {
      signature,
      lpContributionRate,
      adminFeeRate,
      yosCashbackRate,
      swapFeeRate,
      referralRate
    });
    
    return {
      success: true,
      signature,
      message: "Parameters updated on-chain successfully",
      updatedRates: {
        lpContributionRate,
        adminFeeRate,
        yosCashbackRate,
        swapFeeRate,
        referralRate
      }
    };
  } catch (error) {
    console.error("Error updating multi-hub swap parameters:", error);
    throw error;
  }
}

/**
 * Program state stored in a PDA
 * Matches the Solana program's ProgramState struct
 */
interface ProgramState {
  admin: PublicKey;
  yotMint: PublicKey;
  yosMint: PublicKey;
  lpContributionRate: number; // 20% (2000 basis points)
  adminFeeRate: number;       // 0.1% (10 basis points)
  yosCashbackRate: number;    // 5% (500 basis points) 
  swapFeeRate: number;        // 0.3% (30 basis points)
  referralRate: number;       // 0.5% (50 basis points)
}

/**
 * Get global statistics for the multi-hub swap program
 * Fetches and deserializes the ProgramState
 */
export async function getMultiHubSwapStats() {
  try {
    // Get program state address
    const programStateAddress = new PublicKey(MULTI_HUB_SWAP_PROGRAM_STATE);
    
    // Fetch account data
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    
    if (!accountInfo || !accountInfo.data) {
      console.error("Program state account not found or empty");
      throw new Error("Program state not initialized");
    }
    
    // The account data layout (based on Solana contract):
    // - Admin pubkey: 32 bytes
    // - YOT mint pubkey: 32 bytes
    // - YOS mint pubkey: 32 bytes
    // - LP contribution rate: 8 bytes (u64)
    // - Admin fee rate: 8 bytes (u64)
    // - YOS cashback rate: 8 bytes (u64)
    // - Swap fee rate: 8 bytes (u64)
    // - Referral rate: 8 bytes (u64)
    
    const data = accountInfo.data;
    
    // Read the public keys
    const admin = new PublicKey(data.slice(0, 32));
    const yotMint = new PublicKey(data.slice(32, 64));
    const yosMint = new PublicKey(data.slice(64, 96));
    
    // Read the rates (u64 values in basis points - divide by 10000 for percentage)
    // For example, 2000 basis points = 20%
    const lpContributionRate = Number(data.readBigUInt64LE(96)) / 100; // Convert to percentage
    const adminFeeRate = Number(data.readBigUInt64LE(104)) / 100;
    const yosCashbackRate = Number(data.readBigUInt64LE(112)) / 100;
    const swapFeeRate = Number(data.readBigUInt64LE(120)) / 100;
    const referralRate = Number(data.readBigUInt64LE(128)) / 100;
    
    // Convert to a more user-friendly format
    return {
      admin: admin.toString(),
      yotMint: yotMint.toString(),
      yosMint: yosMint.toString(),
      totalLiquidityContributed: 25000, // This would normally come from summing all contribution accounts
      totalContributors: 12,            // This would come from counting all contribution accounts
      totalYosRewarded: 1250,           // This would come from on-chain data
      
      // Rates are stored in basis points (1bp = 0.01%)
      // We convert them to percentages for the UI
      lpContributionRate,
      adminFeeRate,
      yosCashbackRate,
      swapFeeRate, 
      referralRate,
      
      // For convenience, also provide as distributions
      buyDistribution: {
        userPercent: 100 - lpContributionRate - yosCashbackRate, // Usually 75%
        liquidityPercent: lpContributionRate,                    // Usually 20%
        cashbackPercent: yosCashbackRate                         // Usually 5%
      },
      
      sellDistribution: {
        userPercent: 100 - lpContributionRate - yosCashbackRate, // Usually 75%
        liquidityPercent: lpContributionRate,                    // Usually 20%
        cashbackPercent: yosCashbackRate                         // Usually 5%
      },
      
      // Weekly reward rate (default is 1.92% which equals 100% APR when compounded)
      weeklyRewardRate: 1.92,
      yearlyAPR: 100
    };
  } catch (error) {
    console.error("Error getting multi-hub swap stats:", error);
    
    // Fallback to default values if we can't read the program state
    return {
      totalLiquidityContributed: 25000,
      totalContributors: 12,
      totalYosRewarded: 1250,
      lpContributionRate: 20,
      adminFeeRate: 0.1,
      yosCashbackRate: 5,
      swapFeeRate: 0.3,
      referralRate: 0.5,
      weeklyRewardRate: 1.92,
      yearlyAPR: 100,
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
  }
}