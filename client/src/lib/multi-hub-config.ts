/**
 * Multi-Hub Swap Configuration
 * This module isolates the Multi-Hub Swap program configuration
 * to prevent interference with existing staking functionality.
 */

import appConfig from '../../../app.config.json';

// Token addresses from config
export const YOT_TOKEN_ADDRESS = appConfig.solana?.tokens?.yot?.address || 
  '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';

export const YOS_TOKEN_ADDRESS = appConfig.solana?.tokens?.yos?.address || 
  'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Multi-Hub Swap specific configuration
export const MULTI_HUB_SWAP_CONFIG = appConfig.solana?.multiHubSwap || {
  programId: 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE',
  programState: 'Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ',
  admin: 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ',
  rates: {
    lpContributionRate: 2000,  // 20.00%
    adminFeeRate: 10,          // 0.10%
    yosCashbackRate: 500,      // 5.00%
    swapFeeRate: 30,           // 0.30%
    referralRate: 50           // 0.50%
  },
  rewards: {
    weeklyRewardRate: 1.92,    // 1.92% weekly (100% APR / 52 weeks)
    yearlyAPR: 100,            // 100% APR
    claimPeriodDays: 7         // 7-day claim period
  }
};

// Token accounts
export const YOT_TOKEN_ACCOUNT = appConfig.solana?.tokens?.yot?.account || 
  'BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE';

export const YOS_TOKEN_ACCOUNT = appConfig.solana?.tokens?.yos?.account || 
  'BLz2mfhb9qoPAtKuFNVfrj9uTEyChHKKbZsniS1eRaUB';

export const PROGRAM_YOS_ACCOUNT = appConfig.solana?.tokens?.yos?.programAccount || 
  '5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz';

// Pool configuration
export const POOL_AUTHORITY = appConfig.solana?.pool?.authority || 
  '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';

export const POOL_SOL_ACCOUNT = appConfig.solana?.pool?.solAccount || 
  '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Network configuration
export const SOLANA_NETWORK = appConfig.solana?.network || 'devnet';
export const SOLANA_RPC_URL = appConfig.solana?.rpcUrl || 'https://api.devnet.solana.com';
export const SOLANA_COMMITMENT = appConfig.solana?.commitment || 'confirmed';

// AMM configuration 
export const RAYDIUM_CONFIG = MULTI_HUB_SWAP_CONFIG.amm?.raydium || {
  routerAddress: 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU',
  usdc: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U'
};

export const JUPITER_CONFIG = MULTI_HUB_SWAP_CONFIG.amm?.jupiter || {
  enabled: true,
  priorityFee: 1000000
};

// Instruction discriminators for the multi-hub swap contract
export const INSTRUCTION_DISCRIMINATORS = {
  INITIALIZE: Buffer.from([0]),
  SWAP: Buffer.from([1]),
  CLOSE_PROGRAM: Buffer.from([2]),
  UPDATE_PARAMETERS: Buffer.from([3]),
  BUY_AND_DISTRIBUTE: Buffer.from([4]),
  CLAIM_WEEKLY_REWARD: Buffer.from([5]),
  WITHDRAW_CONTRIBUTION: Buffer.from([6])
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

// Convenience formatting for UI - all values as percentages
export const FORMATTED_RATES = {
  lpContributionRate: basisPointsToPercentage(MULTI_HUB_SWAP_CONFIG.rates.lpContributionRate),
  adminFeeRate: basisPointsToPercentage(MULTI_HUB_SWAP_CONFIG.rates.adminFeeRate),
  yosCashbackRate: basisPointsToPercentage(MULTI_HUB_SWAP_CONFIG.rates.yosCashbackRate),
  swapFeeRate: basisPointsToPercentage(MULTI_HUB_SWAP_CONFIG.rates.swapFeeRate),
  referralRate: basisPointsToPercentage(MULTI_HUB_SWAP_CONFIG.rates.referralRate)
};