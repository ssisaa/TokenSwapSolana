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
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { 
  config, 
  getMultiHubProgramId, 
  getMultiHubProgramPublicKey,
  getTokenAddress,
  getTokenPublicKey,
  getEndpoint
} from './config';

// Program ID and Connection from config
export const MULTI_HUB_SWAP_PROGRAM_ID = getMultiHubProgramId('v4');

// Connection to Solana network
export const connection = new Connection(getEndpoint(), 'confirmed');

// Instruction discriminators for the program
const BUY_AND_DISTRIBUTE_DISCRIMINATOR = Buffer.from([97, 208, 4, 103, 223, 94, 26, 42]);
const CLAIM_REWARD_DISCRIMINATOR = Buffer.from([140, 176, 3, 173, 23, 2, 90, 79]);
const WITHDRAW_CONTRIBUTION_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);
const UPDATE_PARAMS_DISCRIMINATOR = Buffer.from([220, 41, 129, 125, 38, 206, 99, 164]);

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
 * Check if a token account exists for a given user and mint
 */
async function doesTokenAccountExist(
  owner: PublicKey,
  mint: PublicKey
): Promise<boolean> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(mint, owner);
    await getAccount(connection, tokenAccount);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create token account instruction if it doesn't exist
 */
async function createTokenAccountInstructionIfNeeded(
  owner: PublicKey,
  mint: PublicKey,
  transaction: Transaction
): Promise<void> {
  const exists = await doesTokenAccountExist(owner, mint);
  if (!exists) {
    const tokenAccount = await getAssociatedTokenAddress(mint, owner);
    const createATA = createAssociatedTokenAccountInstruction(
      owner,
      tokenAccount,
      owner,
      mint
    );
    transaction.add(createATA);
    console.log(`Adding instruction to create token account for mint ${mint.toString()}`);
  }
}

/**
 * Buy and distribute YOT tokens with cashback in YOS
 * This implements the buy_and_distribute instruction from the program
 * 
 * The Anchor contract handles:
 * 1. 75% of YOT tokens go directly to user
 * 2. 20% of YOT tokens go to SOL-YOT liquidity pool (auto-split 50/50)
 * 3. 5% given as YOS cashback tokens
 * 4. Records user's liquidity contribution for weekly rewards
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
    const yotMint = getTokenPublicKey('YOT');
    const yosMint = getTokenPublicKey('YOS');

    // Create a transaction
    const transaction = new Transaction();

    // 1. Add owner commission payment (initially 0.1% of SOL)
    const ownerWallet = new PublicKey(config.accounts.admin);
    
    // Calculate commission amount using the admin fee rate from config
    const estimatedSolValue = amountIn * 0.0000015; // Approximate SOL value of the YOT
    // Get adminFeeRate from config (in basis points) - convert from basis points to percentage
    const ownerCommissionPercent = config.parameters.swap.adminFeeRate / 100;
    const commissionAmount = estimatedSolValue * (ownerCommissionPercent / 100);
    const commissionLamports = Math.floor(commissionAmount * LAMPORTS_PER_SOL);
    
    console.log(`Adding owner commission: ${commissionAmount} SOL (${commissionLamports} lamports) to admin wallet ${config.accounts?.admin} at rate ${ownerCommissionPercent}%`);
    
    // Only add commission transaction if the amount is greater than 0
    if (commissionLamports > 0) {
      // Create a transfer instruction to send the commission to the owner wallet
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: ownerWallet,
        lamports: commissionLamports
      });
      
      transaction.add(transferInstruction);
    }

    // 2. Ensure token accounts exist
    // Find user's token accounts
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);
    
    // Create token accounts if they don't exist
    await createTokenAccountInstructionIfNeeded(userPublicKey, yotMint, transaction);
    await createTokenAccountInstructionIfNeeded(userPublicKey, yosMint, transaction);

    // 3. Find program controlled accounts
    const [programStateAddress] = findProgramStateAddress();
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    
    // Find vault and liquidity pool addresses
    // The vault holds user's YOT that will be distributed according to specified percentages
    const vaultYotAddress = await getAssociatedTokenAddress(yotMint, programStateAddress, true);
    
    // The liquidity pool receives the 20% contribution
    // Half of this (10% of total) is kept as YOT, the other half is converted to SOL
    const liquidityYotAddress = await getAssociatedTokenAddress(yotMint, programStateAddress, true);

    // Convert amount to raw token amount
    const rawAmount = Math.floor(amountIn * Math.pow(10, 9)); // Assuming 9 decimals for YOT/YOS

    // 4. Create the instruction data
    const data = Buffer.concat([
      BUY_AND_DISTRIBUTE_DISCRIMINATOR,
      encodeU64(rawAmount)
    ]);

    // 5. Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
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

    transaction.add(instruction);

    console.log("Preparing buyAndDistribute transaction with: ", {
      totalAmount: amountIn,
      userPortion: amountIn * (buyUserPercent/100),
      liquidityPortion: amountIn * (buyLiquidityPercent/100), // Auto-split 50/50 by contract
      cashbackPortion: amountIn * (buyCashbackPercent/100),
    });

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
 * 
 * Features:
 * - Enforces a 7-day (604,800 seconds) waiting period between claims
 * - Calculates rewards as 1/52 of the yearly reward amount (based on contribution)
 */
export async function claimWeeklyYosReward(wallet: any): Promise<{ signature: string, claimedAmount: number }> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yosMint = getTokenPublicKey('YOS');

    // Create a transaction
    const transaction = new Transaction();

    // 1. Add owner commission payment based on admin fee rate
    const ownerWallet = new PublicKey(config.accounts.admin);
    
    // We estimate a small fixed amount for commission on claims based on admin fee rate
    const adminFeeRate = config.parameters.swap.adminFeeRate / 100; // Convert basis points to percentage
    const commissionLamports = Math.floor(0.0001 * LAMPORTS_PER_SOL); // Fixed 0.0001 SOL for claims
    
    console.log(`Adding owner commission: ${0.0001} SOL (${commissionLamports} lamports) to admin wallet ${config.accounts?.admin} at rate ${adminFeeRate}%`);
    
    // Add commission transaction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: ownerWallet,
      lamports: commissionLamports
    });
    
    transaction.add(transferInstruction);

    // 2. Ensure YOS token account exists
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);
    await createTokenAccountInstructionIfNeeded(userPublicKey, yosMint, transaction);

    // 3. Find program accounts
    const [programStateAddress] = findProgramStateAddress();
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);

    // 4. Create the instruction data
    const data = CLAIM_REWARD_DISCRIMINATOR;

    // 5. Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
        { pubkey: yosMint, isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      programId: program,
      data
    });

    transaction.add(instruction);

    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userPublicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Claim reward transaction confirmed:", signature);
    
    // Get liquidity contribution account to calculate claimed amount
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
 * 
 * Features:
 * - Transfers the full contribution amount back to the user
 * - Verifies user ownership before allowing withdrawal
 * - Automatically stops reward generation when withdrawn
 */
export async function withdrawLiquidityContribution(wallet: any): Promise<{ signature: string, withdrawnAmount: number }> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = getTokenPublicKey('YOT');

    // Create a transaction
    const transaction = new Transaction();

    // 1. Add owner commission payment based on admin fee rate
    const ownerWallet = new PublicKey(config.accounts.admin);
    
    // We estimate a small fixed amount for commission on withdrawals based on admin fee rate
    const adminFeeRate = config.parameters.swap.adminFeeRate / 100; // Convert basis points to percentage
    const commissionLamports = Math.floor(0.0001 * LAMPORTS_PER_SOL); // Fixed 0.0001 SOL for withdrawals
    
    console.log(`Adding owner commission: ${0.0001} SOL (${commissionLamports} lamports) to admin wallet`);
    
    // Add commission transaction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: ownerWallet,
      lamports: commissionLamports
    });
    
    transaction.add(transferInstruction);

    // 2. Ensure YOT token account exists
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);
    await createTokenAccountInstructionIfNeeded(userPublicKey, yotMint, transaction);

    // 3. Find program accounts
    const [programStateAddress] = findProgramStateAddress();
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    const liquidityYotAddress = await getAssociatedTokenAddress(yotMint, programStateAddress, true);

    // Get the current contribution amount before withdrawal
    const liquidityContributionInfo = await getLiquidityContributionInfo(userPublicKey.toString());
    const withdrawnAmount = liquidityContributionInfo.contributedAmount;

    // 4. Create the instruction data
    const data = WITHDRAW_CONTRIBUTION_DISCRIMINATOR;

    // 5. Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
        { pubkey: liquidityYotAddress, isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      programId: program,
      data
    });

    transaction.add(instruction);

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
        console.log("No liquidity contribution account found");
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
      
      // Parse the account data
      // Account data format (Borsh serialized):
      // - bump (u8): 1 byte
      // - user (PublicKey): 32 bytes
      // - contribution_amount (u64): 8 bytes
      // - start_time (i64): 8 bytes
      // - last_claim_time (i64): 8 bytes
      // - total_claimed (u64): 8 bytes
      
      const data = accountInfo.data;
      
      // Skip the bump and pubkey
      const contributionAmount = data.readBigUInt64LE(33); // 1 (bump) + 32 (pubkey)
      const startTime = Number(data.readBigInt64LE(41)); // 33 + 8
      const lastClaimTime = Number(data.readBigInt64LE(49)); // 41 + 8
      const totalClaimed = data.readBigUInt64LE(57); // 49 + 8
      
      // Convert raw values to user-friendly format
      const contributedAmountDecimal = Number(contributionAmount) / Math.pow(10, 9); // 9 decimals for YOT
      const totalClaimedDecimal = Number(totalClaimed) / Math.pow(10, 9); // 9 decimals for YOS
      
      // Calculate if user can claim reward (7-day waiting period)
      const now = Math.floor(Date.now() / 1000);
      const secondsSinceLastClaim = now - lastClaimTime;
      const waitingPeriod = 604800; // 7 days in seconds
      const canClaim = secondsSinceLastClaim >= waitingPeriod;
      
      // Calculate when next claim is available
      let nextClaimAvailable = null;
      if (!canClaim && lastClaimTime > 0) {
        const nextClaimTime = lastClaimTime + waitingPeriod;
        const timeRemaining = nextClaimTime - now;
        
        if (timeRemaining > 0) {
          const days = Math.floor(timeRemaining / 86400);
          const hours = Math.floor((timeRemaining % 86400) / 3600);
          const minutes = Math.floor((timeRemaining % 3600) / 60);
          
          nextClaimAvailable = `${days}d ${hours}h ${minutes}m`;
        }
      }
      
      // Calculate estimated weekly reward (1/52 of contributed amount per year)
      const estimatedWeeklyReward = contributedAmountDecimal / 52;
      
      return {
        contributedAmount: contributedAmountDecimal,
        startTimestamp: startTime,
        lastClaimTime: lastClaimTime,
        totalClaimedYos: totalClaimedDecimal,
        canClaimReward: canClaim,
        nextClaimAvailable,
        estimatedWeeklyReward
      };
    } catch (error) {
      console.error("Error parsing liquidity contribution account:", error);
      // Return default values if account can't be parsed
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
  weeklyRewardRate: number = 1.92, // Default is 1.92% per week (~100% APR)
  ownerCommissionPercent: number = 0.1 // Default is 0.1% of SOL
): Promise<string> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Validate admin wallet
    if (userPublicKey.toString() !== config.accounts?.admin) {
      throw new Error("Only admin can update parameters");
    }
    
    // Validate percentages
    if (buyUserPercent + buyLiquidityPercent + buyCashbackPercent !== 100) {
      throw new Error("Buy percentages must add up to 100%");
    }
    
    if (sellUserPercent + sellLiquidityPercent + sellCashbackPercent !== 100) {
      throw new Error("Sell percentages must add up to 100%");
    }

    // Find program state account
    const [programStateAddress] = findProgramStateAddress();

    // Encode parameters for the update
    const data = Buffer.concat([
      UPDATE_PARAMS_DISCRIMINATOR,
      encodeU64(buyUserPercent),
      encodeU64(buyLiquidityPercent),
      encodeU64(buyCashbackPercent),
      encodeU64(sellUserPercent),
      encodeU64(sellLiquidityPercent),
      encodeU64(sellCashbackPercent),
      encodeU64(Math.floor(weeklyRewardRate * 100)), // Convert to basis points
      encodeU64(Math.floor(ownerCommissionPercent * 100)) // Convert to basis points
    ]);

    // Create the update instruction
    const updateInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true }
      ],
      programId: program,
      data
    });

    // Create and sign transaction
    const transaction = new Transaction().add(updateInstruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userPublicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Parameters updated successfully:", signature);
    console.log("New parameters:", {
      buyDistribution: { user: buyUserPercent, liquidity: buyLiquidityPercent, cashback: buyCashbackPercent },
      sellDistribution: { user: sellUserPercent, liquidity: sellLiquidityPercent, cashback: sellCashbackPercent },
      weeklyRewardRate,
      ownerCommissionPercent
    });
    
    return signature;
  } catch (error) {
    console.error("Error updating parameters:", error);
    throw error;
  }
}

/**
 * Get global statistics for the multi-hub swap program
 */
export async function getMultiHubSwapStats() {
  try {
    // Find program state account
    const [programStateAddress] = findProgramStateAddress();

    // Fetch program state account data
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    
    if (!accountInfo || !accountInfo.data) {
      console.log("Program state not initialized");
      return {
        totalLiquidityContributed: 0,
        totalUniqueContributors: 0,
        totalYosDistributed: 0,
        buyDistribution: {
          userPercent: 75,
          liquidityPercent: 20,
          cashbackPercent: 5
        },
        sellDistribution: {
          userPercent: 75,
          liquidityPercent: 20,
          cashbackPercent: 5
        },
        weeklyRewardRate: 1.92,
        ownerCommissionPercent: 0.1
      };
    }
    
    // Parse the account data (simplified version)
    const data = accountInfo.data;
    
    // Program state data format (Borsh serialized):
    // - bump (u8): 1 byte
    // - initialized (bool): 1 byte
    // - admin (PublicKey): 32 bytes
    // - total_liquidity (u64): 8 bytes
    // - unique_contributors (u32): 4 bytes
    // - total_yos_distributed (u64): 8 bytes
    // - buy_user_percent (u8): 1 byte
    // - buy_liquidity_percent (u8): 1 byte
    // - buy_cashback_percent (u8): 1 byte
    // - sell_user_percent (u8): 1 byte
    // - sell_liquidity_percent (u8): 1 byte
    // - sell_cashback_percent (u8): 1 byte
    // - weekly_reward_rate (u16): 2 bytes (in basis points)
    // - owner_commission_percent (u16): 2 bytes (in basis points)
    
    let offset = 2; // Skip bump and initialized
    
    // Skip admin pubkey
    offset += 32;
    
    // Read program stats
    const totalLiquidity = data.readBigUInt64LE(offset);
    offset += 8;
    
    const uniqueContributors = data.readUInt32LE(offset);
    offset += 4;
    
    const totalYosDistributed = data.readBigUInt64LE(offset);
    offset += 8;
    
    // Read distribution percentages
    const buyUserPercent = data.readUInt8(offset++);
    const buyLiquidityPercent = data.readUInt8(offset++);
    const buyCashbackPercent = data.readUInt8(offset++);
    
    const sellUserPercent = data.readUInt8(offset++);
    const sellLiquidityPercent = data.readUInt8(offset++);
    const sellCashbackPercent = data.readUInt8(offset++);
    
    // Read reward and commission rates
    const weeklyRewardRateBps = data.readUInt16LE(offset);
    offset += 2;
    
    const ownerCommissionBps = data.readUInt16LE(offset);
    
    // Convert to user-friendly values
    const totalLiquidityDecimal = Number(totalLiquidity) / Math.pow(10, 9);
    const totalYosDistributedDecimal = Number(totalYosDistributed) / Math.pow(10, 9);
    const weeklyRewardRate = weeklyRewardRateBps / 100; // Convert from basis points
    const ownerCommissionPercent = ownerCommissionBps / 100; // Convert from basis points
    
    return {
      totalLiquidityContributed: totalLiquidityDecimal,
      totalUniqueContributors: uniqueContributors,
      totalYosDistributed: totalYosDistributedDecimal,
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
      weeklyRewardRate,
      ownerCommissionPercent
    };
  } catch (error) {
    console.error("Error fetching multi-hub swap stats:", error);
    // Return default values
    return {
      totalLiquidityContributed: 0,
      totalUniqueContributors: 0,
      totalYosDistributed: 0,
      buyDistribution: {
        userPercent: 75,
        liquidityPercent: 20,
        cashbackPercent: 5
      },
      sellDistribution: {
        userPercent: 75,
        liquidityPercent: 20,
        cashbackPercent: 5
      },
      weeklyRewardRate: 1.92,
      ownerCommissionPercent: 0.1
    };
  }
}