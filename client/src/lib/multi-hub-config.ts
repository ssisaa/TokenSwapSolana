/**
 * Multi-Hub Swap Configuration
 * Contains all the constants and settings for the Multi-Hub Swap functionality
 */

// Contract addresses and program IDs
export const MULTI_HUB_SWAP_CONFIG = {
  programId: "SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE",
  programState: "Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ",
};

// Token addresses
export const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
export const YOT_TOKEN_ADDRESS = "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF";
export const YOS_TOKEN_ADDRESS = "GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n";
export const USDC_DEVNET_ADDRESS = "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U";

// Pool addresses
export const SOL_YOT_POOL_INFO = {
  poolAuthority: "7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK",
  solAccount: "7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS",
};

// Default admin wallet
export const ADMIN_WALLET = "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ";

// Distribution rates
export const DEFAULT_DISTRIBUTION_RATES = {
  userDistribution: 75, // 75% to the user
  lpContribution: 20,   // 20% to the liquidity pool
  yosCashback: 5,       // 5% as YOS cashback
};

// APR settings
export const YOS_ANNUAL_APR = 100; // 100% APR for liquidity contributions
export const WEEKLY_REWARD_RATE = 1.92; // 100% / 52 weeks = ~1.92% weekly
export const SECONDS_PER_WEEK = 604800; // 7 days in seconds

// Fee rates (in percent)
export const DEFAULT_FEE_RATES = {
  swapFee: 0.3,      // 0.3% swap fee
  adminFee: 0.1,     // 0.1% admin fee
  referralFee: 0.5,  // 0.5% referral fee
};

// RPC configuration
export const SOLANA_RPC_URL = "https://api.devnet.solana.com";

// Formatted rates for display
export const FORMATTED_RATES = {
  distributionRates: {
    userReceives: `${DEFAULT_DISTRIBUTION_RATES.userDistribution}%`,
    liquidityPool: `${DEFAULT_DISTRIBUTION_RATES.lpContribution}%`,
    yosCashback: `${DEFAULT_DISTRIBUTION_RATES.yosCashback}%`,
  },
  rewards: {
    annualAPR: `${YOS_ANNUAL_APR}%`,
    weeklyRate: `${WEEKLY_REWARD_RATE}%`,
  },
  fees: {
    swapFee: `${DEFAULT_FEE_RATES.swapFee}%`,
    adminFee: `${DEFAULT_FEE_RATES.adminFee}%`,
    referralFee: `${DEFAULT_FEE_RATES.referralFee}%`,
  },
};

// Instruction discriminators for the multi-hub swap program
export const BUY_AND_DISTRIBUTE_DISCRIMINATOR = Buffer.from([
  6, 240, 93, 246, 87, 224, 215, 175, // 8-byte discriminator for buy_and_distribute
]);

export const CLAIM_REWARD_DISCRIMINATOR = Buffer.from([
  146, 113, 97, 51, 55, 103, 32, 159, // 8-byte discriminator for claim_weekly_reward
]);

export const WITHDRAW_CONTRIBUTION_DISCRIMINATOR = Buffer.from([
  52, 21, 251, 13, 191, 179, 204, 196, // 8-byte discriminator for withdraw_contribution
]);

export const UPDATE_PARAMETERS_DISCRIMINATOR = Buffer.from([
  98, 103, 208, 178, 254, 106, 239, 67, // 8-byte discriminator for update_parameters
]);

// Router configurations for Jupiter/Raydium integrations
export const RAYDIUM_ROUTER_CONFIG = {
  routerAddress: "BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU", // Raydium router on devnet
};

// Exchange rate configuration (for devnet where there might not be reliable price feeds)
export const DEFAULT_EXCHANGE_RATES = {
  SOL_YOT: 15650,     // 1 SOL = 15,650 YOT
  YOT_SOL: 0.000064,  // 1 YOT = 0.000064 SOL
  USDC_YOT: 105.5,    // 1 USDC = 105.5 YOT
  YOT_USDC: 0.0095,   // 1 YOT = 0.0095 USDC
};

// Set to true to enable debug logs
export const DEBUG_MODE = true;