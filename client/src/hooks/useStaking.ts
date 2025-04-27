import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { connection } from '@/lib/completeSwap';
import { toast } from '@/hooks/use-toast';
import { 
  stakeYOTTokens, 
  unstakeYOTTokens, 
  harvestYOSRewards, 
  getStakingInfo,
  updateStakingParameters,
  getStakingProgramState
} from '@/lib/solana-staking';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface StakingInfo {
  stakedAmount: number;
  startTimestamp: number;
  lastHarvestTime: number;
  totalHarvested: number;
  rewardsEarned: number;
}

interface StakingRates {
  stakeRatePerSecond: number;
  harvestThreshold: number;
  dailyAPY: number;
  weeklyAPY: number;
  monthlyAPY: number;
  yearlyAPY: number;
}

export function useStaking() {
  const { publicKey, wallet, connected } = useMultiWallet();
  const queryClient = useQueryClient();
  
  // Query to fetch staking info
  const { 
    data: stakingInfo,
    isLoading: isLoadingStakingInfo,
    error: stakingError,
    refetch: refetchStakingInfo
  } = useQuery<StakingInfo>({
    queryKey: ['staking', publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) {
        return {
          stakedAmount: 0,
          startTimestamp: 0,
          lastHarvestTime: 0,
          totalHarvested: 0,
          rewardsEarned: 0
        };
      }
      return await getStakingInfo(publicKey);
    },
    enabled: !!publicKey && connected,
    refetchInterval: 30000, // Refetch every 30 seconds to update rewards
  });
  
  // Query to fetch program rates
  const {
    data: stakingRates,
    isLoading: isLoadingRates,
    error: ratesError,
    refetch: refetchRates
  } = useQuery<StakingRates>({
    queryKey: ['staking', 'rates'],
    queryFn: async () => {
      return await getStakingProgramState();
    },
    refetchInterval: 60000, // Refetch every minute
  });
  
  // Mutation for staking tokens
  const stakeMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number }) => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      return await stakeYOTTokens(wallet, amount);
    },
    onSuccess: () => {
      // Invalidate and refetch staking info
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey?.toString()] });
      
      // Also invalidate token balances
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Staking Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutation for unstaking tokens
  const unstakeMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number }) => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      return await unstakeYOTTokens(wallet, amount);
    },
    onSuccess: () => {
      // Invalidate and refetch staking info
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey?.toString()] });
      
      // Also invalidate token balances
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unstaking Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutation for harvesting rewards
  const harvestMutation = useMutation({
    mutationFn: async () => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      return await harvestYOSRewards(wallet);
    },
    onSuccess: () => {
      // Invalidate and refetch staking info
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey?.toString()] });
      
      // Also invalidate token balances
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Harvesting Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Admin mutation for updating parameters
  const updateParametersMutation = useMutation({
    mutationFn: async ({ 
      stakeRatePerSecond, 
      harvestThreshold 
    }: { 
      stakeRatePerSecond: number, 
      harvestThreshold: number 
    }) => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      return await updateStakingParameters(wallet, stakeRatePerSecond, harvestThreshold);
    },
    onSuccess: () => {
      // Invalidate and refetch staking info for all users
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      
      toast({
        title: 'Parameters Updated',
        description: 'Staking parameters have been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const isLoading = isLoadingStakingInfo || isLoadingRates;
  
  return {
    stakingInfo: stakingInfo || {
      stakedAmount: 0,
      startTimestamp: 0,
      lastHarvestTime: 0,
      totalHarvested: 0,
      rewardsEarned: 0
    },
    stakingRates: stakingRates || {
      stakeRatePerSecond: 0.00125,
      harvestThreshold: 1,
      dailyAPY: 108,
      weeklyAPY: 756,
      monthlyAPY: 3240,
      yearlyAPY: 39420
    },
    isLoading,
    error: stakingError || ratesError,
    refetch: () => {
      refetchStakingInfo();
      refetchRates();
    },
    stakeTokens: stakeMutation.mutate,
    unstakeTokens: unstakeMutation.mutate,
    harvestRewards: harvestMutation.mutate,
    updateParameters: updateParametersMutation.mutate,
    isStaking: stakeMutation.isPending,
    isUnstaking: unstakeMutation.isPending,
    isHarvesting: harvestMutation.isPending,
    isUpdatingParameters: updateParametersMutation.isPending
  };
}