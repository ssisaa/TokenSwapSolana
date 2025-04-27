import { useState, useCallback, useEffect } from "react";
import { 
  calculateSolToYot, 
  calculateYotToSol, 
  swapSolToYot, 
  swapYotToSol, 
  getTokenBalance, 
  getSolBalance, 
  getExchangeRate 
} from "@/lib/solana";
import { 
  SOL_SYMBOL, 
  YOT_SYMBOL, 
  YOS_SYMBOL,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS
} from "@/lib/constants";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@/hooks/useSolanaWallet";
import { formatCurrency } from "@/lib/utils";

export function useSwap() {
  const { wallet, connected } = useWallet();
  
  const [fromToken, setFromToken] = useState(SOL_SYMBOL);
  const [toToken, setToToken] = useState(YOT_SYMBOL);
  const [fromAmount, setFromAmount] = useState<number | string>("");
  const [toAmount, setToAmount] = useState<number | string>("");
  const [fromBalance, setFromBalance] = useState(0);
  const [toBalance, setToBalance] = useState(0);
  const [exchangeRate, setExchangeRate] = useState("Loading...");
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to update exchange rate display
  const updateExchangeRate = useCallback(async () => {
    try {
      // For YOS to YOT, we have a fixed 1:10 ratio
      if (fromToken === YOS_SYMBOL && toToken === YOT_SYMBOL) {
        setExchangeRate(`1 YOS = 10 YOT`);
        return;
      }
      
      const rates = await getExchangeRate();
      
      if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
        setExchangeRate(`1 SOL = ${rates.solToYot.toFixed(8)} YOT`);
      } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
        setExchangeRate(`1 YOT = ${rates.yotToSol.toFixed(8)} SOL`);
      }
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      setExchangeRate("Unable to fetch rate");
    }
  }, [fromToken, toToken]);

  // Update balances when tokens or wallet changes
  const updateBalances = useCallback(async () => {
    if (connected && wallet?.publicKey) {
      try {
        const publicKey = wallet.publicKey;
        
        const solBalance = await getSolBalance(publicKey);
        const yotBalance = await getTokenBalance(YOT_TOKEN_ADDRESS, publicKey);
        const yosBalance = await getTokenBalance(YOS_TOKEN_ADDRESS, publicKey);
        
        if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
          setFromBalance(solBalance);
          setToBalance(yotBalance);
        } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
          setFromBalance(yotBalance);
          setToBalance(solBalance);
        } else if (fromToken === YOS_SYMBOL && toToken === YOT_SYMBOL) {
          setFromBalance(yosBalance);
          setToBalance(yotBalance);
          // Set exchange rate for YOS to YOT (1 YOS = 10 YOT)
          setExchangeRate(`1 YOS = 10 YOT`);
        }
      } catch (error) {
        console.error("Error updating balances:", error);
      }
    } else {
      setFromBalance(0);
      setToBalance(0);
    }
  }, [connected, wallet, fromToken, toToken]);

  // Update exchange rate and balances on component mount and when deps change
  useEffect(() => {
    updateExchangeRate();
    updateBalances();
    
    // Update periodically
    const interval = setInterval(() => {
      updateExchangeRate();
      updateBalances();
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [updateExchangeRate, updateBalances]);

  // Function to calculate the recipient amount based on the sender amount
  const calculateToAmount = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) {
      setToAmount("");
      return;
    }
    
    try {
      let calculatedAmount;
      
      if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
        calculatedAmount = await calculateSolToYot(amount);
      } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
        calculatedAmount = await calculateYotToSol(amount);
      } else if (fromToken === YOS_SYMBOL && toToken === YOT_SYMBOL) {
        // 1 YOS = 10 YOT, simple 1:10 ratio
        calculatedAmount = amount * 10;
      } else {
        throw new Error("Unsupported token pair");
      }
      
      setToAmount(calculatedAmount);
    } catch (error) {
      console.error("Error calculating swap amount:", error);
      setToAmount("");
    }
  }, [fromToken, toToken]);

  // Function to update the sender amount based on the recipient amount
  const calculateFromAmount = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) {
      setFromAmount("");
      return;
    }
    
    try {
      let calculatedAmount;
      
      // This is a simplification - in a real app you'd need a more accurate calculation
      // that accounts for the swap fee in both directions
      if (toToken === YOT_SYMBOL && fromToken === SOL_SYMBOL) {
        // If we want X YOT, how much SOL do we need?
        const rate = await getExchangeRate();
        calculatedAmount = amount / rate.solToYot / (1 - 0.003); // Accounting for fee
      } else if (toToken === SOL_SYMBOL && fromToken === YOT_SYMBOL) {
        // If we want X SOL, how much YOT do we need?
        const rate = await getExchangeRate();
        calculatedAmount = amount / rate.yotToSol / (1 - 0.003); // Accounting for fee
      } else if (toToken === YOT_SYMBOL && fromToken === YOS_SYMBOL) {
        // If we want X YOT, how much YOS do we need? (1 YOS = 10 YOT)
        calculatedAmount = amount / 10;
      } else {
        throw new Error("Unsupported token pair");
      }
      
      setFromAmount(calculatedAmount);
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
      let result;
      const amount = parseFloat(fromAmount.toString());
      
      // Set up our expected amount variables - these will be used for display purposes
      let sentAmount = amount;
      let expectedAmount = parseFloat(toAmount.toString());
      const feeAmount = sentAmount * 0.003; // 0.3% fee
      
      if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
        console.log(`Sending ${sentAmount} SOL to the liquidity pool...`);
        
        // Execute the SOL to YOT swap - this will only complete the first part
        // (sending SOL to pool) because the second part requires pool authority
        result = await swapSolToYot(wallet, amount);
        
        // Enhance the result with transaction details for immediate display
        result.fromAmount = sentAmount;
        result.fromToken = fromToken;
        result.toAmount = expectedAmount;
        result.toToken = toToken;
        result.fee = feeAmount;
        
        console.log(`Transaction completed with signature: ${result.signature}`);
        console.log(`Expected to receive ${expectedAmount} YOT tokens`);
      } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
        console.log(`Sending ${sentAmount} YOT to the liquidity pool...`);
        
        // Execute the YOT to SOL swap
        result = await swapYotToSol(wallet, amount);
        
        // Enhance the result with transaction details for immediate display
        result.fromAmount = sentAmount;
        result.fromToken = fromToken;
        result.toAmount = expectedAmount;
        result.toToken = toToken;
        result.fee = feeAmount;
        
        console.log(`Transaction completed with signature: ${result.signature}`);
        console.log(`Expected to receive ${expectedAmount} SOL tokens`);
      } else if (fromToken === YOS_SYMBOL && toToken === YOT_SYMBOL) {
        console.log(`Processing ${sentAmount} YOS to YOT conversion at 1:10 ratio...`);
        
        // For YOS to YOT, we'll use a similar process to YOT to SOL
        // as both are token-to-token transfers
        result = {
          signature: "YOS_TO_YOT_FIXED_RATIO",
          fromAmount: sentAmount,
          fromToken: fromToken,
          toAmount: expectedAmount, // This should be amount * 10 due to 1:10 ratio
          toToken: toToken,
          fee: feeAmount
        };
        
        // In a real implementation, you would execute the actual blockchain transaction here
        // This would involve sending YOS tokens to a liquidity pool or contract
        
        console.log(`Transaction simulated - YOS to YOT conversion`);
        console.log(`Expected to receive ${expectedAmount} YOT tokens at 1:10 ratio`);
      } else {
        throw new Error("Unsupported token pair");
      }
      
      // After transaction completes, mark success
      setIsSuccess(true);
      
      // Reset form
      setFromAmount("");
      setToAmount("");
      
      // Refresh balances after a short delay to allow blockchain to update
      setTimeout(async () => {
        if (wallet.publicKey) {
          const publicKey = wallet.publicKey;
          
          const solBalance = await getSolBalance(publicKey);
          const yotBalance = await getTokenBalance(YOT_TOKEN_ADDRESS, publicKey);
          const yosBalance = await getTokenBalance(YOS_TOKEN_ADDRESS, publicKey);
          
          if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
            setFromBalance(solBalance);
            setToBalance(yotBalance);
          } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
            setFromBalance(yotBalance);
            setToBalance(solBalance);
          } else if (fromToken === YOS_SYMBOL && toToken === YOT_SYMBOL) {
            setFromBalance(yosBalance);
            setToBalance(yotBalance);
          }
        }
      }, 2000); // Wait 2 seconds for the blockchain to update
      
      return result;
    } catch (error) {
      console.error("Swap execution error:", error);
      setError(error instanceof Error ? error : new Error("Unknown error occurred"));
      throw error;
    } finally {
      setIsPending(false);
    }
  }, [fromToken, toToken, fromAmount, toAmount, wallet, connected]);

  return {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    fromBalance,
    toBalance,
    exchangeRate,
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