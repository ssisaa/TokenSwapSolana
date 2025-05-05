import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Connection, Cluster } from '@solana/web3.js';
// Buffer is available in the browser through vite-plugin-node-polyfills
import { Buffer } from 'buffer';

// Admin configuration section (imported in other files)
export const adminConfig = {
  isProduction: false,
  logLevel: 'debug',
  debugMode: true,
  adminWallets: [
    'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9', // Current YOS mint authority
  ],
};

// Solana configuration section (imported in other files)
export const solanaConfig = {
  network: 'devnet' as Cluster,
  rpcUrl: 'https://api.devnet.solana.com',
  programId: 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE',
  tokens: {
    sol: {
      symbol: 'SOL',
      decimals: 9,
    },
    yot: {
      symbol: 'YOT',
      address: '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw',
      account: 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74',
      decimals: 9,
    },
    yos: {
      symbol: 'YOS',
      address: '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop',
      account: '7GnphdpgcV5Z8swNAFB8QkMdo43TPHa4SmdtUw1ApMxz',
      decimals: 9,
    }
  },
  pool: {
    authority: 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9',
    solAccount: 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH',
  },
  multiHubSwap: {
    admin: 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9',
    rates: {
      adminFeeRate: 0,
      swapFeeRate: 1,
      liquidityContributionRate: 20,
      cashbackRate: 5,
    }
  }
};

// UI configuration section (imported in other files)
export const uiConfig = {
  theme: 'dark',
  yosDisplayNormalizationFactor: 9260,
  animations: true,
  refreshInterval: 60000,
};

// Feature flags (imported in other files)
export const featureConfig = {
  enableSwap: true,
  enableStaking: true,
  enableLiquidity: true,
  showDevTools: false,
};

// Export token addresses separately for easier access
export const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
export const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
export const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;

// Multi-Hub Swap program constants
export const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.programId;
export const MULTI_HUB_SWAP_STATE = "2sR6kFJfCa7oG9hrMWxeTK6ESir7PNZe4vky2JDiNrKC";
export const MULTI_HUB_SWAP_ADMIN = solanaConfig.multiHubSwap.admin;
export const MULTI_HUB_SWAP_PROGRAM_AUTHORITY = "Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ";

// RPC URL
export const SOLANA_RPC_URL = solanaConfig.rpcUrl;

// Instruction discriminators for multi-hub swap program - as Uint8Array
export const BUY_AND_DISTRIBUTE_DISCRIMINATOR = new Uint8Array([105, 37, 101, 197, 75, 251, 102, 170]);
export const CLAIM_REWARD_DISCRIMINATOR = new Uint8Array([52, 93, 120, 41, 170, 136, 40, 241]);
export const WITHDRAW_CONTRIBUTION_DISCRIMINATOR = new Uint8Array([183, 18, 70, 156, 148, 109, 161, 34]);
export const UPDATE_PARAMETERS_DISCRIMINATOR = new Uint8Array([223, 55, 84, 227, 175, 86, 250, 152]);

// Default rates and fees
export const DEFAULT_DISTRIBUTION_RATES = {
  liquidityContributionRate: solanaConfig.multiHubSwap.rates.liquidityContributionRate / 100,
  cashbackRate: solanaConfig.multiHubSwap.rates.cashbackRate / 100
};

export const DEFAULT_FEE_RATES = {
  adminFeeRate: solanaConfig.multiHubSwap.rates.adminFeeRate / 100,
  swapFeeRate: solanaConfig.multiHubSwap.rates.swapFeeRate / 100,
  referralRate: 0
};

export const DEFAULT_EXCHANGE_RATES = {
  solToYot: 0.000007,  // 1 SOL = ~142,857 YOT
  yotToSol: 142857.0   // 1 YOT = ~0.000007 SOL
};

// Formatted rates for display
export const FORMATTED_RATES = {
  liquidityContribution: `${solanaConfig.multiHubSwap.rates.liquidityContributionRate}%`,
  cashback: `${solanaConfig.multiHubSwap.rates.cashbackRate}%`,
  adminFee: `${solanaConfig.multiHubSwap.rates.adminFeeRate}%`,
  swapFee: `${solanaConfig.multiHubSwap.rates.swapFeeRate}%`,
  referral: "0%"
};

// USDC token address on devnet
export const USDC_DEVNET_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Raydium router configuration
export const RAYDIUM_ROUTER_CONFIG = {
  programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  ammProgram: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  ammAuthority: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  tokenProgramId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
};

// SOL/YOT pool information
export const SOL_YOT_POOL_INFO = {
  authority: solanaConfig.pool.authority,
  solAccount: solanaConfig.pool.solAccount
};

// Default configuration
const defaultConfig = {
  // RPC endpoint for Solana
  rpcEndpoint: "https://api.devnet.solana.com",
  
  // Program ID for multi-hub swap
  programId: "SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE",
  
  // Token mints
  yotMint: "9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw",
  yosMint: "2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop",
  
  // Protocol parameters
  liquidityContributionRate: 0.2, // 20%
  adminFeeRate: 0,                // 0%
  cashbackRate: 0.05,             // 5%
  swapFeeRate: 0.01,              // 1%
  referralRate: 0,                // 0%
  
  // Display settings
  yosDisplayNormalizationFactor: 9260,
};

// Keep a local copy of the config that can be modified
let config = { ...defaultConfig };

// Function to get the current config
export function getConfig() {
  return config;
}

// Function to update the config locally
export function updateLocalConfig(newConfig: Partial<typeof config>) {
  config = { ...config, ...newConfig };
  return config;
}

// Hook to update the config on the server
export function useUpdateConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateMutation = useMutation({
    mutationFn: async (newConfig: Partial<typeof config>) => {
      // Update local config immediately
      updateLocalConfig(newConfig);
      
      // Send the update to the server
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate queries that might use this config
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      
      toast({
        title: "Settings Updated",
        description: "Configuration has been updated successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });
  
  return updateMutation.mutate;
}