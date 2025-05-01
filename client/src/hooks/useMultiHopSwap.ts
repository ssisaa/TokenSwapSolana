import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@/hooks/useSolanaWallet";
import { getTokenBalance, getSolBalance } from "@/lib/solana";
import { formatCurrency } from "@/lib/utils";
import { 
  SOL_SYMBOL, 
  YOT_SYMBOL,
  YOS_SYMBOL,
} from "@/lib/constants";

// Define token symbols for XAR and XMR
export const XAR_SYMBOL = "XAR";
export const XMR_SYMBOL = "XMR";

// Define token addresses
export const XAR_TOKEN_ADDRESS = "9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa";
export const XMR_TOKEN_ADDRESS = "HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs";

// Implement a multi-hop swap leveraging the existing SOL-YOT swap functionality
export function useMultiHopSwap() {
  const { wallet, connected } = useWallet();
  
  // Token selection state
  const [fromToken, setFromToken] = useState(XAR_SYMBOL);
  const [toToken, setToToken] = useState(YOT_SYMBOL);
  const [intermediateToken, setIntermediateToken] = useState(SOL_SYMBOL); // Default intermediate is SOL
  
  // Amount state
  const [fromAmount, setFromAmount] = useState<number | string>("");
  const [toAmount, setToAmount] = useState<number | string>("");
  
  // Balance state
  const [fromBalance, setFromBalance] = useState(0);
  const [toBalance, setToBalance] = useState(0);
  
  // UI state
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [exchangeRate, setExchangeRate] = useState("Loading...");
  const [swapRoute, setSwapRoute] = useState<string[]>([]);
  
  // Function to update token balances when wallet or tokens change
  const updateBalances = useCallback(async () => {
    if (!connected || !wallet?.publicKey) {
      setFromBalance(0);
      setToBalance(0);
      return;
    }
    
    try {
      const publicKey = wallet.publicKey;
      
      // Get balances for all tokens
      const solBalance = await getSolBalance(publicKey);
      let xarBalance = 0;
      let xmrBalance = 0;
      let yotBalance = 0;
      
      try {
        xarBalance = await getTokenBalance(XAR_TOKEN_ADDRESS, publicKey);
      } catch (err) {
        console.log("XAR token account may not exist yet");
      }
      
      try {
        xmrBalance = await getTokenBalance(XMR_TOKEN_ADDRESS, publicKey);
      } catch (err) {
        console.log("XMR token account may not exist yet");
      }
      
      try {
        yotBalance = await getTokenBalance("2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF", publicKey);
      } catch (err) {
        console.log("YOT token account may not exist yet");
      }
      
      // Update from and to balances based on selected tokens
      if (fromToken === XAR_SYMBOL) {
        setFromBalance(xarBalance);
      } else if (fromToken === XMR_SYMBOL) {
        setFromBalance(xmrBalance);
      } else if (fromToken === SOL_SYMBOL) {
        setFromBalance(solBalance);
      } else if (fromToken === YOT_SYMBOL) {
        setFromBalance(yotBalance);
      }
      
      if (toToken === XAR_SYMBOL) {
        setToBalance(xarBalance);
      } else if (toToken === XMR_SYMBOL) {
        setToBalance(xmrBalance);
      } else if (toToken === SOL_SYMBOL) {
        setToBalance(solBalance);
      } else if (toToken === YOT_SYMBOL) {
        setToBalance(yotBalance);
      }
      
    } catch (error) {
      console.error("Error updating balances:", error);
    }
  }, [connected, wallet, fromToken, toToken]);
  
  // Update balances and exchange rate when component mounts or dependencies change
  useEffect(() => {
    updateBalances();
    updateExchangeRate();
    
    // Determine the swap route
    const route = determineSwapRoute(fromToken, toToken);
    setSwapRoute(route);
    
    // Update periodically
    const interval = setInterval(() => {
      updateBalances();
      updateExchangeRate();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [updateBalances, fromToken, toToken]);
  
  // Function to determine the swap route
  const determineSwapRoute = (from: string, to: string): string[] => {
    // Direct swap between SOL and YOT
    if ((from === SOL_SYMBOL && to === YOT_SYMBOL) || 
        (from === YOT_SYMBOL && to === SOL_SYMBOL)) {
      return [from, to];
    }
    
    // Multi-hop swap through SOL for other combinations
    if (from !== SOL_SYMBOL && to !== SOL_SYMBOL) {
      return [from, SOL_SYMBOL, to];
    }
    
    return [from, to];
  };
  
  // Update exchange rate display
  const updateExchangeRate = useCallback(async () => {
    try {
      // Determine route for calculation
      const route = determineSwapRoute(fromToken, toToken);
      
      // For now, we're using fixed exchange rates for simplicity
      // In a real implementation, these would be fetched from a DEX/liquidity pool
      
      if (route.length === 2) {
        // Direct swap
        if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
          // Use the existing SOL-YOT exchange rate from pool data
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          setExchangeRate(`1 SOL = ${formatCurrency(rates.solToYot, 2)} YOT`);
        } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          setExchangeRate(`1 YOT = ${formatCurrency(rates.yotToSol, 8)} SOL`);
        }
      } else if (route.length === 3) {
        // Multi-hop swap using SOL as intermediate
        if (fromToken === XAR_SYMBOL && toToken === YOT_SYMBOL) {
          // Fetch X_AR/SOL rate and SOL/YOT rate
          // Note: Using fixed rate for XAR/SOL temporarily, would fetch from Raydium in real case
          const xarToSolRate = 0.5; // 1 XAR = 0.5 SOL (example rate)
          
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          
          const totalRate = xarToSolRate * rates.solToYot;
          setExchangeRate(`1 XAR ≈ ${formatCurrency(totalRate, 2)} YOT via SOL`);
        } else if (fromToken === XMR_SYMBOL && toToken === YOT_SYMBOL) {
          // Fetch XMR/SOL rate and SOL/YOT rate
          // Note: Using fixed rate for XMR/SOL temporarily, would fetch from Raydium in real case
          const xmrToSolRate = 0.75; // 1 XMR = 0.75 SOL (example rate)
          
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          
          const totalRate = xmrToSolRate * rates.solToYot;
          setExchangeRate(`1 XMR ≈ ${formatCurrency(totalRate, 2)} YOT via SOL`);
        } else if (fromToken === YOT_SYMBOL && toToken === XAR_SYMBOL) {
          // Reverse route: YOT -> SOL -> XAR
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          
          // Note: Using fixed rate for SOL/XAR temporarily
          const solToXarRate = 2.0; // 1 SOL = 2 XAR (example rate)
          
          const totalRate = rates.yotToSol * solToXarRate;
          setExchangeRate(`1 YOT ≈ ${formatCurrency(totalRate, 8)} XAR via SOL`);
        } else if (fromToken === YOT_SYMBOL && toToken === XMR_SYMBOL) {
          // Reverse route: YOT -> SOL -> XMR
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          
          // Note: Using fixed rate for SOL/XMR temporarily
          const solToXmrRate = 1.33; // 1 SOL = 1.33 XMR (example rate)
          
          const totalRate = rates.yotToSol * solToXmrRate;
          setExchangeRate(`1 YOT ≈ ${formatCurrency(totalRate, 8)} XMR via SOL`);
        }
      }
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      setExchangeRate("Rate unavailable");
    }
  }, [fromToken, toToken]);
  
  // Function to calculate output amount based on input amount
  const calculateToAmount = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) {
      setToAmount("");
      return;
    }
    
    try {
      const route = determineSwapRoute(fromToken, toToken);
      
      if (route.length === 2) {
        // Direct swap (SOL-YOT)
        if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
          // Use existing calculation
          const { calculateSolToYot } = await import("@/lib/solana");
          const result = await calculateSolToYot(amount);
          setToAmount(result);
        } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
          // Use existing calculation
          const { calculateYotToSol } = await import("@/lib/solana");
          const result = await calculateYotToSol(amount);
          setToAmount(result);
        }
      } else if (route.length === 3) {
        // Multi-hop swap using SOL as intermediate
        if (fromToken === XAR_SYMBOL && toToken === YOT_SYMBOL) {
          // Step 1: XAR -> SOL (fixed rate for demo)
          const xarToSolRate = 0.5; // 1 XAR = 0.5 SOL
          const solAmount = amount * xarToSolRate;
          
          // Step 2: SOL -> YOT (using existing functionality)
          const { calculateSolToYot } = await import("@/lib/solana");
          const result = await calculateSolToYot(solAmount);
          setToAmount(result);
        } else if (fromToken === XMR_SYMBOL && toToken === YOT_SYMBOL) {
          // Step 1: XMR -> SOL (fixed rate for demo)
          const xmrToSolRate = 0.75; // 1 XMR = 0.75 SOL
          const solAmount = amount * xmrToSolRate;
          
          // Step 2: SOL -> YOT (using existing functionality)
          const { calculateSolToYot } = await import("@/lib/solana");
          const result = await calculateSolToYot(solAmount);
          setToAmount(result);
        } else if (fromToken === YOT_SYMBOL && toToken === XAR_SYMBOL) {
          // Step 1: YOT -> SOL (using existing functionality)
          const { calculateYotToSol } = await import("@/lib/solana");
          const solAmount = await calculateYotToSol(amount);
          
          // Step 2: SOL -> XAR (fixed rate for demo)
          const solToXarRate = 2.0; // 1 SOL = 2 XAR
          const result = solAmount * solToXarRate;
          setToAmount(result);
        } else if (fromToken === YOT_SYMBOL && toToken === XMR_SYMBOL) {
          // Step 1: YOT -> SOL (using existing functionality)
          const { calculateYotToSol } = await import("@/lib/solana");
          const solAmount = await calculateYotToSol(amount);
          
          // Step 2: SOL -> XMR (fixed rate for demo)
          const solToXmrRate = 1.33; // 1 SOL = 1.33 XMR
          const result = solAmount * solToXmrRate;
          setToAmount(result);
        }
      }
    } catch (error) {
      console.error("Error calculating swap amount:", error);
      setToAmount("");
    }
  }, [fromToken, toToken]);
  
  // Function to calculate input amount based on desired output amount
  const calculateFromAmount = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) {
      setFromAmount("");
      return;
    }
    
    try {
      const route = determineSwapRoute(fromToken, toToken);
      
      if (route.length === 2) {
        // Direct swap (SOL-YOT)
        if (toToken === YOT_SYMBOL && fromToken === SOL_SYMBOL) {
          // Estimate SOL needed based on YOT amount (simplified version)
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          // Account for swap fee (0.3%)
          const result = amount / rates.solToYot / (1 - 0.003);
          setFromAmount(result);
        } else if (toToken === SOL_SYMBOL && fromToken === YOT_SYMBOL) {
          // Estimate YOT needed based on SOL amount
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          // Account for swap fee (0.3%)
          const result = amount / rates.yotToSol / (1 - 0.003);
          setFromAmount(result);
        }
      } else if (route.length === 3) {
        // Multi-hop swap using SOL as intermediate
        if (toToken === YOT_SYMBOL && fromToken === XAR_SYMBOL) {
          // Step 1: Estimate SOL needed for YOT
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          // Account for swap fee (0.3%) on both hops
          const solNeeded = amount / rates.solToYot / (1 - 0.003);
          
          // Step 2: Estimate XAR needed for that SOL amount
          const xarToSolRate = 0.5; // 1 XAR = 0.5 SOL
          const result = solNeeded / xarToSolRate / (1 - 0.003);
          setFromAmount(result);
        } else if (toToken === YOT_SYMBOL && fromToken === XMR_SYMBOL) {
          // Step 1: Estimate SOL needed for YOT
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          // Account for swap fee (0.3%) on both hops
          const solNeeded = amount / rates.solToYot / (1 - 0.003);
          
          // Step 2: Estimate XMR needed for that SOL amount
          const xmrToSolRate = 0.75; // 1 XMR = 0.75 SOL
          const result = solNeeded / xmrToSolRate / (1 - 0.003);
          setFromAmount(result);
        } else if (toToken === XAR_SYMBOL && fromToken === YOT_SYMBOL) {
          // Step 1: Estimate SOL needed for XAR
          const solToXarRate = 2.0; // 1 SOL = 2 XAR
          const solNeeded = amount / solToXarRate / (1 - 0.003);
          
          // Step 2: Estimate YOT needed for that SOL amount
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          const result = solNeeded / rates.yotToSol / (1 - 0.003);
          setFromAmount(result);
        } else if (toToken === XMR_SYMBOL && fromToken === YOT_SYMBOL) {
          // Step 1: Estimate SOL needed for XMR
          const solToXmrRate = 1.33; // 1 SOL = 1.33 XMR
          const solNeeded = amount / solToXmrRate / (1 - 0.003);
          
          // Step 2: Estimate YOT needed for that SOL amount
          const { getExchangeRate } = await import("@/lib/solana");
          const rates = await getExchangeRate();
          const result = solNeeded / rates.yotToSol / (1 - 0.003);
          setFromAmount(result);
        }
      }
    } catch (error) {
      console.error("Error calculating swap amount:", error);
      setFromAmount("");
    }
  }, [fromToken, toToken]);
  
  // Function to switch tokens
  const switchTokens = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  }, [fromToken, toToken, fromAmount, toAmount]);
  
  // Function to execute the swap
  const executeSwap = useCallback(async () => {
    if (!connected || !wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!fromAmount || parseFloat(fromAmount.toString()) <= 0) {
      throw new Error("Invalid amount");
    }
    
    setIsPending(true);
    setIsSuccess(false);
    setError(null);
    
    try {
      const amount = parseFloat(fromAmount.toString());
      const route = determineSwapRoute(fromToken, toToken);
      let result;
      
      if (route.length === 2) {
        // Direct swap
        if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
          // Use existing SOL to YOT swap
          const { swapSolToYot } = await import("@/lib/solana");
          result = await swapSolToYot(wallet, amount);
        } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
          // Use existing YOT to SOL swap
          const { swapYotToSol } = await import("@/lib/solana");
          result = await swapYotToSol(wallet, amount);
        }
      } else if (route.length === 3) {
        // For multi-hop swaps, we'll need additional implementation
        // For now, throw an error that this feature is in development
        throw new Error("Multi-hop swaps are currently in development. Please use SOL-YOT direct swaps for now.");
      }
      
      // After transaction completes, mark success
      setIsSuccess(true);
      
      // Reset form
      setFromAmount("");
      setToAmount("");
      
      // Refresh balances after a short delay
      setTimeout(() => {
        updateBalances();
      }, 2000);
      
      return result;
    } catch (error) {
      console.error("Swap execution error:", error);
      setError(error instanceof Error ? error : new Error("Unknown error occurred"));
      throw error;
    } finally {
      setIsPending(false);
    }
  }, [fromToken, toToken, fromAmount, wallet, connected, updateBalances]);
  
  return {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    fromBalance,
    toBalance,
    exchangeRate,
    swapRoute,
    isPending,
    isSuccess,
    error,
    setFromToken,
    setToToken,
    setFromAmount,
    setToAmount,
    switchTokens,
    calculateToAmount,
    calculateFromAmount,
    executeSwap
  };
}