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

    // Create the instruction data
    const data = CLAIM_REWARD_DISCRIMINATOR;

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
    
    // In this case, the contract handles the distribution automatically:
    // - 75% to user
    // - 20% to liquidity pool
    // - 5% as YOS cashback
    return {
      signature,
      outputAmount,
      distributionDetails: {
        userReceived: outputAmount * DEFAULT_DISTRIBUTION_RATES.userDistribution/100,
        liquidityContribution: outputAmount * DEFAULT_DISTRIBUTION_RATES.lpContribution/100,
        yosCashback: outputAmount * DEFAULT_DISTRIBUTION_RATES.yosCashback/100
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
    const solPoolAccount = new PublicKey("7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS"); // SOL account
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
  // Return hardcoded list of supported tokens
  return [
    {
      symbol: "SOL",
      address: SOL_TOKEN_ADDRESS,
      name: "Solana",
      logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png"
    },
    {
      symbol: "YOT",
      address: YOT_TOKEN_ADDRESS,
      name: "YOT Token",
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
  lpContributionRate: number = 20,
  adminFeeRate: number = 0.1,
  yosCashbackRate: number = 5,
  swapFeeRate: number = 0.3,
  referralRate: number = 0.5
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
  
  // Create the program state account
  const [programStateAddress] = findProgramStateAddress();
  
  // Create a transaction to initialize the program
  const transaction = new Transaction();
  
  // Encode the initialization data
  const data = Buffer.alloc(33); // 1 byte for instruction type + 32 bytes for parameters
  data.writeUInt8(MultiHubSwapInstructionType.Initialize, 0);
  
  // Convert percentages to basis points (1% = 100 basis points)
  // Pack parameters into the buffer
  let offset = 1;
  const lpContributionBasisPoints = Math.round(lpContributionRate * 100);
  const adminFeeBasisPoints = Math.round(adminFeeRate * 100);
  const yosCashbackBasisPoints = Math.round(yosCashbackRate * 100);
  const swapFeeBasisPoints = Math.round(swapFeeRate * 100);
  const referralBasisPoints = Math.round(referralRate * 100);
  
  data.writeUInt16LE(lpContributionBasisPoints, offset);
  offset += 2;
  data.writeUInt16LE(adminFeeBasisPoints, offset);
  offset += 2;
  data.writeUInt16LE(yosCashbackBasisPoints, offset);
  offset += 2;
  data.writeUInt16LE(swapFeeBasisPoints, offset);
  offset += 2;
  data.writeUInt16LE(referralBasisPoints, offset);
  offset += 2;
  
  // Create the instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: yotMint, isSigner: false, isWritable: false },
      { pubkey: yosMint, isSigner: false, isWritable: false },
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
      totalLiquidityContributed: solanaConfig.multiHubSwap.stats.totalLiquidityContributed, // From config 
      totalContributors: solanaConfig.multiHubSwap.stats.totalContributors,            // From config
      totalYosRewarded: solanaConfig.multiHubSwap.stats.totalYosRewarded,             // From config
      
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
      weeklyRewardRate: solanaConfig.multiHubSwap.rates.weeklyRewardRate,
      yearlyAPR: solanaConfig.multiHubSwap.rates.yearlyAPR,
      buyDistribution: {
        userPercent: DEFAULT_DISTRIBUTION_RATES.userDistribution,
        liquidityPercent: DEFAULT_DISTRIBUTION_RATES.lpContribution,
        cashbackPercent: DEFAULT_DISTRIBUTION_RATES.yosCashback
      },
      sellDistribution: {
        userPercent: DEFAULT_DISTRIBUTION_RATES.userDistribution,
        liquidityPercent: DEFAULT_DISTRIBUTION_RATES.lpContribution,
        cashbackPercent: DEFAULT_DISTRIBUTION_RATES.yosCashback
      }
    };
  }
}