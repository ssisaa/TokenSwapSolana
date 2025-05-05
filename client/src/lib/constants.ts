import { Cluster } from '@solana/web3.js';
import { solanaConfig, adminConfig } from './config';

/**
 * Constants file - All values now sourced from app.config.json
 * through the centralized config module
 */

// Network configuration
export const CLUSTER: Cluster = solanaConfig.network as Cluster;
export const ENDPOINT = solanaConfig.rpcUrl;
export const SOLANA_RPC_URL = ENDPOINT;

// YOT Token (main token)
export const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
export const YOT_TOKEN_ACCOUNT = solanaConfig.tokens.yot.account;
export const YOT_DECIMALS = solanaConfig.tokens.yot.decimals;

// YOS Token (staking reward token)
export const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;
export const YOS_TOKEN_ACCOUNT = solanaConfig.tokens.yos.account;
export const YOS_DECIMALS = solanaConfig.tokens.yos.decimals;

// Swap/Liquidity Pool
export const POOL_AUTHORITY = solanaConfig.pool.authority;
export const POOL_SOL_ACCOUNT = solanaConfig.pool.solAccount;

// Explorer URL
export const EXPLORER_URL = 'https://explorer.solana.com';

// Admin wallet address for commissions
export const ADMIN_WALLET_ADDRESS = solanaConfig.multiHubSwap.admin;

// Commission percentage from app config
export const OWNER_COMMISSION_PERCENT = solanaConfig.multiHubSwap.rates.adminFeeRate / 100;

// Swap fee from app config
export const SWAP_FEE = solanaConfig.multiHubSwap.rates.swapFeeRate / 100;

// Token symbols
export const SOL_SYMBOL = 'SOL';
export const YOT_SYMBOL = 'YOT';
export const YOS_SYMBOL = 'YOS';

// Number of confirmations required for a transaction
export const CONFIRMATION_COUNT = 1;

// Staking Program ID
export const STAKING_PROGRAM_ID = solanaConfig.programId;

// TOKEN DECIMAL SETTINGS - EXACT VALUES WITH NO ADJUSTMENTS
// Based on user requirements: "Want exacted amount what user staked not some extra multiple"
// We are removing all adjustment factors and using raw blockchain values directly

// CRITICAL: Phantom wallet is displaying values in millions
// We need to account for the fact that the Solana program internally uses a scaling factor
export const PROGRAM_SCALING_FACTOR = adminConfig.programScalingFactor;

// CRITICAL: Production YOS token display adjustment
// This MUST match the YOS_DISPLAY_NORMALIZATION_FACTOR in the Solana contract
export const YOS_WALLET_DISPLAY_ADJUSTMENT = solanaConfig.tokens.yos.displayAdjustment;
