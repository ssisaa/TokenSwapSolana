/**
 * Configuration constants for the simplified swap program
 * These will be updated after program deployment
 */

// The program ID will be set after deployment
export const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu';

// Constants for token addresses (already defined in config.ts)
export const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
export const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
export const SOL_POOL_WALLET = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
export const YOT_POOL_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
export const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// PDAs will be deterministically derived based on the program ID
export function findProgramStatePda(): string {
  // This will be computed at runtime based on the program ID
  return '';
}

export function findProgramAuthorityPda(): string {
  // This will be computed at runtime based on the program ID
  return '';
}

// Distribution percentages
export const SOL_DISTRIBUTION_RATIO = 80; // 80% to pool, 20% to liquidity wallet
export const YOT_DISTRIBUTION_RATIO = 95; // 95% to user, 5% as YOS cashback