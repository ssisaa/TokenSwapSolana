import { useState, useEffect, useCallback } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
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
  const { wallet, connected: walletConnected, publicKey } = useMultiWallet();
  const { toast } = useToast();
  
  // State for the swap form
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.01); // 1% default
  const [preferredProvider, setPreferredProvider] = useState<SwapProvider>(SwapProvider.Raydium);
  
  // Derived state
  const [swapSummary, setSwapSummary] = useState<SwapSummary | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  
  // Default to SOL to YOT swap when wallet connects
  useEffect(() => {
    if (walletConnected && !fromToken && !toToken) {
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
  }, [walletConnected, fromToken, toToken]);
  
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
    queryKey: ['swapEstimate', fromToken?.address, toToken?.address, amount, slippage, preferredProvider],
    queryFn: async () => {
      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
        return {
          estimatedAmount: 0,
          minAmountOut: 0,
          priceImpact: 0,
          liquidityFee: 0,
          route: [],
          provider: preferredProvider || SwapProvider.Direct
        };
      }
      
      try {
        return await getMultiHubSwapEstimate(
          fromToken,
          toToken,
          parseFloat(amount),
          slippage,
          preferredProvider
        );
      } catch (error) {
        console.error('Error getting swap estimate:', error);
        return {
          estimatedAmount: 0,
          minAmountOut: 0,
          priceImpact: 0,
          liquidityFee: 0,
          route: [],
          provider: preferredProvider || SwapProvider.Direct
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
      if (!publicKey || !wallet?.signTransaction || !fromToken || !toToken || !swapEstimate) {
        throw new Error('Wallet not connected or swap parameters invalid');
      }
      
      // Import the executeMultiHubSwap function
      const { executeMultiHubSwap } = await import('@/lib/multihub-contract');
      
      // Execute the swap using the smart contract
      const signature = await executeMultiHubSwap(
        wallet,
        fromToken,
        toToken,
        parseFloat(amount),
        swapEstimate.minAmountOut
      );
      
      return {
        signature,
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
  
  // Mock user swap info for the UI (to be replaced with actual data from chain)
  const [userSwapInfo, setUserSwapInfo] = useState({
    totalSwapped: 0,
    totalContributed: 0,
    pendingRewards: 0,
    totalRewardsClaimed: 0
  });
  const [userSwapInfoLoading, setUserSwapInfoLoading] = useState(false);
  
  // Mock global stats for UI (to be replaced with actual data from chain)
  const [globalSwapStats, setGlobalSwapStats] = useState({
    totalSwapVolume: 0,
    totalLiquidityContributed: 0,
    totalRewardsDistributed: 0,
    uniqueUsers: 0
  });
  const [globalSwapStatsLoading, setGlobalSwapStatsLoading] = useState(false);
  
  // Claim rewards function using the smart contract
  const [isClaimingRewards, setIsClaimingRewards] = useState(false);
  const claimRewards = useCallback(async () => {
    if (!walletConnected || !wallet) {
      throw new Error('Wallet not connected');
    }
    
    setIsClaimingRewards(true);
    try {
      // Import the claimYosRewards function
      const { claimYosRewards } = await import('@/lib/multihub-contract');
      
      // Call the smart contract function to claim rewards
      const signature = await claimYosRewards(wallet);
      console.log('Claim rewards transaction signature:', signature);
      
      // Update user info after successful claim
      setUserSwapInfo(prev => ({
        ...prev,
        pendingRewards: 0,
        totalRewardsClaimed: prev.totalRewardsClaimed + prev.pendingRewards
      }));
      
      toast({
        title: 'Rewards claimed successfully',
        description: 'Your YOS rewards have been transferred to your wallet',
      });
      
      return true;
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast({
        title: 'Failed to claim rewards',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsClaimingRewards(false);
    }
  }, [walletConnected, wallet, toast]);
  
  return {
    // Token swap form
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
    refreshEstimate: refetch,
    preferredProvider,
    setPreferredProvider,
    
    // User and global stats
    userSwapInfo,
    userSwapInfoLoading,
    globalSwapStats,
    globalSwapStatsLoading,
    claimRewards,
    isClaimingRewards
  };
}