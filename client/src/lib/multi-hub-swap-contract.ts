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
// Import configuration from centralized configuration system
import {
  solanaConfig,
  SOL_TOKEN_ADDRESS,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  MULTI_HUB_SWAP_PROGRAM_ID,
  MULTI_HUB_SWAP_STATE,
  MULTI_HUB_SWAP_ADMIN,
  SOLANA_RPC_URL,
  DEFAULT_DISTRIBUTION_RATES,
  DEFAULT_FEE_RATES,
  DEFAULT_EXCHANGE_RATES,
  BUY_AND_DISTRIBUTE_DISCRIMINATOR,
  CLAIM_REWARD_DISCRIMINATOR,
  WITHDRAW_CONTRIBUTION_DISCRIMINATOR,
  UPDATE_PARAMETERS_DISCRIMINATOR
} from './config';

// Export program IDs for backward compatibility
export const MULTI_HUB_SWAP_PROGRAM_STATE = MULTI_HUB_SWAP_STATE;
export { MULTI_HUB_SWAP_PROGRAM_ID };

// Instruction types for the program
export enum MultiHubSwapInstructionType {
  Initialize = 0,
  Swap = 1,
  Contribute = 2,
  ClaimRewards = 3,
  WithdrawLiquidity = 4,
  UpdateParameters = 5
}

// Connection to Solana network
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Use discriminators from centralized config

/**
 * Find the program state PDA
 * CRITICAL: Seed must match the Rust program's "state" seed
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

    // 1-byte discriminator + 8-byte amount
    // IMPORTANT: Program expects BUY_AND_DISTRIBUTE_IX (4) as the first byte
    // followed by the amount as an 8-byte little-endian u64 value
    
    console.log("BUY_AND_DISTRIBUTE instruction preparation:");
    console.log("- Expected discriminator from program: BUY_AND_DISTRIBUTE_IX = 4");
    console.log("- Raw amount (u64):", rawAmount);
    
    // Create a 9-byte buffer: 1 byte for discriminator + 8 bytes for u64 amount
    const data = Buffer.alloc(9);
    
    // Write discriminator as first byte - must be 4 for BUY_AND_DISTRIBUTE_IX
    data.writeUInt8(4, 0);
    
    // Write amount as 8-byte little-endian u64 starting at position 1
    data.writeBigUInt64LE(BigInt(rawAmount), 1);
    
    console.log("Instruction data (hex):", data.toString("hex"));
    console.log("Data buffer:", {
      length: data.length,
      firstByte: data[0],
      discriminator: data.slice(0, 1).toString("hex"),
      rawAmount,
      amountBytes: Array.from(data.slice(1, 9)),
      fullData: Array.from(data)
    });

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
 * Distribute weekly YOS rewards automatically to users
 * This implements the auto-distribution version of the claim_weekly_reward instruction
 * 
 * Features:
 * 1. Can be called by anyone (including admin or automated system) on behalf of users
 * 2. Enforces a 7-day (604,800 seconds) waiting period between distributions
 * 3. Calculates rewards as 1/52 of the yearly reward amount (based on contribution)
 * 4. Updates the last claim time in the LiquidityContribution account
 * 5. Automatically sends rewards directly to user wallets without manual claiming
 */
export async function distributeWeeklyYosReward(
  adminWallet: any, 
  userAddress: string
): Promise<{ signature: string, distributedAmount: number }> {
  try {
    if (!adminWallet || !adminWallet.publicKey) {
      throw new Error("Admin wallet not connected");
    }

    const adminPublicKey = adminWallet.publicKey;
    const userPublicKey = new PublicKey(userAddress);
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);

    // Check if reward distribution is eligible (7-day waiting period)
    const contributionInfo = await getLiquidityContributionInfo(userAddress);
    
    if (!contributionInfo.canClaimReward) {
      const nextDistributionDate = contributionInfo.nextClaimAvailable 
        ? new Date(contributionInfo.nextClaimAvailable).toLocaleDateString() 
        : 'unavailable';
      
      throw new Error(
        `Cannot distribute rewards yet. Must wait 7 days between distributions. ` +
        `Next distribution available: ${nextDistributionDate}`
      );
    }
    
    if (contributionInfo.contributedAmount === 0) {
      throw new Error("User doesn't have any liquidity contributions for reward distribution");
    }

    // Find user's token accounts
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);

    // Find program controlled accounts
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);

    // Create the instruction data - simple direct approach with byte value 5
    const data = Buffer.from([5]); // Direct byte for CLAIM_WEEKLY_REWARD_IX

    // Create the instruction with modified account list for auto-distribution
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        { pubkey: userPublicKey, isSigner: false, isWritable: true },
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
    transaction.feePayer = adminPublicKey;

    // Sign and send transaction
    const signedTransaction = await adminWallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Reward distribution transaction confirmed:", signature);
    
    // Calculate the distributed reward amount (from config - 100% APR means 1.92% weekly)
    const weeklyRewardRate = solanaConfig.multiHubSwap.rewards.weeklyRewardRate / 100; // Convert from percentage to decimal
    const distributedAmount = contributionInfo.contributedAmount * weeklyRewardRate;
    
    console.log(`Distributed ${distributedAmount} YOS to user ${userAddress} from ${contributionInfo.contributedAmount} YOT contribution`);
    
    return {
      signature,
      distributedAmount
    };
  } catch (error) {
    console.error("Error in distributeWeeklyYosReward:", error);
    throw error;
  }
}

/**
 * Legacy function that redirects to the automated distribution
 * Kept for backward compatibility with existing code
 */
export async function claimWeeklyYosReward(wallet: any): Promise<{ signature: string, claimedAmount: number }> {
  try {
    const result = await distributeWeeklyYosReward(wallet, wallet.publicKey.toString());
    return {
      signature: result.signature,
      claimedAmount: result.distributedAmount
    };
  } catch (error) {
    console.error("Error in legacy claimWeeklyYosReward:", error);
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

    // Create the instruction data - simple direct approach with byte value 6
    const data = Buffer.from([6]); // Direct byte for WITHDRAW_CONTRIBUTION_IX

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
      
      // Calculate next claim time (using claimPeriodDays from config)
      const claimPeriodMs = solanaConfig.multiHubSwap.rewards.claimPeriodDays * 24 * 60 * 60 * 1000;
      const nextClaimTime = lastClaimTimeMs + claimPeriodMs;
      const now = Date.now();
      const canClaimReward = now >= nextClaimTime;
      
      // Calculate estimated weekly reward (using weeklyRewardRate from config)
      const weeklyRewardRate = solanaConfig.multiHubSwap.rewards.weeklyRewardRate / 100;
      const estimatedWeeklyReward = contributedAmount * weeklyRewardRate;
      
      // Calculate total claimed YOS (estimating based on time since start)
      const periodsSinceStart = Math.floor((now - startTimestamp) / claimPeriodMs);
      const totalClaimedYos = periodsSinceStart * estimatedWeeklyReward;
      
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
  lpContributionRate: number = solanaConfig.multiHubSwap.rates.lpContributionRate / 100,   // % of transaction going to LP
  adminFeeRate: number = solanaConfig.multiHubSwap.rates.adminFeeRate / 100,               // % fee going to admin
  yosCashbackRate: number = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,         // % of transaction minted as YOS
  swapFeeRate: number = solanaConfig.multiHubSwap.rates.swapFeeRate / 100,                 // % swap fee
  referralRate: number = solanaConfig.multiHubSwap.rates.referralRate / 100                // % referral bonus
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
 * Default values from app.config.json
 */
interface ProgramState {
  admin: PublicKey;
  yotMint: PublicKey;
  yosMint: PublicKey;
  lpContributionRate: number; // Default: solanaConfig.multiHubSwap.rates.lpContributionRate
  adminFeeRate: number;       // Default: solanaConfig.multiHubSwap.rates.adminFeeRate
  yosCashbackRate: number;    // Default: solanaConfig.multiHubSwap.rates.yosCashbackRate
  swapFeeRate: number;        // Default: solanaConfig.multiHubSwap.rates.swapFeeRate
  referralRate: number;       // Default: solanaConfig.multiHubSwap.rates.referralRate
}

/**
 * Executes a token swap
 * For SOL-YOT swaps, uses the buyAndDistribute function
 */
export async function executeSwap(
  wallet: any,
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ signature: string, outputAmount: number, distributionDetails?: any }> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Get expected output amount with slippage tolerance
  const { outputAmount, minOutputAmount } = await getExpectedOutput(
    fromTokenAddress,
    toTokenAddress,
    inputAmount,
    slippageTolerance
  );

  // Case 1: SOL to YOT swap (main focus of Multi-Hub implementation)
  if (fromTokenAddress === SOL_TOKEN_ADDRESS && toTokenAddress === YOT_TOKEN_ADDRESS) {
    // Execute SOL-YOT swap using buyAndDistribute
    const signature = await buyAndDistribute(wallet, inputAmount);
    
    // In this case, the contract handles the distribution automatically
    // using rates from the config:
    // - Usually 75% to user 
    // - Usually 20% to liquidity pool
    // - Usually 5% as YOS cashback
    const userDistribution = 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100);
    const lpContribution = solanaConfig.multiHubSwap.rates.lpContributionRate / 100;
    const yosCashback = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100;
    
    return {
      signature,
      outputAmount,
      distributionDetails: {
        userReceived: outputAmount * userDistribution/100,
        liquidityContribution: outputAmount * lpContribution/100,
        yosCashback: outputAmount * yosCashback/100
      }
    };
  }
  
  // Case 2: YOT to SOL swap (would be implemented via Raydium or Jupiter)
  // Currently stubbed - would need actual AMM integration
  if (fromTokenAddress === YOT_TOKEN_ADDRESS && toTokenAddress === SOL_TOKEN_ADDRESS) {
    throw new Error("YOT to SOL swaps currently under development. Please use SOL to YOT swaps.");
  }
  
  // Default case: Unsupported swap pair
  throw new Error(`Swap from ${fromTokenAddress} to ${toTokenAddress} not supported yet`);
}

/**
 * Calculates the expected output amount based on input and current exchange rate
 */
export async function getExpectedOutput(
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ outputAmount: number, minOutputAmount: number, exchangeRate: number }> {
  const exchangeRate = await getExchangeRate(fromTokenAddress, toTokenAddress);
  const outputAmount = inputAmount * exchangeRate;
  
  // Calculate minimum output amount based on slippage tolerance
  const slippageFactor = (100 - slippageTolerance) / 100;
  const minOutputAmount = outputAmount * slippageFactor;
  
  return {
    outputAmount,
    minOutputAmount,
    exchangeRate
  };
}

/**
 * Gets exchange rates from the actual Solana blockchain pools
 * Uses real AMM rates instead of hardcoded values
 */
export async function getExchangeRate(fromToken: string, toToken: string): Promise<number> {
  try {
    // Fetch the current CoinGecko SOL price once (will be cached)
    try {
      const solPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const solPriceData = await solPriceResponse.json();
      const solPrice = solPriceData.solana?.usd;
      if (solPrice) {
        console.log(`Live SOL price from CoinGecko: $${solPrice}`);
      }
    } catch (e) {
      console.error("Error fetching SOL price:", e);
    }
    
    // Case 1: SOL to YOT swap rate
    if (fromToken === SOL_TOKEN_ADDRESS && toToken === YOT_TOKEN_ADDRESS) {
      // Fetch real liquidity pool balances from Solana blockchain
      const [solBalance, yotBalance, _] = await getPoolBalances();
      
      if (solBalance <= 0 || yotBalance <= 0) {
        console.warn("Liquidity pool empty or not found, using fallback rate");
        return DEFAULT_EXCHANGE_RATES.SOL_YOT;
      }
      
      // Calculate the real exchange rate from the pool ratios
      // Applying the constant product formula: x * y = k
      // When adding dx SOL, we get dy YOT where (x + dx) * (y - dy) = k
      // For the AMM price, we use the derivative: dy/dx = y/x 
      const rate = yotBalance / solBalance;
      console.log(`Real AMM rate: 1 SOL = ${rate.toLocaleString()} YOT (from pool balances: ${solBalance.toFixed(4)} SOL, ${yotBalance.toLocaleString()} YOT)`);
      return rate;
    } 
    
    // Case 2: YOT to SOL swap rate
    else if (fromToken === YOT_TOKEN_ADDRESS && toToken === SOL_TOKEN_ADDRESS) {
      // Fetch real liquidity pool balances from Solana blockchain  
      const [solBalance, yotBalance, _] = await getPoolBalances();
      
      if (solBalance <= 0 || yotBalance <= 0) {
        console.warn("Liquidity pool empty or not found, using fallback rate");
        return DEFAULT_EXCHANGE_RATES.YOT_SOL;
      }
      
      // For YOT to SOL, the rate is the inverse of SOL to YOT
      const rate = solBalance / yotBalance;
      console.log(`Real AMM rate: 1 YOT = ${rate.toFixed(8)} SOL (from pool balances: ${solBalance.toFixed(4)} SOL, ${yotBalance.toLocaleString()} YOT)`);
      return rate;
    }
    
    // For other pairs, we would integrate with other AMMs like Jupiter or Raydium
    console.warn(`No direct pool for ${fromToken} to ${toToken}, using fallback rate`);
    return DEFAULT_EXCHANGE_RATES.SOL_YOT;
  } catch (error) {
    console.error("Error fetching AMM rate:", error);
    // Fallback to default rates if blockchain query fails
    if (fromToken === SOL_TOKEN_ADDRESS && toToken === YOT_TOKEN_ADDRESS) {
      return DEFAULT_EXCHANGE_RATES.SOL_YOT;
    } else if (fromToken === YOT_TOKEN_ADDRESS && toToken === SOL_TOKEN_ADDRESS) {
      return DEFAULT_EXCHANGE_RATES.YOT_SOL;
    }
    return 1;
  }
}

/**
 * Get the current SOL and YOT balances in the liquidity pool
 * Fetches real balances from the Solana blockchain
 */
async function getPoolBalances(): Promise<[number, number, number]> {
  try {
    // Get SOL balance from pool SOL account - Using the SOL_YOT_POOL_INFO from config
    const solPoolAccount = new PublicKey(solanaConfig.pool.solAccount);
    const solBalance = await connection.getBalance(solPoolAccount);
    const solBalanceNormalized = solBalance / LAMPORTS_PER_SOL;
    
    // Get YOT balance from pool YOT account 
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolAuthority = new PublicKey(solanaConfig.pool.authority); // Pool authority
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Get YOS balance (for display purposes)
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yosPoolAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    let yotBalance = 0;
    let yosBalance = 0;
    
    try {
      const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
      yotBalance = Number(yotAccountInfo.value.uiAmount || 0);
    } catch (e) {
      console.error("Error fetching YOT balance from pool:", e);
      // Fallback to default values from config if token account fetch fails
      yotBalance = solanaConfig.pool.fallbackBalances.yot;
    }
    
    try {
      const yosAccountInfo = await connection.getTokenAccountBalance(yosPoolAccount);
      yosBalance = Number(yosAccountInfo.value.uiAmount || 0);
    } catch (e) {
      console.error("Error fetching YOS balance from pool:", e);
      yosBalance = solanaConfig.pool.fallbackBalances.yos;
    }
    
    console.log(`Pool balances fetched - SOL: ${solBalanceNormalized}, YOT: ${yotBalance}, YOS: ${yosBalance}`);
    return [solBalanceNormalized, yotBalance, yosBalance];
  } catch (error) {
    console.error("Error fetching pool balances:", error);
    // Return fallback values from config if blockchain query fails completely
    const fallbackSol = solanaConfig.pool.fallbackBalances.sol;
    const fallbackYot = solanaConfig.pool.fallbackBalances.yot;
    const fallbackYos = solanaConfig.pool.fallbackBalances.yos;
    console.log(`Using fallback pool balances - SOL: ${fallbackSol}, YOT: ${fallbackYot}, YOS: ${fallbackYos}`);
    return [fallbackSol, fallbackYot, fallbackYos]; // Use values from centralized config
  }
}

/**
 * Gets token balance for a specific token
 */
export async function getTokenBalance(wallet: any, tokenAddress: string): Promise<number> {
  if (!wallet || !wallet.publicKey) {
    return 0;
  }

  try {
    // For SOL, get native SOL balance
    if (tokenAddress === SOL_TOKEN_ADDRESS) {
      const balance = await connection.getBalance(wallet.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } 
    
    // For SPL tokens like YOT
    else {
      const tokenMint = new PublicKey(tokenAddress);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey
      );
      
      try {
        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
        return Number(accountInfo.value.uiAmount);
      } catch (e) {
        // Token account might not exist yet
        return 0;
      }
    }
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return 0;
  }
}

/**
 * Checks if a token pair is supported for swapping
 */
export function isSwapSupported(fromToken: string, toToken: string): boolean {
  // Currently only SOL-YOT swaps are fully supported
  if (fromToken === SOL_TOKEN_ADDRESS && toToken === YOT_TOKEN_ADDRESS) {
    return true;
  }
  
  // YOT-SOL marked as supported but not fully implemented
  if (fromToken === YOT_TOKEN_ADDRESS && toToken === SOL_TOKEN_ADDRESS) {
    return true;
  }
  
  return false;
}

/**
 * Gets a list of supported swap tokens in the network
 */
export async function getSupportedTokens(): Promise<Array<{ symbol: string, address: string, name: string, logoUrl: string }>> {
  // Return dynamically generated list of supported tokens from config
  return [
    {
      symbol: solanaConfig.tokens.sol.symbol,
      address: SOL_TOKEN_ADDRESS,
      name: solanaConfig.tokens.sol.name,
      logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png"
    },
    {
      symbol: solanaConfig.tokens.yot.symbol,
      address: YOT_TOKEN_ADDRESS,
      name: solanaConfig.tokens.yot.name,
      logoUrl: "https://place-hold.it/32x32/37c/fff?text=YOT"
    }
  ];
}

/**
 * Get global statistics for the multi-hub swap program
 * Fetches and deserializes the ProgramState
 */
/**
 * Initialize the Multi-Hub Swap program
 * This can only be called by an admin wallet
 */
export async function initializeMultiHubSwap(
  wallet: any,
  yotMint: PublicKey,
  yosMint: PublicKey,
  lpContributionRate: number = solanaConfig.multiHubSwap.rates.lpContributionRate / 100,
  adminFeeRate: number = solanaConfig.multiHubSwap.rates.adminFeeRate / 100,
  yosCashbackRate: number = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,
  swapFeeRate: number = solanaConfig.multiHubSwap.rates.swapFeeRate / 100,
  referralRate: number = solanaConfig.multiHubSwap.rates.referralRate / 100
): Promise<string> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Verify admin privileges
  if (wallet.publicKey.toString() !== MULTI_HUB_SWAP_ADMIN) {
    throw new Error("Only admin wallet can initialize the program");
  }

  // Connect to Solana
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  
  // Create the program state account using the same seed as in the Rust program
  const [programStateAddress, programStateBump] = findProgramStateAddress();
  console.log("Program state PDA:", programStateAddress.toString());
  
  // Create the program authority account
  const [programAuthority, authorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  console.log("Program authority PDA:", programAuthority.toString());
  
  // Create a transaction to initialize the program
  const transaction = new Transaction();
  
  // Create the instruction with modified data format to match Rust program
  // The Rust program expects: instruction_type(1) + admin(32) + yot_mint(32) + yos_mint(32) + 5 rates(8*5)
  const data = Buffer.alloc(1 + 32*3 + 8*5);
  
  // Set instruction type
  data.writeUInt8(MultiHubSwapInstructionType.Initialize, 0);
  let offset = 1;
  
  // Add admin public key
  wallet.publicKey.toBuffer().copy(data, offset);
  offset += 32;
  
  // Add token mints
  yotMint.toBuffer().copy(data, offset);
  offset += 32;
  yosMint.toBuffer().copy(data, offset);
  offset += 32;
  
  // Convert percentages to basis points with correct scaling 
  // These should be u64 values as expected by the Rust program
  const lpContributionBasisPoints = BigInt(Math.round(lpContributionRate * 10000));
  const adminFeeBasisPoints = BigInt(Math.round(adminFeeRate * 10000));
  const yosCashbackBasisPoints = BigInt(Math.round(yosCashbackRate * 10000));
  const swapFeeBasisPoints = BigInt(Math.round(swapFeeRate * 10000));
  const referralBasisPoints = BigInt(Math.round(referralRate * 10000));
  
  // Write u64 values in little-endian format
  data.writeBigUInt64LE(lpContributionBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(adminFeeBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(yosCashbackBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(swapFeeBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(referralBasisPoints, offset);
  
  console.log("Initialization parameters:");
  console.log(`- LP Contribution: ${lpContributionRate * 100}% (${lpContributionBasisPoints} basis points)`);
  console.log(`- Admin Fee: ${adminFeeRate * 100}% (${adminFeeBasisPoints} basis points)`);
  console.log(`- YOS Cashback: ${yosCashbackRate * 100}% (${yosCashbackBasisPoints} basis points)`);
  console.log(`- Swap Fee: ${swapFeeRate * 100}% (${swapFeeBasisPoints} basis points)`);
  console.log(`- Referral Rate: ${referralRate * 100}% (${referralBasisPoints} basis points)`);
  
  // Create the instruction with accounts that match the Rust program
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
    data
  });
  
  transaction.add(instruction);
  
  try {
    // Sign and send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Initialization transaction sent. Waiting for confirmation...");
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("Multi-Hub Swap program initialized:", signature);
    return signature;
  } catch (error) {
    console.error("Failed to initialize Multi-Hub Swap program:", error);
    throw error;
  }
}

export async function getMultiHubSwapStats() {
  try {
    // Get program state address - using explicit PDA derivation to ensure we're checking the right address
    const [programStateAddress] = findProgramStateAddress();
    console.log("Checking program state at:", programStateAddress.toString());
    
    // Fetch account data
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    
    // Debug info about account
    if (accountInfo) {
      console.log("Program state account found:", {
        owner: accountInfo.owner.toString(),
        dataLength: accountInfo.data.length,
        executable: accountInfo.executable
      });
    }
    
    if (!accountInfo || !accountInfo.data) {
      console.error("Program state account not found or empty");
      throw new Error("Program state not initialized");
    }
    
    // The account data layout should match the Rust program's ProgramState struct:
    // ```
    // pub struct ProgramState {
    //   pub admin: Pubkey,             // 32 bytes
    //   pub yot_mint: Pubkey,          // 32 bytes
    //   pub yos_mint: Pubkey,          // 32 bytes
    //   pub lp_contribution_rate: u64, // 8 bytes
    //   pub admin_fee_rate: u64,       // 8 bytes
    //   pub yos_cashback_rate: u64,    // 8 bytes
    //   pub swap_fee_rate: u64,        // 8 bytes
    //   pub referral_rate: u64,        // 8 bytes
    // }
    // ```
    // Total expected size: 32*3 + 8*5 = 96 + 40 = 136 bytes
    
    const data = accountInfo.data;
    console.log("Account data buffer length:", data.length);
    
    // Safely extract values with error handling
    try {
      // Read the public keys if there's enough data
      if (data.length < 32*3) {
        throw new Error(`Insufficient account data: expected at least ${32*3} bytes, got ${data.length}`);
      }
      
      const admin = new PublicKey(data.slice(0, 32));
      const yotMint = new PublicKey(data.slice(32, 64));
      const yosMint = new PublicKey(data.slice(64, 96));
      
      console.log("Extracted public keys:", {
        admin: admin.toString(),
        yotMint: yotMint.toString(),
        yosMint: yosMint.toString()
      });
      
      let lpContributionRate = solanaConfig.multiHubSwap.rates.lpContributionRate / 100;
      let adminFeeRate = solanaConfig.multiHubSwap.rates.adminFeeRate / 100;
      let yosCashbackRate = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100;
      let swapFeeRate = solanaConfig.multiHubSwap.rates.swapFeeRate / 100;
      let referralRate = solanaConfig.multiHubSwap.rates.referralRate / 100;
      
      // Try to read rates from the account data if there's enough data
      if (data.length >= 32*3 + 8*5) {
        try {
          // Read the rates (u64 values in basis points - divide by 10000 for percentage)
          lpContributionRate = Number(data.readBigUInt64LE(96)) / 10000; // Convert from basis points to percentage
          adminFeeRate = Number(data.readBigUInt64LE(104)) / 10000;
          yosCashbackRate = Number(data.readBigUInt64LE(112)) / 10000;
          swapFeeRate = Number(data.readBigUInt64LE(120)) / 10000;
          referralRate = Number(data.readBigUInt64LE(128)) / 10000;
          
          console.log("Extracted rates:", {
            lpContributionRate,
            adminFeeRate,
            yosCashbackRate,
            swapFeeRate,
            referralRate
          });
        } catch (rateError) {
          console.warn("Error reading rates from account data, using defaults:", rateError);
        }
      } else {
        console.warn(`Insufficient data for rates: expected ${32*3 + 8*5} bytes, got ${data.length}. Using default rates.`);
      }
      
      // Return formatted stats for the UI
      return {
        admin: admin.toString(),
        yotMint: yotMint.toString(),
        yosMint: yosMint.toString(),
        totalLiquidityContributed: solanaConfig.multiHubSwap.stats.totalLiquidityContributed,
        totalContributors: solanaConfig.multiHubSwap.stats.totalContributors,
        totalYosRewarded: solanaConfig.multiHubSwap.stats.totalYosRewarded,
        
        // Rates (either from account data or fallback to config)
        lpContributionRate,
        adminFeeRate,
        yosCashbackRate,
        swapFeeRate, 
        referralRate,
        
        // Distribution percentages
        buyDistribution: {
          userPercent: 100 - lpContributionRate - yosCashbackRate,
          liquidityPercent: lpContributionRate,
          cashbackPercent: yosCashbackRate
        },
        
        sellDistribution: {
          userPercent: 100 - lpContributionRate - yosCashbackRate,
          liquidityPercent: lpContributionRate,
          cashbackPercent: yosCashbackRate
        },
        
        // Weekly reward rate from config
        weeklyRewardRate: solanaConfig.multiHubSwap.rewards.weeklyRewardRate,
        yearlyAPR: solanaConfig.multiHubSwap.rewards.yearlyAPR
      };
    } catch (dataError) {
      console.error("Error parsing account data:", dataError);
      throw dataError;
    }
  } catch (error) {
    console.error("Error getting multi-hub swap stats:", error);
    
    // Fallback to default values from config if we can't read the program state
    return {
      totalLiquidityContributed: solanaConfig.multiHubSwap.stats.totalLiquidityContributed,
      totalContributors: solanaConfig.multiHubSwap.stats.totalContributors,
      totalYosRewarded: solanaConfig.multiHubSwap.stats.totalYosRewarded,
      lpContributionRate: solanaConfig.multiHubSwap.rates.lpContributionRate / 100,
      adminFeeRate: solanaConfig.multiHubSwap.rates.adminFeeRate / 100,
      yosCashbackRate: solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,
      swapFeeRate: solanaConfig.multiHubSwap.rates.swapFeeRate / 100,
      referralRate: solanaConfig.multiHubSwap.rates.referralRate / 100,
      weeklyRewardRate: solanaConfig.multiHubSwap.rewards.weeklyRewardRate,
      yearlyAPR: solanaConfig.multiHubSwap.rewards.yearlyAPR,
      buyDistribution: {
        userPercent: 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100),
        liquidityPercent: solanaConfig.multiHubSwap.rates.lpContributionRate / 100,
        cashbackPercent: solanaConfig.multiHubSwap.rates.yosCashbackRate / 100
      },
      sellDistribution: {
        userPercent: 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100),
        liquidityPercent: solanaConfig.multiHubSwap.rates.lpContributionRate / 100,
        cashbackPercent: solanaConfig.multiHubSwap.rates.yosCashbackRate / 100
      }
    };
  }
}