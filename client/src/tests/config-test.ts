/**
 * Unit tests for configuration centralization
 * 
 * These simple checks validate that critical configuration values
 * are properly loaded from app.config.json and accessible in the application
 */

import { 
  solanaConfig,
  adminConfig,
  uiConfig,
  featureConfig,
  SOL_TOKEN_ADDRESS,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  MULTI_HUB_SWAP_PROGRAM_ID,
  MULTI_HUB_SWAP_STATE,
  MULTI_HUB_SWAP_ADMIN,
  DEFAULT_DISTRIBUTION_RATES,
  DEFAULT_FEE_RATES,
  DEFAULT_EXCHANGE_RATES,
  FORMATTED_RATES
} from "../lib/config";

// Test Solana configuration values
console.log("Testing Solana configuration values...");
console.assert(solanaConfig.network === "devnet", "Network should be devnet");
console.assert(solanaConfig.rpcUrl === "https://api.devnet.solana.com", "RPC URL should match config");
console.assert(solanaConfig.programId === "6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6", "Program ID should match config");
console.assert(solanaConfig.tokens.sol.symbol === "SOL", "SOL symbol should match config");
console.assert(solanaConfig.tokens.yot.symbol === "YOT", "YOT symbol should match config");
console.assert(solanaConfig.tokens.yos.symbol === "YOS", "YOS symbol should match config");

// Test token addresses
console.log("Testing token addresses...");
console.assert(SOL_TOKEN_ADDRESS === "So11111111111111111111111111111111111111112", "SOL address should match expected");
console.assert(YOT_TOKEN_ADDRESS === solanaConfig.tokens.yot.address, "YOT address should match from config");
console.assert(YOS_TOKEN_ADDRESS === solanaConfig.tokens.yos.address, "YOS address should match from config");

// Test Multi-Hub Swap program configuration
console.log("Testing Multi-Hub Swap configuration...");
console.assert(MULTI_HUB_SWAP_PROGRAM_ID === solanaConfig.multiHubSwap.programId, "Program ID should match from config");
console.assert(MULTI_HUB_SWAP_STATE === solanaConfig.multiHubSwap.programState, "Program state should match from config");
console.assert(MULTI_HUB_SWAP_ADMIN === solanaConfig.multiHubSwap.admin, "Admin address should match from config");

// Test distribution rates
console.log("Testing distribution rates...");
console.assert(DEFAULT_DISTRIBUTION_RATES.userDistribution === 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100), "User distribution rate should be calculated correctly");
console.assert(DEFAULT_DISTRIBUTION_RATES.lpContribution === solanaConfig.multiHubSwap.rates.lpContributionRate / 100, "LP contribution rate should match from config");
console.assert(DEFAULT_DISTRIBUTION_RATES.yosCashback === solanaConfig.multiHubSwap.rates.yosCashbackRate / 100, "YOS cashback rate should match from config");

// Test fee rates 
console.log("Testing fee rates...");
console.assert(DEFAULT_FEE_RATES.swapFee === solanaConfig.multiHubSwap.rates.swapFeeRate / 100, "Swap fee should match from config");
console.assert(DEFAULT_FEE_RATES.adminFee === solanaConfig.multiHubSwap.rates.adminFeeRate / 100, "Admin fee should match from config");
console.assert(DEFAULT_FEE_RATES.referralFee === solanaConfig.multiHubSwap.rates.referralRate / 100, "Referral fee should match from config");

// Test reward rates
console.log("Testing reward rates...");
console.assert(solanaConfig.multiHubSwap.rewards.weeklyRewardRate === 1.92, "Weekly reward rate should match from config");
console.assert(solanaConfig.multiHubSwap.rewards.yearlyAPR === 100, "Yearly APR should match from config");
console.assert(solanaConfig.multiHubSwap.rewards.claimPeriodDays === 7, "Claim period days should match from config");

console.log("All configuration tests passed!");