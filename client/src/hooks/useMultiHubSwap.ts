import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  getMultiHubSwapEstimate, 
  executeMultiHubSwap, 
  claimYosSwapRewards,
  getUserSwapInfo,
  getGlobalSwapStats,
  SwapProvider
} from '@/lib/multi-hub-swap';
import { TokenMetadata } from '@/lib/token-search-api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function useMultiHubSwap() {
  const { toast } = useToast();
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toString() || '';
  const isWalletConnected = wallet.connected && !!walletAddress;

  // Token selection state
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  
  // Amount state
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  
  // Slippage state
  const [slippage, setSlippage] = useState(0.01); // 1% default
  
  // Swap estimate
  const [swapEstimate, setSwapEstimate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get user swap stats and liquidity contribution info
  const { 
    data: swapStats, 
    isLoading: isLoadingSwapStats 
  } = useQuery({
    queryKey: ['/api/swap/stats', walletAddress],
    queryFn: async () => {
      if (!isWalletConnected) return null;
      return await getUserSwapInfo(walletAddress);
    },
    enabled: isWalletConnected,
  });

  // Get global swap stats
  const {
    data: globalSwapStats,
    isLoading: isLoadingGlobalStats
  } = useQuery({
    queryKey: ['/api/swap/global-stats'],
    queryFn: async () => {
      return await getGlobalSwapStats();
    }
  });

  // Calculate estimate whenever fromToken, toToken, or fromAmount changes
  useEffect(() => {
    const calculateEstimate = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        setSwapEstimate(null);
        setToAmount('');
        return;
      }
      
      try {
        setIsLoading(true);
        const amount = parseFloat(fromAmount);
        const estimate = await getMultiHubSwapEstimate(fromToken, toToken, amount);
        setSwapEstimate(estimate);
        setToAmount(estimate.outputAmount.toString());
      } catch (error) {
        console.error('Error calculating swap estimate:', error);
        setSwapEstimate(null);
        setToAmount('');
        toast({
          title: 'Estimate Error',
          description: 'Unable to calculate swap estimate. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    calculateEstimate();
  }, [fromToken, toToken, fromAmount, toast]);
  
  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!fromToken || !toToken || !fromAmount || !wallet.publicKey) {
        throw new Error('Missing required swap parameters');
      }
      
      const amount = parseFloat(fromAmount);
      return await executeMultiHubSwap(wallet, fromToken, toToken, amount, slippage);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Swap Successful',
          description: `Successfully swapped ${result.fromAmount} ${result.fromToken?.symbol} to ${result.toAmount?.toFixed(6)} ${result.toToken?.symbol}`,
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/swap/stats', walletAddress] });
        
        // Reset input fields
        setFromAmount('');
        setToAmount('');
      } else {
        toast({
          title: 'Swap Failed',
          description: result.error || 'Unknown error occurred during swap',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Swap Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Claim rewards mutation
  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }
      
      return await claimYosSwapRewards(wallet);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Rewards Claimed',
          description: 'Successfully claimed YOS rewards',
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/swap/stats', walletAddress] });
      } else {
        toast({
          title: 'Claim Failed',
          description: result.error || 'Unknown error occurred while claiming rewards',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Claim Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Swap tokens function
  const handleSwap = useCallback(() => {
    if (!wallet.connected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to perform a swap',
        variant: 'destructive',
      });
      return;
    }
    
    swapMutation.mutate();
  }, [wallet.connected, swapMutation, toast]);
  
  // Claim rewards function
  const handleClaimRewards = useCallback(() => {
    if (!wallet.connected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to claim rewards',
        variant: 'destructive',
      });
      return;
    }
    
    claimRewardsMutation.mutate();
  }, [wallet.connected, claimRewardsMutation, toast]);
  
  // Switch tokens
  const handleSwitchTokens = useCallback(() => {
    if (fromToken && toToken) {
      const temp = fromToken;
      setFromToken(toToken);
      setToToken(temp);
      setFromAmount(toAmount);
      setToAmount('');
      setSwapEstimate(null);
    }
  }, [fromToken, toToken, toAmount]);

  return {
    // Token selection
    fromToken,
    toToken,
    setFromToken,
    setToToken,
    
    // Amount
    fromAmount,
    toAmount,
    setFromAmount,
    setToAmount,
    
    // Swap estimate and loading state
    swapEstimate,
    isLoading,
    
    // Slippage
    slippage,
    setSlippage,
    
    // Actions
    handleSwap,
    handleSwitchTokens,
    handleClaimRewards,
    
    // Mutations
    isSwapping: swapMutation.isPending,
    isClaiming: claimRewardsMutation.isPending,
    
    // Stats
    swapStats,
    isLoadingSwapStats,
    globalSwapStats,
    isLoadingGlobalStats,
    
    // Pass wallet for convenience
    wallet
  };
}