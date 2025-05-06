/**
 * Swap Router Implementation
 * Handles token swaps through Solana smart contracts
 * Supports SOL-YOT and YOT-SOL swaps using on-chain implementation
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { 
  SOL_TOKEN_ADDRESS, 
  YOT_TOKEN_ADDRESS, 
  SOLANA_RPC_URL
} from './config';
import { buyAndDistribute } from './multi-hub-swap-contract';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Initialize connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Gets exchange rates from blockchain AMM pools
 * This function should NOT be used directly - use getExchangeRate from solana.ts instead
 * 
 * @deprecated Use getExchangeRate from solana.ts which connects to the actual AMM pool
 */
export async function getExchangeRate(fromToken: string, toToken: string): Promise<number> {
  // This function is deprecated and should not be used
  // Instead use the getExchangeRate function from solana.ts that gets real AMM rates
  throw new Error("This function is deprecated. Use getExchangeRate from solana.ts for real blockchain rates.");
}

/**
 * Calculates the expected output amount based on input and current exchange rate from blockchain
 */
export async function getExpectedOutput(
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ outputAmount: number, minOutputAmount: number, exchangeRate: number }> {
  // Import the canonical getExchangeRate from solana.ts
  const { getExchangeRate: getSolanaExchangeRate } = await import('./solana');
  
  try {
    // Normalize addresses to ensure case-insensitive comparison
    const fromTokenLower = fromTokenAddress.toString().toLowerCase();
    const toTokenLower = toTokenAddress.toString().toLowerCase();
    const solTokenLower = SOL_TOKEN_ADDRESS.toString().toLowerCase();
    const yotTokenLower = YOT_TOKEN_ADDRESS.toString().toLowerCase();
    
    let exchangeRate: number;
    
    // Get blockchain-based exchange rate
    if (fromTokenLower === solTokenLower && toTokenLower === yotTokenLower) {
      // SOL to YOT swap
      const rates = await getSolanaExchangeRate();
      if (!rates || !rates.solToYot) {
        throw new Error("Failed to fetch SOL-YOT exchange rate from blockchain");
      }
      exchangeRate = rates.solToYot;
    } else if (fromTokenLower === yotTokenLower && toTokenLower === solTokenLower) {
      // YOT to SOL swap
      const rates = await getSolanaExchangeRate();
      if (!rates || !rates.yotToSol) {
        throw new Error("Failed to fetch YOT-SOL exchange rate from blockchain");
      }
      exchangeRate = rates.yotToSol;
    } else {
      throw new Error(`Swap pair not supported: ${fromTokenAddress} to ${toTokenAddress}`);
    }
    
    const outputAmount = inputAmount * exchangeRate;
    
    // Calculate minimum output amount based on slippage tolerance
    const slippageFactor = (100 - slippageTolerance) / 100;
    const minOutputAmount = outputAmount * slippageFactor;
    
    return {
      outputAmount,
      minOutputAmount,
      exchangeRate
    };
  } catch (error: any) {
    console.error("Error calculating expected output:", error);
    throw new Error(`Failed to calculate expected swap output: ${error.message}`);
  }
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
    console.log("[SOL-YOT SWAP] Input SOL amount:", inputAmount);
    console.log("[SOL-YOT SWAP] Expected YOT output amount:", outputAmount);
    
    // CRITICAL ISSUE: We cannot use buyAndDistribute directly for SOL→YOT
    // The contract expects to approve YOT tokens from the user, but user is sending SOL!
    // We need a different approach that sends SOL to buy YOT

    // Import the solana.ts approach which uses a direct SOL transfer to buy YOT
    const { solToYotSwap } = await import('./solana');
    
    // Execute the SOL to YOT swap
    const signature = await solToYotSwap(wallet, inputAmount);
    console.log("[SOL-YOT SWAP] Transaction signature:", signature);
    
    // The contract handles the distribution automatically:
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
  
  // Debug log to identify comparison issues
  console.log('Token addresses comparison:', {
    fromToken: normalizedFromToken, 
    toToken: normalizedToToken,
    solAddress: normalizedSOL,
    yotAddress: normalizedYOT,
    solToYotMatch: normalizedFromToken === normalizedSOL && normalizedToToken === normalizedYOT,
    yotToSolMatch: normalizedFromToken === normalizedYOT && normalizedToToken === normalizedSOL
  });
  
  // SOL-YOT swaps should be supported in both directions
  if ((normalizedFromToken === normalizedSOL && normalizedToToken === normalizedYOT) ||
      (normalizedFromToken === normalizedYOT && normalizedToToken === normalizedSOL)) {
    console.log("✅ Swap pair is supported");
    return true;
  }
  
  console.log("❌ Swap pair is NOT supported");
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