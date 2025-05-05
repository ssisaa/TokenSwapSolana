/**
 * Multi-Hub Swap Admin Keypair
 * This file contains the admin keypair for the Multi-Hub Swap contract
 * All configuration values are pulled from app.config.json through config.ts
 * IMPORTANT: This is only for development on devnet. In production, this would be securely managed.
 */
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Import configuration from centralized config
import {
  solanaConfig,
  MULTI_HUB_SWAP_PROGRAM_ID,
  MULTI_HUB_SWAP_STATE,
  MULTI_HUB_SWAP_ADMIN,
  DEFAULT_DISTRIBUTION_RATES,
  DEFAULT_FEE_RATES,
  SOL_YOT_POOL_INFO
} from './config';

// Program ID and state from the centralized config
export const PROGRAM_ID = MULTI_HUB_SWAP_PROGRAM_ID;
export const PROGRAM_STATE = MULTI_HUB_SWAP_STATE;

// Program specifics from centralized config
export const POOL_AUTHORITY = SOL_YOT_POOL_INFO.poolAuthority;
export const POOL_SOL_ACCOUNT = SOL_YOT_POOL_INFO.solAccount;

// Program YOS token account from centralized config
export const PROGRAM_YOS_TOKEN_ACCOUNT = solanaConfig.tokens.yos.programAccount;

// Admin wallet from centralized config
export const ADMIN_WALLET = MULTI_HUB_SWAP_ADMIN;

// Load keypair from the attached assets
let ADMIN_KEYPAIR: Keypair;
try {
  const keypairPath = path.join('attached_assets', 'multi-swap-keypair.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  ADMIN_KEYPAIR = Keypair.fromSecretKey(new Uint8Array(keypairData));
} catch (error) {
  // Fallback to hardcoded keypair if file not found (for development only)
  console.warn("Using fallback keypair - this should only be used in development");
  const ADMIN_KEYPAIR_DATA = [40,163,26,40,165,11,145,53,31,203,218,26,216,197,81,247,227,139,92,0,15,253,190,167,65,59,166,85,143,92,203,150,6,126,217,47,147,71,61,235,176,168,38,196,215,146,214,202,0,50,65,71,3,76,220,178,186,129,254,229,134,177,177,233];
  ADMIN_KEYPAIR = Keypair.fromSecretKey(new Uint8Array(ADMIN_KEYPAIR_DATA));
}
export { ADMIN_KEYPAIR };

// Default distribution percentages from centralized config
export const DEFAULT_DISTRIBUTION = {
  // Buy distribution from centralized config
  buy: {
    userPercent: DEFAULT_DISTRIBUTION_RATES.userDistribution,
    liquidityPercent: DEFAULT_DISTRIBUTION_RATES.lpContribution,
    cashbackPercent: DEFAULT_DISTRIBUTION_RATES.yosCashback
  },
  // Same values for sell distribution
  sell: {
    userPercent: DEFAULT_DISTRIBUTION_RATES.userDistribution,
    liquidityPercent: DEFAULT_DISTRIBUTION_RATES.lpContribution,
    cashbackPercent: DEFAULT_DISTRIBUTION_RATES.yosCashback
  }
};

// Default fee rates from centralized config (in percentages)
// Converting to basis points for the program
export const DEFAULT_FEES = {
  lpContributionRate: solanaConfig.multiHubSwap.rates.lpContributionRate,
  adminFeeRate: solanaConfig.multiHubSwap.rates.adminFeeRate,
  yosCashbackRate: solanaConfig.multiHubSwap.rates.yosCashbackRate,
  swapFeeRate: solanaConfig.multiHubSwap.rates.swapFeeRate,
  referralRate: solanaConfig.multiHubSwap.rates.referralRate
};

/**
 * Convert percentage to basis points
 * @param percentage Value as a percentage (e.g., 20.5 for 20.5%)
 * @returns Value in basis points (e.g., 2050 for 20.5%)
 */
export function percentageToBasisPoints(percentage: number): number {
  return Math.round(percentage * 100);
}

/**
 * Convert basis points to percentage
 * @param basisPoints Value in basis points (e.g., 2050 for 20.5%)
 * @returns Value as a percentage (e.g., 20.5 for 20.5%)
 */
export function basisPointsToPercentage(basisPoints: number): number {
  return basisPoints / 100;
}