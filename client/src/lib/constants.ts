// Solana endpoint
export const ENDPOINT = 'https://api.devnet.solana.com';

// YOT token address on Devnet
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOT_TOKEN_ACCOUNT = 'BtHDQ6QwAffeeGftkNQK8X22n7HfnX3dud5vVsPZdqzE';
export const YOT_SYMBOL = 'YOT';

// YOS token address on Devnet
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
export const YOS_TOKEN_ACCOUNT = 'BLz2mfhb9qoPAtKuFNVfrj9uTEyChHKKbZsniS1eRaUB';
export const PROGRAM_YOS_TOKEN_ACCOUNT = '5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz';
export const YOS_SYMBOL = 'YOS';

// Token decimals
export const YOT_DECIMALS = 9;
export const YOS_DECIMALS = 9;
export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

// Multi-hub swap program ID
export const PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';

// SOL token address (wrapped SOL mint on Solana)
export const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';
export const SOL_SYMBOL = 'SOL';

// Admin wallet address (used for admin operations)
export const ADMIN_WALLET_ADDRESS = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

// Pool authority address (used for liquidity pool operations)
export const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';

// Pool SOL account 
export const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Cluster settings
export const CLUSTER = 'devnet';
export const EXPLORER_URL = 'https://explorer.solana.com';

// Raydium Devnet constants
export const RAYDIUM = {
  // Router address on Devnet
  ROUTER_ADDRESS: 'BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU',
  
  // USDC token on Devnet
  USDC_ADDRESS: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U',
  
  // SOL-USDC pool address
  SOL_USDC_POOL: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
  
  // AMM program ID
  AMM_PROGRAM_ID: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  
  // Liquidity program ID
  LIQUIDITY_PROGRAM_ID: '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h'
};

// Fixed token distribution percentages
export const DISTRIBUTION = {
  USER_PERCENTAGE: 75, // 75% of tokens go to the user
  LIQUIDITY_PERCENTAGE: 20, // 20% goes to liquidity pool
  CASHBACK_PERCENTAGE: 5, // 5% given as YOS cashback
};

// Swap fees
export const SWAP_FEE = 0.005; // 0.5% swap fee

// YOS Staking APR (annual percentage rate)
export const YOS_STAKING_APR = 100; // 100% APR in YOS

// Owner commission (percentage of transaction in SOL)
export const OWNER_COMMISSION_PERCENTAGE = 0.1; // 0.1% default
export const OWNER_COMMISSION_PERCENT = 0.1; // Alias for backward compatibility

// YOS display normalization factor (for UI)
export const YOS_DISPLAY_NORMALIZATION_FACTOR = 9260; // Not 10,000
export const YOS_WALLET_DISPLAY_ADJUSTMENT = 9260;
export const PROGRAM_SCALING_FACTOR = 9260;