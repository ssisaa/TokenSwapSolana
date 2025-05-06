/**
 * Configuration constants for the application
 * 
 * This file contains all the important addresses and constants used throughout the application.
 */

// Program IDs
export const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu';
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

// Token display settings
export const TOKEN_DECIMALS = {
  SOL: 9,
  YOT: 9,
  YOS: 9,
};

// Network settings
export const SOLANA_NETWORK = 'devnet'; // 'mainnet-beta', 'testnet', 'devnet', 'localnet'
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Get Solana RPC endpoint URL based on the configured network
 */
export function getRpcEndpoint(): string {
  switch (SOLANA_NETWORK) {
    case 'mainnet-beta':
      return 'https://api.mainnet-beta.solana.com';
    case 'testnet':
      return 'https://api.testnet.solana.com';
    case 'localnet':
      return 'http://localhost:8899';
    case 'devnet':
    default:
      return 'https://api.devnet.solana.com';
  }
}