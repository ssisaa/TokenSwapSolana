/**
 * Configuration Loader
 * 
 * This module loads the application configuration from app.config.json in the project root.
 * It serves as the single source of truth for program IDs, token addresses, and other
 * configuration values across the application.
 */

import { PublicKey } from '@solana/web3.js';

// Default configuration values in case the config file cannot be loaded
const defaultConfig = {
  network: "devnet",
  endpoints: {
    devnet: "https://api.devnet.solana.com"
  },
  explorer: {
    url: "https://explorer.solana.com",
    txUrl: "https://explorer.solana.com/tx/",
    accountUrl: "https://explorer.solana.com/address/"
  },
  programs: {
    multiHub: {
      v4: "SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE",
      v3: "Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L",
      v2: "J66SY1YNFyXt6jat8Ek8uAUshxBY2mLrubsMRN4wggt3",
      v1: "3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps"
    },
    staking: "6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6"
  },
  tokens: {
    SOL: "So11111111111111111111111111111111111111112",
    YOT: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
    YOS: "GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n",
    USDC: "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U",
    testTokens: {
      XAR: "9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa",
      XMP: "HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs"
    }
  },
  parameters: {
    swap: {
      liquidityContributionRate: 2000,
      adminFeeRate: 10,
      yosCashbackRate: 300,
      swapFeeRate: 30,
      referralRate: 50
    },
    tokenDecimals: {
      SOL: 9,
      YOT: 9,
      YOS: 9
    },
    yosScalingFactor: 9260
  }
};

// Use the default config until the real config loads
let appConfig = defaultConfig;

// Load the config file asynchronously
async function loadConfig() {
  try {
    console.log('Loading configuration from app.config.json...');
    const response = await fetch('/app.config.json');
    if (!response.ok) {
      console.error('Failed to load app.config.json:', response.statusText);
      console.warn('Using default configuration');
      return;
    }
    
    const loadedConfig = await response.json();
    appConfig = loadedConfig;
    console.log('Successfully loaded configuration from app.config.json');
    
    // Dispatch a custom event to notify components that config is loaded
    window.dispatchEvent(new CustomEvent('config-loaded'));
  } catch (error) {
    console.error('Error loading app.config.json:', error);
    console.warn('Using default configuration');
  }
}

// Call loadConfig immediately
loadConfig();

// Type definitions for better intellisense and type safety
export interface AppConfig {
  network: string;
  endpoints: {
    [network: string]: string;
  };
  explorer: {
    url: string;
    txUrl: string;
    accountUrl: string;
  };
  programs: {
    multiHub: {
      v4: string;
      v3: string;
      v2: string;
      v1: string;
    };
    staking: string;
  };
  tokens: {
    SOL: string;
    YOT: string;
    YOS: string;
    USDC: string;
    testTokens: {
      [symbol: string]: string;
    };
  };
  accounts: {
    admin: string;
    poolAuthority: string;
    poolSol: string;
    yotToken: string;
    yosToken: string;
  };
  parameters: {
    swap: {
      liquidityContributionRate: number;
      adminFeeRate: number;
      yosCashbackRate: number;
      swapFeeRate: number;
      referralRate: number;
    };
    staking: {
      stakeRatePerSecond: number;
      harvestThreshold: number;
      stakeThreshold: number;
      unstakeThreshold: number;
    };
    tokenDecimals: {
      [symbol: string]: number;
    };
    yosScalingFactor: number;
  };
}

// Cast the imported JSON to our typed interface
export const config = appConfig as AppConfig;

// Convenience getters for program IDs
export const getMultiHubProgramId = (version: 'v1' | 'v2' | 'v3' | 'v4' = 'v4'): string => {
  return config.programs.multiHub[version];
};

export const getMultiHubProgramPublicKey = (version: 'v1' | 'v2' | 'v3' | 'v4' = 'v4'): PublicKey => {
  return new PublicKey(getMultiHubProgramId(version));
};

export const getStakingProgramId = (): string => {
  return config.programs.staking;
};

export const getStakingProgramPublicKey = (): PublicKey => {
  return new PublicKey(getStakingProgramId());
};

// Convenience getters for token addresses
export const getTokenAddress = (symbol: string): string => {
  if (symbol in config.tokens) {
    return config.tokens[symbol as keyof typeof config.tokens];
  }
  
  if (config.tokens.testTokens && symbol in config.tokens.testTokens) {
    return config.tokens.testTokens[symbol];
  }
  
  throw new Error(`Token symbol '${symbol}' not found in configuration`);
};

export const getTokenPublicKey = (symbol: string): PublicKey => {
  return new PublicKey(getTokenAddress(symbol));
};

// Convenience getter for token decimals
export const getTokenDecimals = (symbol: string): number => {
  if (symbol in config.parameters.tokenDecimals) {
    return config.parameters.tokenDecimals[symbol];
  }
  return 9; // default to 9 decimals if not specified
};

// Convenience getter for endpoint URL
export const getEndpoint = (): string => {
  return config.endpoints[config.network];
};

// Export the full config and convenience functions
export default {
  config,
  getMultiHubProgramId,
  getMultiHubProgramPublicKey,
  getStakingProgramId,
  getStakingProgramPublicKey,
  getTokenAddress,
  getTokenPublicKey,
  getTokenDecimals,
  getEndpoint
};