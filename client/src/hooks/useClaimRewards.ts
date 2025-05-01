import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { claimYosRewards } from '../lib/multihub-contract';
import { useToast } from './use-toast';

/**
 * Hook for claiming YOS rewards
 * This hook provides a mutation function and loading state for claiming rewards
 */
export function useClaimRewards() {
  const { wallet, connected } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      if (!connected || !wallet) {
        throw new Error('Wallet not connected');
      }
      
      return await claimYosRewards(wallet);
    },
    onSuccess: (signature) => {
      toast({
        title: 'Rewards Claimed Successfully',
        description: `Your YOS rewards have been claimed and sent to your wallet. Transaction: ${signature.slice(0, 8)}...`,
      });
      
      // Invalidate related queries to refresh balances and rewards data
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['staking'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Claim Rewards',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    claimRewards: claimRewardsMutation.mutate,
    claimRewardsAsync: claimRewardsMutation.mutateAsync,
    isClaimingRewards: claimRewardsMutation.isPending,
    claimRewardsError: claimRewardsMutation.error,
    isClaimRewardsSuccess: claimRewardsMutation.isSuccess,
  };
}