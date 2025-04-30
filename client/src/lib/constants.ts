import { Cluster, clusterApiUrl } from '@solana/web3.js';

// Network configuration
export const CLUSTER: Cluster = 'devnet';
export const ENDPOINT = clusterApiUrl(CLUSTER);
export const SOLANA_RPC_URL = ENDPOINT;

// YOT Token (main token)
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOT_TOKEN_ACCOUNT = 'BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE';
export const YOT_DECIMALS = 9; // CRITICAL FIX: Both YOT and YOS use 9 decimals as per Solana standard

// YOS Token (staking reward token)
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
export const YOS_TOKEN_ACCOUNT = 'BLz2mfhb9qoPAtKuFNVfrj9uTEyChHKKbZsniS1eRaUB';
export const YOS_DECIMALS = 9; // Most Solana tokens have 9 decimals

// Swap/Liquidity Pool
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Explorer URL
export const EXPLORER_URL = 'https://explorer.solana.com';

// Swap fee (0.3%)
export const SWAP_FEE = 0.003;

// Token symbols
export const SOL_SYMBOL = 'SOL';
export const YOT_SYMBOL = 'YOT';
export const YOS_SYMBOL = 'YOS';

// Number of confirmations required for a transaction
export const CONFIRMATION_COUNT = 1;

// Staking Program ID
// Real program ID for YOT staking program
// Updated on: April 27, 2025
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';

// TOKEN DECIMAL SETTINGS - EXACT VALUES WITH NO ADJUSTMENTS
// Based on user requirements: "Want exacted amount what user staked not some extra multiple"
// We are removing all adjustment factors and using raw blockchain values directly

// CRITICAL: Set program scaling factor to 1 (no scaling)
// The program does not use any scaling factor - just direct token decimal conversion (9 decimals)
export const PROGRAM_SCALING_FACTOR = 1;

// CRITICAL: Remove YOS display adjustment to show exact values
// User demands exact amounts with no adjustments
export const YOS_WALLET_DISPLAY_ADJUSTMENT = 1;
