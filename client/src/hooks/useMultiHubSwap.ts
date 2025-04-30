import { useState, useEffect } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useSOLPrice } from '@/hooks/useSOLPrice';
import { 
  swapAndDistribute,
  claimWeeklyYosReward,
  withdrawLiquidityContribution,
  getLiquidityContributionInfo,
  getMultiHubSwapStats
} from '@/lib/multi-hub-swap';

interface Distribution {
  userPercent: number;
  liquidityPercent: number;
  cashbackPercent: number;
}

interface MultiHubSwapStats {
  totalLiquidityContributed: number;
  totalContributors: number;
  totalYosRewarded: number;
  weeklyRewardRate: number;
  yearlyAPR: number;
  buyDistribution: Distribution;
  sellDistribution: Distribution;
  commissionPercent: number;
  yotPriceUsd: number;
}

interface LiquidityContributionInfo {
  contributedAmount: number;
  startTimestamp: number;
  lastClaimTime: number;
  totalClaimedYos: number;
  canClaimReward: boolean;
  nextClaimAvailable: string | null;
  estimatedWeeklyReward: number;
}

export function useMultiHubSwap() {
  const { publicKey, wallet } = useMultiWallet();
  const queryClient = useQueryClient();
  const { solPrice } = useSOLPrice();
  
  // Query for multi-hub swap stats
  const { 
    data: swapStats,
    isLoading: isLoadingSwapStats,
    error: swapStatsError,
    refetch: refetchSwapStats
  } = useQuery<MultiHubSwapStats>({
    queryKey: ['multi-hub-swap-stats'],
    queryFn: async () => {
      console.log("Fetching multi-hub swap stats...");
      return await getMultiHubSwapStats();
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query for user's liquidity contribution info
  const {
    data: liquidityInfo,
    isLoading: isLoadingLiquidityInfo,
    error: liquidityInfoError,
    refetch: refetchLiquidityInfo
  } = useQuery<LiquidityContributionInfo>({
    queryKey: ['liquidity-contribution', publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) {
        return {
          contributedAmount: 0,
          startTimestamp: 0,
          lastClaimTime: 0,
          totalClaimedYos: 0,
          canClaimReward: false,
          nextClaimAvailable: null,
          estimatedWeeklyReward: 0
        };
      }
      return await getLiquidityContributionInfo(publicKey.toString());
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!publicKey, // Only run if wallet is connected
  });

  // Mutation for swap and distribute
  const swapAndDistributeMutation = useMutation({
    mutationFn: async ({ amountIn, minAmountOut }: { amountIn: number, minAmountOut: number }) => {
      if (!wallet) throw new Error("Wallet not connected");
      return await swapAndDistribute(wallet, amountIn, minAmountOut);
    },
    onSuccess: () => {
      toast({
        title: "Swap Successful",
        description: "Tokens have been swapped and distributed according to protocol rules.",
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['liquidity-contribution'] });
      queryClient.invalidateQueries({ queryKey: ['multi-hub-swap-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Swap Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for claiming weekly YOS rewards
  const claimWeeklyRewardMutation = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("Wallet not connected");
      return await claimWeeklyYosReward(wallet);
    },
    onSuccess: (data) => {
      toast({
        title: "Rewards Claimed",
        description: `Successfully claimed ${data.claimedAmount.toFixed(2)} YOS rewards.`,
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['liquidity-contribution'] });
      queryClient.invalidateQueries({ queryKey: ['multi-hub-swap-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for withdrawing liquidity
  const withdrawLiquidityMutation = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("Wallet not connected");
      return await withdrawLiquidityContribution(wallet);
    },
    onSuccess: (data) => {
      toast({
        title: "Liquidity Withdrawn",
        description: `Successfully withdrew ${data.withdrawnAmount.toFixed(2)} YOT from liquidity pool.`,
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['liquidity-contribution'] });
      queryClient.invalidateQueries({ queryKey: ['multi-hub-swap-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate time until next reward claim
  const calculateTimeUntilNextClaim = (): { canClaim: boolean; timeLeft: string } => {
    if (!liquidityInfo || !liquidityInfo.lastClaimTime) {
      return { canClaim: false, timeLeft: "N/A" };
    }

    if (liquidityInfo.canClaimReward) {
      return { canClaim: true, timeLeft: "Available now" };
    }

    if (!liquidityInfo.nextClaimAvailable) {
      return { canClaim: false, timeLeft: "Not available" };
    }

    const nextClaimTime = new Date(liquidityInfo.nextClaimAvailable).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, nextClaimTime - now);
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return { canClaim: false, timeLeft: `${days}d ${hours}h` };
    } else if (hours > 0) {
      return { canClaim: false, timeLeft: `${hours}h ${minutes}m` };
    } else {
      return { canClaim: false, timeLeft: `${minutes}m` };
    }
  };

  // Calculate USD value of contributed tokens
  const calculateContributedValueUSD = (): number => {
    if (!liquidityInfo || !solPrice) return 0;
    
    // For this example, we'll use a fictional YOT price as 1/100 of SOL price
    const yotPrice = solPrice / 100;
    return liquidityInfo.contributedAmount * yotPrice;
  };

  // Calculate USD value of weekly rewards
  const calculateWeeklyRewardValueUSD = (): number => {
    if (!liquidityInfo || !solPrice) return 0;
    
    // For this example, we'll use a fictional YOS price as 1/50 of SOL price
    const yosPrice = solPrice / 50;
    return liquidityInfo.estimatedWeeklyReward * yosPrice;
  };

  const claimingTimeInfo = calculateTimeUntilNextClaim();
  const contributedValueUSD = calculateContributedValueUSD();
  const weeklyRewardValueUSD = calculateWeeklyRewardValueUSD();

  return {
    // Data
    swapStats,
    liquidityInfo,
    
    // Loading states
    isLoadingSwapStats,
    isLoadingLiquidityInfo,
    
    // Errors
    swapStatsError,
    liquidityInfoError,
    
    // Mutations
    swapAndDistributeMutation,
    claimWeeklyRewardMutation,
    withdrawLiquidityMutation,
    
    // Refetch functions
    refetchSwapStats,
    refetchLiquidityInfo,
    
    // Derived data
    canClaimReward: claimingTimeInfo.canClaim,
    timeUntilNextClaim: claimingTimeInfo.timeLeft,
    contributedValueUSD,
    weeklyRewardValueUSD,
    
    // Status flags
    isSwapping: swapAndDistributeMutation.isPending,
    isClaiming: claimWeeklyRewardMutation.isPending,
    isWithdrawing: withdrawLiquidityMutation.isPending,
  };
}