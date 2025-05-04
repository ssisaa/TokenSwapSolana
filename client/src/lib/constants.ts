import { clusterApiUrl, Cluster } from '@solana/web3.js';

// Token addresses - Solana Devnet
export const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112'; // Native SOL token address
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Test token addresses
export const TEST_TOKENS = {
  MTA: 'MTAwpfGYQbnJkjB2iHUNpGV4yxkpJpgAQNHpg3ZJXKd',
  SAMX: 'SAMXjJJa4XShbsyK3ZK1qUKgHs45u8YUySGBbKctwKX',
  XAR: '9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa', // Updated with actual token
  XMP: 'HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs', // Updated with actual token
  RAMX: 'RAMXd3mgY5XFyWbfgNh9LT7BcuW5w7jqRFgNkwZEhhsu',
  TRAXX: 'TRXXpN1Y4tAYcfp3QxCKLeVDvUnjGWQvA2HTQ5VTytA',
};

// Token symbols
export const SOL_SYMBOL = 'SOL';
export const YOT_SYMBOL = 'YOT';
export const YOS_SYMBOL = 'YOS';
export const XAR_SYMBOL = 'XAR';
export const XMP_SYMBOL = 'XMP';

// Token accounts
export const YOT_TOKEN_ACCOUNT = 'BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE';
export const YOS_TOKEN_ACCOUNT = '5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz';
export const XAR_TOKEN_ACCOUNT = '9PEtYHDKW4kjah3Jo53gc8STuGshhmoK8LKwfeoiNkrS';
export const XMP_TOKEN_ACCOUNT = 'HL5byzFzKjehJESbuCH6fw8FyKYeCthwq713gCx6j74';

// Pool accounts
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS'; 

// Program IDs
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6'; // Existing staking program
export const MULTI_HUB_SWAP_PROGRAM_ID = 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE'; // Updated V4 program ID

// Program constants
export const PROGRAM_ID = MULTI_HUB_SWAP_PROGRAM_ID; // Default to multi-hub swap program
export const YOT_MINT = YOT_TOKEN_ADDRESS; // YOT mint address
export const YOS_MINT = YOS_TOKEN_ADDRESS; // YOS mint address

// Program seeds
export const PROGRAM_STATE_SEED = "program-state"; // Seed for program state PDA
export const PROGRAM_AUTHORITY_SEED = "program-authority"; // Seed for program authority PDA

// Admin wallet
export const ADMIN_WALLET_ADDRESS = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

// Swap parameters
export const LIQUIDITY_CONTRIBUTION_PERCENT = 20; // 20% of swap goes to SOL-YOT pool
export const YOS_CASHBACK_PERCENT = 5; // 5% of swap converted to YOS as cashback

// Token decimals
export const SOL_DECIMALS = 9;
export const YOT_DECIMALS = 9;
export const YOS_DECIMALS = 9;
export const YOS_DISPLAY_NORMALIZATION_FACTOR = 9260; // Critical fix: Use 9,260 not 10,000
export const YOS_WALLET_DISPLAY_ADJUSTMENT = 9260; // Same as YOS_DISPLAY_NORMALIZATION_FACTOR
export const PROGRAM_SCALING_FACTOR = 9260; // Scaling factor for program calculations

// Staking parameters
export const DEFAULT_STAKE_RATE_PER_SECOND = 0.0000125; // 394.2% APY
export const DEFAULT_HARVEST_THRESHOLD = 1;
export const DEFAULT_STAKE_THRESHOLD = 10;
export const DEFAULT_UNSTAKE_THRESHOLD = 10;

// Raydium Devnet Info
export const RAYDIUM_USDC_MINT = '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U';
export const RAYDIUM_ROUTER_ADDRESS = 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU';

// Cluster
export const SOLANA_CLUSTER = 'devnet';
export const CLUSTER: Cluster = 'devnet'; // For backward compatibility
export const ENDPOINT = clusterApiUrl(CLUSTER);
export const SOLANA_RPC_URL = ENDPOINT;
export const EXPLORER_URL = 'https://explorer.solana.com';
export const CONFIRMATION_COUNT = 1; // Number of confirmations to wait for transactions

// Commission parameters
export const DEFAULT_OWNER_COMMISSION_PERCENT = 0.1; // 0.1% SOL by default
export const MAX_OWNER_COMMISSION_PERCENT = 5; // Maximum 5% allowed

// Swap parameters
export const SWAP_FEE = 0.003; // 0.3% swap fee