import { clusterApiUrl } from '@solana/web3.js';

// Cluster configuration
export const CLUSTER = 'devnet';
export const ENDPOINT = clusterApiUrl(CLUSTER);
export const EXPLORER_URL = 'https://explorer.solana.com';

// Token addresses
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
export const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';

// Token accounts
export const YOT_TOKEN_ACCOUNT = 'BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE';
export const YOS_TOKEN_ACCOUNT = '5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz';

// Pool info
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Program IDs
export const PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';

// Admin wallet
export const ADMIN_WALLET = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

// Token symbols
export const YOT_SYMBOL = 'YOT';
export const YOS_SYMBOL = 'YOS';
export const SOL_SYMBOL = 'SOL';

// Token decimals
export const YOT_DECIMALS = 9;
export const YOS_DECIMALS = 9;
export const SOL_DECIMALS = 9;

// Distribution percentages
export const DISTRIBUTION = {
  USER_PERCENTAGE: 75,
  LIQUIDITY_PERCENTAGE: 20,
  CASHBACK_PERCENTAGE: 5
};

// Swap fees
export const SWAP_FEE = 0.25; // 0.25% fee

// Normalization factors
export const YOS_DISPLAY_NORMALIZATION_FACTOR = 9260; // CRITICAL: Must be 9,260 not 10,000
export const YOS_WALLET_DISPLAY_ADJUSTMENT = 1.0;
export const PROGRAM_SCALING_FACTOR = 1000000;

// Owner commission settings
export const OWNER_COMMISSION_PERCENT = 0.1; // 0.1% default commission

// Raydium Devnet info (for multi-hop swaps)
export const RAYDIUM_ROUTER = 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU';
export const RAYDIUM_USDC_MINT = '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U';