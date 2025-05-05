/**
 * Central configuration system for the application
 * All configuration values are read from app.config.json
 */
import appConfig from '../../../app.config.json';

// Type definitions for the config
export interface SolanaConfig {
  network: string;
  rpcUrl: string;
  programId: string;
  commitment: string;
  explorerUrl: string;
  confirmationCount: number;
  tokens: {
    sol: {
      address: string;
      decimals: number;
      name: string;
      symbol: string;
    };
    yot: {
      address: string;
      decimals: number;
      name: string;
      symbol: string;
      account: string;
    };
    yos: {
      address: string;
      decimals: number;
      name: string;
      symbol: string;
      account: string;
      programAccount: string;
      displayAdjustment: number;
    };
  };
  pool: {
    authority: string;
    solAccount: string;
  };
  multiHubSwap: {
    programId: string;
    programState: string;
    admin: string;
    rates: {
      lpContributionRate: number;
      adminFeeRate: number;
      yosCashbackRate: number;
      swapFeeRate: number;
      referralRate: number;
    };
    amm: {
      raydium: {
        routerAddress: string;
        usdc: string;
      };
      jupiter: {
        enabled: boolean;
        priorityFee: number;
      };
    };
    rewards: {
      weeklyRewardRate: number;
      yearlyAPR: number;
      claimPeriodDays: number;
    };
  };
}

export interface AdminConfig {
  defaultUsername: string;
  maxLiquidityContribution: number;
  defaultLiquidityFee: number;
  stakingRatePerSecond: number;
  harvestThreshold: number;
  programScalingFactor: number;
}

export interface UIConfig {
  theme: string;
  defaultDecimalPlaces: number;
  refreshRateMs: number;
}

export interface FeatureConfig {
  enableSwap: boolean;
  enableStaking: boolean;
  enableLiquidity: boolean;
  enableAdminPanel: boolean;
  enableAnalytics: boolean;
}

// Export config sections
export const solanaConfig: SolanaConfig = appConfig.solana;
export const adminConfig: AdminConfig = appConfig.admin;
export const uiConfig: UIConfig = appConfig.ui;
export const featureConfig: FeatureConfig = appConfig.features;

// Common token addresses
export const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
export const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
export const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;
export const USDC_DEVNET_ADDRESS = solanaConfig.multiHubSwap.amm.raydium.usdc;

// Multi-Hub Swap Program IDs and constants
export const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.multiHubSwap.programId;
export const MULTI_HUB_SWAP_STATE = solanaConfig.multiHubSwap.programState;
export const MULTI_HUB_SWAP_ADMIN = solanaConfig.multiHubSwap.admin;

// Pool information
export const SOL_YOT_POOL_INFO = {
  poolAuthority: solanaConfig.pool.authority,
  solAccount: solanaConfig.pool.solAccount,
};

// Distribution rates (converted from basis points to percentages)
export const DEFAULT_DISTRIBUTION_RATES = {
  userDistribution: 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100), 
  lpContribution: solanaConfig.multiHubSwap.rates.lpContributionRate / 100,   
  yosCashback: solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,       
};

// Fee rates (converted from basis points to percentages)
export const DEFAULT_FEE_RATES = {
  swapFee: solanaConfig.multiHubSwap.rates.swapFeeRate / 100,
  adminFee: solanaConfig.multiHubSwap.rates.adminFeeRate / 100,
  referralFee: solanaConfig.multiHubSwap.rates.referralRate / 100,
};

// APR settings
export const YOS_ANNUAL_APR = solanaConfig.multiHubSwap.rewards.yearlyAPR;
export const WEEKLY_REWARD_RATE = solanaConfig.multiHubSwap.rewards.weeklyRewardRate;
export const SECONDS_PER_WEEK = 604800; // 7 days in seconds

// RPC configuration
export const SOLANA_RPC_URL = solanaConfig.rpcUrl;

// Formatted rates for display
export const FORMATTED_RATES = {
  distributionRates: {
    userReceives: `${DEFAULT_DISTRIBUTION_RATES.userDistribution}%`,
    liquidityPool: `${DEFAULT_DISTRIBUTION_RATES.lpContribution}%`,
    yosCashback: `${DEFAULT_DISTRIBUTION_RATES.yosCashback}%`,
  },
  rewards: {
    annualAPR: `${YOS_ANNUAL_APR}%`,
    weeklyRate: `${WEEKLY_REWARD_RATE}%`,
  },
  fees: {
    swapFee: `${DEFAULT_FEE_RATES.swapFee}%`,
    adminFee: `${DEFAULT_FEE_RATES.adminFee}%`,
    referralFee: `${DEFAULT_FEE_RATES.referralFee}%`,
  },
};

// AMM Router configurations
export const RAYDIUM_ROUTER_CONFIG = {
  routerAddress: solanaConfig.multiHubSwap.amm.raydium.routerAddress,
};

// Enable/disable debug mode
export const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Instruction discriminators for the multi-hub swap program
export const BUY_AND_DISTRIBUTE_DISCRIMINATOR = Buffer.from([
  6, 240, 93, 246, 87, 224, 215, 175, // 8-byte discriminator for buy_and_distribute
]);

export const CLAIM_REWARD_DISCRIMINATOR = Buffer.from([
  146, 113, 97, 51, 55, 103, 32, 159, // 8-byte discriminator for claim_weekly_reward
]);

export const WITHDRAW_CONTRIBUTION_DISCRIMINATOR = Buffer.from([
  52, 21, 251, 13, 191, 179, 204, 196, // 8-byte discriminator for withdraw_contribution
]);

export const UPDATE_PARAMETERS_DISCRIMINATOR = Buffer.from([
  98, 103, 208, 178, 254, 106, 239, 67, // 8-byte discriminator for update_parameters
]);

// Default exchange rate fallbacks (only used if AMM data unavailable)
export const DEFAULT_EXCHANGE_RATES = {
  SOL_YOT: 15650,     // 1 SOL = 15,650 YOT
  YOT_SOL: 0.000064,  // 1 YOT = 0.000064 SOL
  USDC_YOT: 105.5,    // 1 USDC = 105.5 YOT
  YOT_USDC: 0.0095,   // 1 YOT = 0.0095 USDC
};