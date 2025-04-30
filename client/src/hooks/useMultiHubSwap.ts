import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  getMultiHubSwapEstimate, 
  SwapEstimate, 
  SwapSummary,
  SwapProvider 
} from '@/lib/multi-hub-swap';
import { TokenInfo, getTokenInfo } from '@/lib/token-search-api';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_CASHBACK_PERCENT, LIQUIDITY_CONTRIBUTION_PERCENT } from '@/lib/constants';

/**
 * Custom hook for handling multi-hub swaps
 */
export default function useMultiHubSwap() {
  const wallet = useWallet();
  const { toast } = useToast();
  
  // State for the swap form
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.01); // 1% default
  
  // Derived state
  const [swapSummary, setSwapSummary] = useState<SwapSummary | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  
  // Default to SOL to YOT swap when wallet connects
  useEffect(() => {
    if (wallet.connected && !fromToken && !toToken) {
      // Initialize with SOL and YOT
      const initializeTokens = async () => {
        const solToken = await getTokenInfo(SOL_TOKEN_ADDRESS);
        const yotToken = await getTokenInfo(YOT_TOKEN_ADDRESS);
        
        if (solToken && yotToken) {
          setFromToken(solToken);
          setToToken(yotToken);
        }
      };
      
      initializeTokens();
    }
  }, [wallet.connected, fromToken, toToken]);
  
  // Switch the from and to tokens
  const switchTokens = useCallback(() => {
    if (fromToken && toToken) {
      setFromToken(toToken);
      setToToken(fromToken);
    }
  }, [fromToken, toToken]);
  
  // Get estimate from API
  const { 
    data: swapEstimate, 
    isLoading: estimateLoading,
    refetch
  } = useQuery<SwapEstimate>({
    queryKey: ['swapEstimate', fromToken?.address, toToken?.address, amount, slippage],
    queryFn: async () => {
      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
        return {
          estimatedAmount: 0,
          minAmountOut: 0,
          priceImpact: 0,
          liquidityFee: 0,
          route: [],
          provider: SwapProvider.Direct
        };
      }
      
      try {
        return await getMultiHubSwapEstimate(
          fromToken,
          toToken,
          parseFloat(amount),
          slippage
        );
      } catch (error) {
        console.error('Error getting swap estimate:', error);
        return {
          estimatedAmount: 0,
          minAmountOut: 0,
          priceImpact: 0,
          liquidityFee: 0,
          route: [],
          provider: SwapProvider.Direct
        };
      }
    },
    enabled: !!fromToken && !!toToken && parseFloat(amount || '0') > 0
  });
  
  // Compute the swap summary for display
  useEffect(() => {
    if (fromToken && toToken && amount && parseFloat(amount) > 0 && swapEstimate) {
      const amountNum = parseFloat(amount);
      
      // Calculate liquidity contribution (20%)
      const liquidityContribution = amountNum * (LIQUIDITY_CONTRIBUTION_PERCENT / 100);
      
      // Calculate YOS cashback (5%)
      const yosCashback = amountNum * (YOS_CASHBACK_PERCENT / 100);
      
      // Create swap summary
      const summary: SwapSummary = {
        fromAmount: amountNum,
        estimatedOutputAmount: swapEstimate.estimatedAmount,
        minReceived: swapEstimate.minAmountOut,
        priceImpact: swapEstimate.priceImpact * 100, // convert to percentage
        fee: swapEstimate.liquidityFee,
        liquidityContribution,
        yosCashback,
        provider: swapEstimate.provider
      };
      
      setSwapSummary(summary);
    } else {
      setSwapSummary(null);
    }
  }, [fromToken, toToken, amount, swapEstimate]);
  
  // Validate the form
  useEffect(() => {
    setIsValid(
      !!fromToken && 
      !!toToken && 
      parseFloat(amount || '0') > 0 && 
      !!swapEstimate &&
      swapEstimate.estimatedAmount > 0
    );
  }, [fromToken, toToken, amount, swapEstimate]);
  
  // Swap mutation
  const { mutate: swapMutate, isPending: isSwapping } = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey || !wallet.signTransaction || !fromToken || !toToken || !swapEstimate) {
        throw new Error('Wallet not connected or swap parameters invalid');
      }
      
      // For now, just simulate a successful swap
      // In the actual implementation, this would call the contract to perform the swap
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        signature: 'simulated-signature',
        success: true
      };
    },
    onSuccess: () => {
      toast({
        title: 'Swap successful',
        description: `Swapped ${amount} ${fromToken?.symbol} to approximately ${swapEstimate?.estimatedAmount.toFixed(6)} ${toToken?.symbol}`,
      });
      
      // Reset form
      setAmount('');
    },
    onError: (error: Error) => {
      console.error('Swap error:', error);
      toast({
        title: 'Swap failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Perform the swap
  const swap = useCallback(() => {
    if (isValid) {
      swapMutate();
    }
  }, [isValid, swapMutate]);
  
  return {
    fromToken,
    toToken,
    amount,
    slippage,
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    switchTokens,
    swapEstimate,
    estimateLoading,
    swap,
    isSwapping,
    swapSummary,
    isValid,
    refreshEstimate: refetch
  };
}