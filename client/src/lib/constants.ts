import { Cluster } from '@solana/web3.js';

// Cluster settings
export const CLUSTER: Cluster = 'devnet';
export const ENDPOINT = 'https://api.devnet.solana.com';
export const EXPLORER_URL = 'https://explorer.solana.com';

// Program IDs
export const PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';

// Token addresses (these are Devnet tokens)
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
export const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111111';

// YOT Token accounts
export const YOT_TOKEN_ACCOUNT = 'BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE';
export const YOS_TOKEN_ACCOUNT = '5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz';

// Liquidity pool information
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
export const SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Admin wallet
export const ADMIN_WALLET = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

// Raydium Devnet info
export const RAYDIUM_USDC_MINT = '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U';
export const RAYDIUM_ROUTER_ADDRESS = 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU';

// Swap parameters
export const SWAP_FEE = 0.1; // 0.1% fee
export const YOS_DISPLAY_NORMALIZATION_FACTOR = 9260; // Scale factor for YOS display

// Staking parameters
export const STAKING_RATE_DIVISOR = 1000000.0; // Divisor for staking rate calculation
export const STAKING_MAX_RATE = 10000; // Maximum staking rate (in basis points)

// Token display parameters
export const SOL_DECIMALS = 9;
export const YOT_DECIMALS = 9;
export const YOS_DECIMALS = 9;

// Token symbols
export const SOL_SYMBOL = 'SOL';
export const YOT_SYMBOL = 'YOT';
export const YOS_SYMBOL = 'YOS';

// Program parameters
export const YOS_WALLET_DISPLAY_ADJUSTMENT = 1000;
export const PROGRAM_SCALING_FACTOR = 1000000;
export const OWNER_COMMISSION_PERCENT = 0.1;