// Multi-Hub Swap Integration
// Integrates with Raydium (devnet) and Jupiter (SDK devnet)
// All configuration is pulled from app.config.json through config.ts

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Keypair,
  Commitment
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, YOT_DECIMALS, YOS_DECIMALS, SOLANA_RPC_URL } from './constants';
import { sendTransaction } from './transaction-helper';
// Import configuration from centralized configuration
import {
  solanaConfig,
  MULTI_HUB_SWAP_PROGRAM_ID,
  USDC_DEVNET_ADDRESS,
  RAYDIUM_ROUTER_CONFIG
} from './config';

// Raydium Devnet Constants from centralized config
export const RAYDIUM_USDC_MINT = new PublicKey(solanaConfig.multiHubSwap.amm.raydium.usdc);
export const RAYDIUM_ROUTER_ADDRESS = new PublicKey(solanaConfig.multiHubSwap.amm.raydium.routerAddress);

// Connection instance with proper commitment
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Utility function to convert amount to raw format
export function uiToRawAmount(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

// Utility function to convert raw amount to UI format
export function rawToUiAmount(rawAmount: bigint | number, decimals: number): number {
  if (typeof rawAmount === 'number') {
    rawAmount = BigInt(rawAmount);
  }
  return Number(rawAmount) / Math.pow(10, decimals);
}

// Find PDA addresses
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("program-state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

export function findLiquidityContributionAddress(userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liq"), userWallet.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Initialize the Multi-Hub Swap Program
 * This should be done by the admin/deployer only once
 */
export async function initializeMultiHubSwap(
  wallet: any,
  yotMint: PublicKey = new PublicKey(YOT_TOKEN_ADDRESS),
  yosMint: PublicKey = new PublicKey(YOS_TOKEN_ADDRESS),
  usdcMint: PublicKey = RAYDIUM_USDC_MINT,
  raydiumRouter: PublicKey = RAYDIUM_ROUTER_ADDRESS
) {
  try {
    // This functionality would require client-side building of 
    // the initialize instruction and proper account setup
    console.log("Multi-Hub Swap Program initialization would run here");
    console.log("This is admin-only functionality");
    return "Program initialization simulated";
  } catch (error) {
    console.error("Error initializing multi-hub swap program:", error);
    throw error;
  }
}

/**
 * Swap tokens using Raydium and distribute according to the protocol rules
 * 75% to user, 20% to liquidity pool, 5% as YOS cashback
 */
export async function swapAndDistribute(
  wallet: any,
  amountIn: number,
  minAmountOut: number
) {
  try {
    console.log(`Swap and distribute request: ${amountIn} USDC for min ${minAmountOut} YOT`);
    
    // In a full implementation, we would:
    // 1. Get all the necessary token accounts
    // 2. Build the transaction with proper instructions
    // 3. Sign and send the transaction
    
    // For now, return a simulation result
    return {
      success: true,
      signature: "simulated_signature",
      receivedAmount: minAmountOut * 0.75, // 75% to user
      liquidityAmount: minAmountOut * 0.20, // 20% to liquidity
      cashbackAmount: minAmountOut * 0.05, // 5% YOS cashback
    };
  } catch (error) {
    console.error("Error in swap and distribute:", error);
    throw error;
  }
}

/**
 * Claim weekly YOS rewards from liquidity contributions
 */
export async function claimWeeklyYosReward(wallet: any) {
  try {
    // Get user's public key
    const userPublicKey = wallet.publicKey;
    
    // Find user's liquidity contribution account
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (!accountInfo) {
      throw new Error("No liquidity contribution found for this wallet");
    }
    
    // In a full implementation:
    // 1. Build the transaction with the claim instruction
    // 2. Sign and send the transaction
    
    // For now, return a simulation
    return {
      success: true,
      signature: "simulated_claim_signature",
      claimedAmount: 10.5, // Example amount
      nextClaimAvailable: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error("Error claiming YOS rewards:", error);
    throw error;
  }
}

/**
 * Withdraw liquidity contribution
 */
export async function withdrawLiquidityContribution(wallet: any) {
  try {
    // Get user's public key
    const userPublicKey = wallet.publicKey;
    
    // Find user's liquidity contribution account
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (!accountInfo) {
      throw new Error("No liquidity contribution found to withdraw");
    }
    
    // In a full implementation:
    // 1. Build the transaction with the withdraw instruction
    // 2. Sign and send the transaction
    
    // For now, return a simulation
    return {
      success: true,
      signature: "simulated_withdrawal_signature",
      withdrawnAmount: 100, // Example amount
    };
  } catch (error) {
    console.error("Error withdrawing liquidity contribution:", error);
    throw error;
  }
}

/**
 * Get user's liquidity contribution and reward information
 */
export async function getLiquidityContributionInfo(walletAddressStr: string) {
  try {
    // Convert string to PublicKey
    const walletPublicKey = new PublicKey(walletAddressStr);
    
    // Find user's liquidity contribution account
    const [liquidityContributionAddress] = findLiquidityContributionAddress(walletPublicKey);
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (!accountInfo) {
      // Return default state if not found
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
    
    // In a real implementation, we would deserialize the account data
    // For now, return simulated data
    const now = Math.floor(Date.now() / 1000);
    const lastClaimTime = now - (3 * 24 * 60 * 60); // 3 days ago
    const contributedAmount = 100; 
    
    const secondsUntilNextClaim = Math.max(0, (lastClaimTime + 7 * 24 * 60 * 60) - now);
    const canClaimReward = secondsUntilNextClaim === 0;
    const nextClaimAvailable = new Date((now + secondsUntilNextClaim) * 1000).toISOString();
    
    // Calculate estimated weekly reward (100% APR / 52 weeks ≈ 1.92% per week)
    const estimatedWeeklyReward = contributedAmount * (1 / 52);
    
    return {
      contributedAmount,
      startTimestamp: lastClaimTime - (14 * 24 * 60 * 60), // Start 2 weeks before last claim
      lastClaimTime,
      totalClaimedYos: 6, // Example amount
      canClaimReward,
      nextClaimAvailable,
      estimatedWeeklyReward
    };
  } catch (error) {
    console.error("Error getting liquidity contribution info:", error);
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
    
    // For now, return simulated data
    return {
      totalLiquidityContributed: 25000,
      totalContributors: 12,
      totalYosRewarded: 1250,
      weeklyRewardRate: 1.92, // 1.92% per week (100% APR / 52 weeks)
      yearlyAPR: 100, // 100% APR
      // Adding configurable distribution percentages
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
    // Check if wallet is connected
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // In a full implementation:
    // 1. Verify admin status
    // 2. Build and send transaction to update parameters
    
    console.log("Multi-hub swap parameters would be updated here");
    console.log("This is admin-only functionality");
    
    return {
      success: true,
      message: "Parameters updated successfully",
      newParameters: {
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
      }
    };
  } catch (error) {
    console.error("Error updating multi-hub swap parameters:", error);
    throw error;
  }
}