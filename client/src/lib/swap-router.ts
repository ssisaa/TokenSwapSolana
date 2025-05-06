/**
 * Swap Router Implementation
 * Handles token swaps through Solana smart contracts
 * Supports SOL-YOT and YOT-SOL swaps using on-chain implementation
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { 
  SOL_TOKEN_ADDRESS, 
  YOT_TOKEN_ADDRESS, 
  SOLANA_RPC_URL, 
  DEFAULT_EXCHANGE_RATES
} from './config';
import { buyAndDistribute } from './multi-hub-swap-contract';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Initialize connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Simulates getting exchange rates from an oracle or price feed
 * In production, this would fetch from a reliable price source
 */
export async function getExchangeRate(fromToken: string, toToken: string): Promise<number> {
  // For SOL-YOT and YOT-SOL, use predefined rates
  if (fromToken === SOL_TOKEN_ADDRESS && toToken === YOT_TOKEN_ADDRESS) {
    return DEFAULT_EXCHANGE_RATES.SOL_YOT;
  } else if (fromToken === YOT_TOKEN_ADDRESS && toToken === SOL_TOKEN_ADDRESS) {
    return DEFAULT_EXCHANGE_RATES.YOT_SOL;
  }
  
  // Default fallback - should implement proper price feed in production
  return 1;
}

/**
 * Calculates the expected output amount based on input and current exchange rate
 */
export async function getExpectedOutput(
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ outputAmount: number, minOutputAmount: number, exchangeRate: number }> {
  const exchangeRate = await getExchangeRate(fromTokenAddress, toTokenAddress);
  const outputAmount = inputAmount * exchangeRate;
  
  // Calculate minimum output amount based on slippage tolerance
  const slippageFactor = (100 - slippageTolerance) / 100;
  const minOutputAmount = outputAmount * slippageFactor;
  
  return {
    outputAmount,
    minOutputAmount,
    exchangeRate
  };
}

/**
 * Executes a token swap
 * For SOL-YOT swaps, uses the buyAndDistribute function from multi-hub-swap-contract
 * For other swaps, would connect to other AMMs (not implemented in this demo)
 */
export async function executeSwap(
  wallet: any,
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ signature: string, outputAmount: number, distributionDetails?: any }> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Get expected output amount with slippage tolerance
  const { outputAmount, minOutputAmount } = await getExpectedOutput(
    fromTokenAddress,
    toTokenAddress,
    inputAmount,
    slippageTolerance
  );

  // Case 1: SOL to YOT swap (main focus of Multi-Hub implementation)
  if (fromTokenAddress === SOL_TOKEN_ADDRESS && toTokenAddress === YOT_TOKEN_ADDRESS) {
    // Execute SOL-YOT swap using buyAndDistribute
    const signature = await buyAndDistribute(wallet, inputAmount);
    
    // In this case, the contract handles the distribution automatically:
    // - 75% to user
    // - 20% to liquidity pool
    // - 5% as YOS cashback
    return {
      signature,
      outputAmount,
      distributionDetails: {
        userReceived: outputAmount * 0.75,
        liquidityContribution: outputAmount * 0.20,
        yosCashback: outputAmount * 0.05
      }
    };
  }
  
  // Case 2: YOT to SOL swap (would be implemented via Raydium or Jupiter)
  // Currently stubbed - would need actual AMM integration
  if (fromTokenAddress === YOT_TOKEN_ADDRESS && toTokenAddress === SOL_TOKEN_ADDRESS) {
    throw new Error("YOT to SOL swaps currently under development. Please use SOL to YOT swaps.");
    
    // In production, this would be implemented using:
    // 1. Either a separate Solana program for YOT-SOL swaps
    // 2. Integration with Jupiter or Raydium for routing
  }
  
  // Default case: Unsupported swap pair
  throw new Error(`Swap from ${fromTokenAddress} to ${toTokenAddress} not supported yet`);
}

/**
 * Gets a list of supported swap tokens in the network
 * Focuses on SOL and YOT as the primary pair
 */
export async function getSupportedTokens(): Promise<Array<{ symbol: string, address: string, name: string, logoUrl: string }>> {
  // For now, return hardcoded list of supported tokens
  return [
    {
      symbol: "SOL",
      address: SOL_TOKEN_ADDRESS,
      name: "Solana",
      logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png"
    },
    {
      symbol: "YOT",
      address: YOT_TOKEN_ADDRESS,
      name: "YOT Token",
      logoUrl: "https://place-hold.it/32x32/37c/fff?text=YOT"
    }
  ];
}

/**
 * Checks if a token pair is supported for swapping
 */
export function isSwapSupported(fromToken: string, toToken: string): boolean {
  // Normalize addresses to ensure case-insensitive comparison
  const normalizedFromToken = fromToken.toString().toLowerCase();
  const normalizedToToken = toToken.toString().toLowerCase();
  const normalizedSOL = SOL_TOKEN_ADDRESS.toString().toLowerCase();
  const normalizedYOT = YOT_TOKEN_ADDRESS.toString().toLowerCase();
  
  // SOL-YOT swaps should be supported in both directions
  if ((normalizedFromToken === normalizedSOL && normalizedToToken === normalizedYOT) ||
      (normalizedFromToken === normalizedYOT && normalizedToToken === normalizedSOL)) {
    return true;
  }
  
  return false;
}

/**
 * Gets the estimated gas fees for the swap
 */
export async function getEstimatedFees(fromToken: string, toToken: string): Promise<number> {
  // On Solana, this would be the transaction fee
  // For now return a fixed estimate that's reasonably accurate for these transactions
  return 0.000005; // ~5000 lamports, typical Solana transaction fee
}

/**
 * Gets token balance for a specific token
 */
export async function getTokenBalance(wallet: any, tokenAddress: string): Promise<number> {
  if (!wallet || !wallet.publicKey) {
    return 0;
  }

  try {
    // For SOL, get native SOL balance
    if (tokenAddress === SOL_TOKEN_ADDRESS) {
      const balance = await connection.getBalance(wallet.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } 
    
    // For SPL tokens like YOT
    else {
      const tokenMint = new PublicKey(tokenAddress);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey
      );
      
      try {
        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
        return Number(accountInfo.value.uiAmount);
      } catch (e) {
        // Token account might not exist yet
        return 0;
      }
    }
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return 0;
  }
}