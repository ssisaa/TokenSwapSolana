import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  getMultiHubSwapEstimate, 
  executeMultiHubSwap, 
  claimYosSwapRewards,
  getUserSwapInfo,
  getGlobalSwapStats,
  SwapProvider,
  TokenMetadata
} from '@/lib/multi-hub-swap';

const DEFAULT_SLIPPAGE = 0.01; // Default 1% slippage

export default function useMultiHubSwap() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  
  // Convert input amount to number
  const parsedAmount = useMemo(() => {
    const num = parseFloat(amount);
    return isNaN(num) ? 0 : num;
  }, [amount]);
  
  // Get swap estimate
  const { 
    data: swapEstimate,
    isLoading: estimateLoading,
    error: estimateError 
  } = useQuery({
    queryKey: ['swap-estimate', fromToken?.address, toToken?.address, parsedAmount],
    queryFn: async () => {
      if (!fromToken || !toToken || parsedAmount <= 0) {
        return null;
      }
      return getMultiHubSwapEstimate(fromToken, toToken, parsedAmount);
    },
    enabled: !!fromToken && !!toToken && parsedAmount > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Get user swap info
  const {
    data: userSwapInfo,
    isLoading: userSwapInfoLoading,
    error: userSwapInfoError
  } = useQuery({
    queryKey: ['user-swap-info', wallet.publicKey?.toString()],
    queryFn: async () => {
      if (!wallet.publicKey) return null;
      return getUserSwapInfo(wallet.publicKey.toString());
    },
    enabled: !!wallet.publicKey,
    refetchInterval: 60000, // Refresh every 60 seconds
  });
  
  // Get global swap stats
  const {
    data: globalSwapStats,
    isLoading: globalSwapStatsLoading,
    error: globalSwapStatsError
  } = useQuery({
    queryKey: ['global-swap-stats'],
    queryFn: async () => {
      return getGlobalSwapStats();
    },
    refetchInterval: 60000, // Refresh every 60 seconds
  });
  
  // Execute swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!wallet || !fromToken || !toToken || parsedAmount <= 0) {
        throw new Error('Missing required parameters for swap');
      }
      
      return executeMultiHubSwap(
        wallet,
        fromToken,
        toToken,
        parsedAmount,
        slippage
      );
    },
    onSuccess: (data) => {
      toast({
        title: 'Swap completed successfully',
        description: `Transaction signature: ${data.signature?.slice(0, 8)}...`,
        variant: 'default',
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-swap-info'] });
      queryClient.invalidateQueries({ queryKey: ['global-swap-stats'] });
      
      // Reset amount
      setAmount('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Swap failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Claim rewards mutation
  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }
      
      return claimYosSwapRewards(wallet);
    },
    onSuccess: (data) => {
      toast({
        title: 'Rewards claimed successfully',
        description: `Transaction signature: ${data.signature?.slice(0, 8)}...`,
        variant: 'default',
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-swap-info'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to claim rewards',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Calculate swap summary
  const swapSummary = useMemo(() => {
    if (!fromToken || !toToken || parsedAmount <= 0 || !swapEstimate?.success) {
      return null;
    }
    
    const estimatedAmount = swapEstimate.estimatedAmount || 0;
    const minReceived = estimatedAmount * (1 - slippage);
    const provider = swapEstimate.provider || SwapProvider.Contract;
    
    return {
      fromAmount: parsedAmount,
      fromToken,
      toAmount: estimatedAmount,
      minReceived,
      toToken,
      provider,
      slippage: slippage * 100,
      estimatedFee: parsedAmount * 0.025, // 0.25% fee
      liquidityContribution: parsedAmount * 0.2, // 20% to liquidity
      cashbackReward: parsedAmount * 0.05, // 5% as YOS rewards
      userReceives: parsedAmount * 0.75, // 75% to user
    };
  }, [fromToken, toToken, parsedAmount, swapEstimate, slippage]);
  
  return {
    // State
    fromToken,
    toToken,
    amount,
    slippage,
    
    // State setters
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    
    // Queries
    swapEstimate,
    estimateLoading,
    estimateError,
    userSwapInfo,
    userSwapInfoLoading,
    userSwapInfoError,
    globalSwapStats,
    globalSwapStatsLoading,
    globalSwapStatsError,
    
    // Mutations
    swap: swapMutation.mutate,
    isSwapping: swapMutation.isPending,
    swapError: swapMutation.error,
    claimRewards: claimRewardsMutation.mutate,
    isClaimingRewards: claimRewardsMutation.isPending,
    claimRewardsError: claimRewardsMutation.error,
    
    // Computed
    swapSummary,
    
    // Utilities
    resetForm: () => {
      setAmount('');
      setSlippage(DEFAULT_SLIPPAGE);
    },
    
    // Validation
    isValid: !!fromToken && !!toToken && parsedAmount > 0 && !!swapEstimate?.success,
    isConnected: wallet.connected,
  };
}