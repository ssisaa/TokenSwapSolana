/**
 * Configuration constants for the application
 * 
 * This file contains all the important addresses and constants used throughout the application.
 */

// Program IDs
export const SIMPLIFIED_SWAP_PROGRAM_ID = 'Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP';
export const STAKING_PROGRAM_ID = '6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6';
export const MULTI_HUB_SWAP_PROGRAM_ID = 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE';

// Token addresses
export const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
export const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';

// Pool accounts
export const SOL_POOL_WALLET = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
export const YOT_POOL_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
export const YOS_POOL_TOKEN_ACCOUNT = '7GnphdpgcV5Z8swNAFB8QkMdo43TPHa4SmdtUw1ApMxz';

// Administrative wallets
export const ADMIN_WALLET_ADDRESS = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';
export const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// Swap settings
export const DEFAULT_SLIPPAGE_PERCENTAGE = 5; // 5% slippage by default
export const MIN_SOL_AMOUNT = 0.001; // Minimum SOL amount for swaps
export const AUTO_LIQUIDITY_THRESHOLD = 0.1; // 0.1 SOL threshold for auto liquidity contribution

// Distribution ratios
export const SOL_DISTRIBUTION_RATIO = 80; // 80% of SOL goes to pool, 20% to common wallet
export const YOT_DISTRIBUTION_RATIO = 80; // 80% of YOT goes to user, 20% to common wallet
export const YOS_CASHBACK_PERCENTAGE = 5; // 5% YOS cashback on the total YOT amount

// Token display settings
export const TOKEN_DECIMALS = {
  SOL: 9,
  YOT: 9,
  YOS: 9,
};

// Network settings
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet' | 'localnet';
export const SOLANA_NETWORK: SolanaNetwork = 'devnet';
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Get Solana RPC endpoint URL based on the configured network
 */
export function getRpcEndpoint(): string {
  // Using an object lookup with the SolanaNetwork type for type safety
  const endpoints: Record<SolanaNetwork, string> = {
    'mainnet-beta': 'https://api.mainnet-beta.solana.com',
    'testnet': 'https://api.testnet.solana.com',
    'devnet': 'https://api.devnet.solana.com',
    'localnet': 'http://localhost:8899'
  };
  
  return endpoints[SOLANA_NETWORK];
}