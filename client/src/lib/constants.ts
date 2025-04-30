// Solana endpoints and cluster info
export const ENDPOINT = 'https://api.devnet.solana.com'; // Devnet endpoint for development
export const CLUSTER = 'devnet'; // Current Solana cluster
export const EXPLORER_URL = 'https://explorer.solana.com'; // Solana Explorer base URL

// Token addresses on Solana devnet
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Token symbols
export const SOL_SYMBOL = 'SOL';
export const YOT_SYMBOL = 'YOT';
export const YOS_SYMBOL = 'YOS';

// Token accounts
export const YOT_TOKEN_ACCOUNT = 'BtHDQ6QwAffeeGftkNQK8X22n7HfnX3dud5vVsPZdqzE';
export const YOS_TOKEN_ACCOUNT = 'BLz2mfhb9qoPAtKuFNVfrj9uTEyChHKKbZsniS1eRaUB';

// Program info
export const MULTI_HUB_SWAP_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6'; // Using same program ID for now

// Admin wallet
export const ADMIN_WALLET_ADDRESS = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

// Pool info
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
export const SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS'; // Same as SOL_ACCOUNT

// YOS display normalization and program scaling factors
export const YOS_DISPLAY_NORMALIZATION_FACTOR = 9260;
export const YOS_WALLET_DISPLAY_ADJUSTMENT = 9260;  // Used in staking calculations
export const PROGRAM_SCALING_FACTOR = 1000000.0;    // Divisor used in program rate calculations

// Owner commission (initially 0.1%)
export const OWNER_COMMISSION_PERCENT = 0.1;
export const SWAP_FEE = 0.003;  // 0.3% swap fee

// Devnet Raydium info
export const RAYDIUM_USDC_MINT = '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U';
export const RAYDIUM_ROUTER_ADDRESS = 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU';

// Standard token decimals
export const SOL_DECIMALS = 9;
export const YOT_DECIMALS = 9;
export const YOS_DECIMALS = 9;
export const USDC_DECIMALS = 6;