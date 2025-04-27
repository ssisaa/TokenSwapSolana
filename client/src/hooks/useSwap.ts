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
  YOT_TOKEN_ADDRESS 
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
      const rates = await getExchangeRate();
      
      if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
        setExchangeRate(`1 SOL = ${formatCurrency(rates.solToYot)} YOT`);
      } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
        setExchangeRate(`1 YOT = ${formatCurrency(rates.yotToSol)} SOL`);
      }
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      setExchangeRate("Unable to fetch rate");
    }
  }, [fromToken, toToken]);

  // Update balances when tokens or wallet changes
  useEffect(() => {
    const fetchBalances = async () => {
      if (!connected || !wallet?.publicKey) return;
      
      try {
        const publicKey = wallet.publicKey;
        
        // Get FROM token balance
        let fromBal = 0;
        if (fromToken === SOL_SYMBOL) {
          fromBal = await getSolBalance(publicKey);
        } else {
          fromBal = await getTokenBalance(YOT_TOKEN_ADDRESS, publicKey);
        }
        setFromBalance(fromBal);
        
        // Get TO token balance
        let toBal = 0;
        if (toToken === SOL_SYMBOL) {
          toBal = await getSolBalance(publicKey);
        } else {
          toBal = await getTokenBalance(YOT_TOKEN_ADDRESS, publicKey);
        }
        setToBalance(toBal);
      } catch (error) {
        console.error("Error fetching swap balances:", error);
      }
    };
    
    fetchBalances();
    updateExchangeRate();
  }, [fromToken, toToken, wallet, connected, updateExchangeRate]);

  // Function to update the recipient amount based on the sender amount
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
      
      if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
        result = await swapSolToYot(wallet, amount);
      } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
        result = await swapYotToSol(wallet, amount);
      } else {
        throw new Error("Unsupported token pair");
      }
      
      setIsSuccess(true);
      
      // Reset form
      setFromAmount("");
      setToAmount("");
      
      // Refresh balances
      if (wallet.publicKey) {
        const publicKey = wallet.publicKey;
        
        const solBalance = await getSolBalance(publicKey);
        const yotBalance = await getTokenBalance(YOT_TOKEN_ADDRESS, publicKey);
        
        if (fromToken === SOL_SYMBOL) {
          setFromBalance(solBalance);
          setToBalance(yotBalance);
        } else {
          setFromBalance(yotBalance);
          setToBalance(solBalance);
        }
      }
      
      return result;
    } catch (error) {
      console.error("Swap execution error:", error);
      setError(error instanceof Error ? error : new Error("Unknown error occurred"));
      throw error;
    } finally {
      setIsPending(false);
    }
  }, [fromToken, toToken, fromAmount, wallet, connected]);

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
