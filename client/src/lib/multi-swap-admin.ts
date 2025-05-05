/**
 * Multi-Hub Swap Admin Keypair
 * This file contains the admin keypair for the Multi-Hub Swap contract
 * IMPORTANT: This is only for development on devnet. In production, this would be securely managed.
 */
import { Keypair } from '@solana/web3.js';
import { MULTI_HUB_SWAP_PROGRAM_ID, MULTI_HUB_SWAP_PROGRAM_STATE } from './multi-hub-swap-contract';

// Program ID and state from the deployed Solana program
export const PROGRAM_ID = MULTI_HUB_SWAP_PROGRAM_ID;
export const PROGRAM_STATE = MULTI_HUB_SWAP_PROGRAM_STATE;

// Program specifics
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Program YOS token account
export const PROGRAM_YOS_TOKEN_ACCOUNT = '5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz';

// Admin wallet for testing - matches ADMIN_WALLET_ADDRESS in constants.ts  
export const ADMIN_WALLET = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

// Multi-Swap admin keypair for initialization and admin operations
// This is loaded from the keypair JSON provided
const ADMIN_KEYPAIR_DATA = [40,163,26,40,165,11,145,53,31,203,218,26,216,197,81,247,227,139,92,0,15,253,190,167,65,59,166,85,143,92,203,150,6,126,217,47,147,71,61,235,176,168,38,196,215,146,214,202,0,50,65,71,3,76,220,178,186,129,254,229,134,177,177,233];
export const ADMIN_KEYPAIR = Keypair.fromSecretKey(new Uint8Array(ADMIN_KEYPAIR_DATA));

// Default distribution percentages
export const DEFAULT_DISTRIBUTION = {
  // Buy distribution: 75% user, 20% liquidity pool, 5% YOS cashback
  buy: {
    userPercent: 75,
    liquidityPercent: 20,
    cashbackPercent: 5
  },
  // Sell distribution: 75% user, 20% liquidity pool, 5% YOS cashback
  sell: {
    userPercent: 75,
    liquidityPercent: 20,
    cashbackPercent: 5
  }
};

// Default fee rates (in basis points)
export const DEFAULT_FEES = {
  lpContributionRate: 2000, // 20.00%
  adminFeeRate: 10,         // 0.10%
  yosCashbackRate: 500,     // 5.00%
  swapFeeRate: 30,          // 0.30%
  referralRate: 50          // 0.50%
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