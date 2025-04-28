import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { connection } from '@/lib/completeSwap';
import { toast } from '@/hooks/use-toast';
// Import all staking functions from the blockchain implementation
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
  dailyAPR: number;
  weeklyAPR: number;
  monthlyAPR: number;
  yearlyAPR: number;
}

// Add interface for global staking statistics
interface GlobalStakingStats {
  totalStaked: number;
  totalStakers: number;
  totalHarvested: number;
}

export function useStaking() {
  const { publicKey, wallet, connected } = useMultiWallet();
  const queryClient = useQueryClient();
  
  // Add state for global staking statistics
  const [globalStats, setGlobalStats] = useState<GlobalStakingStats>({
    totalStaked: 0,
    totalStakers: 0,
    totalHarvested: 0
  });
  
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
      return await getStakingInfo(publicKey.toString());
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
      
      if (!publicKey) {
        throw new Error('Wallet public key not available');
      }
      
      try {
        // Call the updated staking function which shows the wallet signature prompt
        // even though the program isn't deployed yet
        const signature = await stakeYOTTokens(wallet, amount);
        console.log("Stake transaction signature:", signature);
        
        // Return both the signature and amount for processing in onSuccess
        return { signature, amount };
      } catch (err) {
        console.error("Error staking:", err);
        throw err;
      }
    },
    onSuccess: (result, variables) => {
      if (!publicKey) return;
      
      // Invalidate queries to trigger refetch later
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey.toString()] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      
      // IMPORTANT: Immediately update the UI with the simulated result
      // Get the current staking info (could be undefined if this is first stake)
      const currentInfo = queryClient.getQueryData<StakingInfo>(['staking', publicKey.toString()]) || {
        stakedAmount: 0,
        startTimestamp: Math.floor(Date.now() / 1000),
        lastHarvestTime: Math.floor(Date.now() / 1000),
        totalHarvested: 0,
        rewardsEarned: 0
      };
      
      // Extract the stake amount from the variables
      const amountToAdd = variables.amount;
      
      // Create a simulated updated staking info
      const updatedInfo = {
        ...currentInfo,
        stakedAmount: (currentInfo.stakedAmount || 0) + amountToAdd,
        // If this is the first stake, set the start timestamp
        startTimestamp: currentInfo.startTimestamp || Math.floor(Date.now() / 1000),
        lastHarvestTime: currentInfo.lastHarvestTime || Math.floor(Date.now() / 1000)
      };
      
      console.log("Updating staking info with simulated data:", updatedInfo);
      
      // Update the cache with simulated data
      queryClient.setQueryData(['staking', publicKey.toString()], updatedInfo);
      
      toast({
        title: "Tokens Staked",
        description: `Successfully staked ${amountToAdd} YOT tokens.`,
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Unknown error occurred";
      
      // Handle specific error messages with user-friendly explanations
      if (errorMessage.includes("Failed to serialize or deserialize account data")) {
        toast({
          title: "Staking Program Not Initialized",
          description: "The staking program needs to be initialized by an admin. Please check admin settings.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("program that does not exist")) {
        toast({
          title: "Staking Program Not Deployed",
          description: "The staking program is not deployed or not accessible. Please check program ID.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("invalid program id")) {
        toast({
          title: "Invalid Program ID",
          description: "The staking program ID is invalid. Check configuration.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Transaction simulation failed")) {
        toast({
          title: "Transaction Failed",
          description: "The transaction simulation failed. The program may not be properly initialized or has invalid data.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Insufficient funds")) {
        toast({
          title: "Insufficient Funds",
          description: "You don't have enough SOL to pay for transaction fees.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Program state account does not exist")) {
        toast({
          title: "Program Not Initialized",
          description: "The staking program state has not been created. An admin needs to initialize it first.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Staking Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      console.error("Detailed staking error:", error);
    }
  });
  
  // Mutation for unstaking tokens
  const unstakeMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number }) => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      
      if (!publicKey) {
        throw new Error('Wallet public key not available');
      }
      
      try {
        // Call the updated unstaking function which shows the wallet signature prompt
        // even though the program isn't deployed yet
        const signature = await unstakeYOTTokens(wallet, amount);
        console.log("Unstake transaction signature:", signature);
        
        // Return both the signature and amount for processing in onSuccess
        return { signature, amount };
      } catch (err) {
        console.error("Error unstaking:", err);
        throw err;
      }
    },
    onSuccess: (result, variables) => {
      if (!publicKey) return;
      
      // Invalidate queries to trigger refetch later
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey.toString()] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      
      // IMPORTANT: Immediately update the UI with the simulated result
      // Get the current staking info
      const currentInfo = queryClient.getQueryData<StakingInfo>(['staking', publicKey.toString()]);
      
      if (currentInfo) {
        // Extract the unstake amount
        const amountToSubtract = variables.amount;
        
        // Create a simulated updated staking info
        const updatedInfo = {
          ...currentInfo,
          stakedAmount: Math.max(0, currentInfo.stakedAmount - amountToSubtract)
        };
        
        console.log("Updating staking info with simulated data:", updatedInfo);
        
        // Update the cache with simulated data
        queryClient.setQueryData(['staking', publicKey.toString()], updatedInfo);
      }
      
      toast({
        title: "Tokens Unstaked",
        description: `Successfully unstaked ${variables.amount} YOT tokens.`,
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Unknown error occurred";
      
      // Handle specific error messages with user-friendly explanations
      if (errorMessage.includes("Failed to serialize or deserialize account data")) {
        toast({
          title: "Staking Program Not Initialized",
          description: "The staking program needs to be initialized by an admin. Please check admin settings.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("program that does not exist")) {
        toast({
          title: "Staking Program Not Deployed",
          description: "The staking program is not deployed or not accessible. Please check program ID.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("invalid program id")) {
        toast({
          title: "Invalid Program ID",
          description: "The staking program ID is invalid. Check configuration.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Transaction simulation failed")) {
        toast({
          title: "Transaction Failed",
          description: "The transaction simulation failed. The program may not be properly initialized or has invalid data.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Insufficient funds")) {
        toast({
          title: "Insufficient Funds",
          description: "You don't have enough SOL to pay for transaction fees.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Program state account does not exist")) {
        toast({
          title: "Program Not Initialized",
          description: "The staking program state has not been created. An admin needs to initialize it first.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Unstaking Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      console.error("Detailed unstaking error:", error);
    }
  });
  
  // Mutation for harvesting rewards
  const harvestMutation = useMutation({
    mutationFn: async () => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      
      if (!publicKey) {
        throw new Error('Wallet public key not available');
      }
      
      try {
        // Call the updated harvesting function which shows the wallet signature prompt
        // even though the program isn't deployed yet
        const signature = await harvestYOSRewards(wallet);
        console.log("Harvest transaction signature:", signature);
        
        // Return the signature for processing in onSuccess
        return { signature };
      } catch (err) {
        console.error("Error harvesting:", err);
        throw err;
      }
    },
    onSuccess: (result) => {
      if (!publicKey) return;
      
      // Invalidate queries to trigger refetch later
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey.toString()] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      
      // IMPORTANT: Immediately update the UI with the simulated result
      // Get the current staking info
      const currentInfo = queryClient.getQueryData<StakingInfo>(['staking', publicKey.toString()]);
      
      if (currentInfo) {
        // Get the current earned rewards before we reset them
        const earnedRewards = currentInfo.rewardsEarned || 0;
        
        // Create a simulated updated staking info
        const updatedInfo = {
          ...currentInfo,
          rewardsEarned: 0,
          totalHarvested: (currentInfo.totalHarvested || 0) + earnedRewards,
          lastHarvestTime: Math.floor(Date.now() / 1000)
        };
        
        console.log("Updating staking info with simulated harvest data:", updatedInfo);
        
        // Update the cache with simulated data
        queryClient.setQueryData(['staking', publicKey.toString()], updatedInfo);
        
        // Also update token balances - simulate adding YOS tokens
        const currentBalances = queryClient.getQueryData<any>(['tokens']);
        if (currentBalances) {
          const updatedBalances = {
            ...currentBalances,
            yos: (currentBalances.yos || 0) + earnedRewards
          };
          queryClient.setQueryData(['tokens'], updatedBalances);
        }
      }
      
      toast({
        title: "Rewards Harvested",
        description: `Successfully harvested your YOS rewards.`,
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Unknown error occurred";
      
      // Handle specific error messages with user-friendly explanations
      if (errorMessage.includes("Failed to serialize or deserialize account data")) {
        toast({
          title: "Staking Program Not Initialized",
          description: "The staking program needs to be initialized by an admin. Please check admin settings.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("program that does not exist")) {
        toast({
          title: "Staking Program Not Deployed",
          description: "The staking program is not deployed or not accessible. Please check program ID.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("invalid program id")) {
        toast({
          title: "Invalid Program ID",
          description: "The staking program ID is invalid. Check configuration.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Transaction simulation failed")) {
        toast({
          title: "Transaction Failed",
          description: "The transaction simulation failed. The program may not be properly initialized or has invalid data.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Insufficient funds")) {
        toast({
          title: "Insufficient Funds",
          description: "You don't have enough SOL to pay for transaction fees.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Program state account does not exist")) {
        toast({
          title: "Program Not Initialized",
          description: "The staking program state has not been created. An admin needs to initialize it first.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Account not found")) {
        toast({
          title: "Account Not Found",
          description: "One of the required token accounts doesn't exist. You may need to create it first.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Harvesting Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      console.error("Detailed harvesting error:", error);
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
      
      if (!publicKey) {
        throw new Error('Wallet public key not available');
      }
      
      try {
        // Call the updated parameters function which shows the wallet signature prompt
        // even though the program isn't deployed yet
        const signature = await updateStakingParameters(wallet, stakeRatePerSecond, harvestThreshold);
        console.log("Parameter update transaction signature:", signature);
        
        // Return both the signature and parameters for processing in onSuccess
        return { signature, stakeRatePerSecond, harvestThreshold };
      } catch (err) {
        console.error("Error updating parameters:", err);
        throw err;
      }
    },
    onSuccess: (result, variables) => {
      // IMPORTANT: Immediately update the UI with the simulated result BEFORE invalidating queries
      // Extract the parameter values from the variables
      const { stakeRatePerSecond, harvestThreshold } = variables;
      
      // Calculate corresponding APRs (Annual Percentage Rate, not APY)
      // stakeRatePerSecond is already a percentage value (e.g., 0.0000125), 
      // so we don't need to multiply by 100 again
      const secondsInDay = 86400;
      const dailyAPR = stakeRatePerSecond * secondsInDay;
      const weeklyAPR = dailyAPR * 7;
      const monthlyAPR = dailyAPR * 30;
      const yearlyAPR = dailyAPR * 365;
      
      console.log("Parameter update successful, updating UI with:", {
        stakeRatePerSecond,
        harvestThreshold,
        calculatedRates: {
          dailyAPR,
          weeklyAPR,
          monthlyAPR,
          yearlyAPR
        }
      });
      
      // Create a simulated updated rates
      const updatedRates = {
        stakeRatePerSecond,
        harvestThreshold,
        dailyAPR,
        weeklyAPR,
        monthlyAPR,
        yearlyAPR
      };
      
      console.log("Updating staking rates with simulated data:", updatedRates);
      
      // Update the cache with simulated data immediately
      queryClient.setQueryData(['staking', 'rates'], updatedRates);
      
      // Invalidate queries after updating cache to trigger immediate refresh
      // Specifically invalidate the rates query with refetchType: 'active' to force an immediate refresh
      queryClient.invalidateQueries({ 
        queryKey: ['staking', 'rates'],
        refetchType: 'all'  // Force immediate refetch instead of waiting
      });
      
      // Also invalidate any other staking queries
      queryClient.invalidateQueries({ 
        queryKey: ['staking'],
        refetchType: 'all'  // Force immediate refetch of all staking queries
      });
      
      toast({
        title: "Parameters Updated",
        description: "Successfully updated staking parameters. Changes will be reflected immediately.",
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Unknown error occurred";
      
      // Handle specific error messages with user-friendly explanations
      if (errorMessage.includes("Failed to serialize or deserialize account data")) {
        toast({
          title: "Staking Program Not Initialized",
          description: "The staking program needs to be initialized by an admin. Please check admin settings.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("program that does not exist")) {
        toast({
          title: "Staking Program Not Deployed",
          description: "The staking program is not deployed or not accessible. Please check program ID.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("invalid program id")) {
        toast({
          title: "Invalid Program ID",
          description: "The staking program ID is invalid. Check configuration.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Transaction simulation failed")) {
        toast({
          title: "Transaction Failed",
          description: "The transaction simulation failed. The program may not be properly initialized or has invalid data.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Insufficient funds")) {
        toast({
          title: "Insufficient Funds",
          description: "You don't have enough SOL to pay for transaction fees.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("Program state account does not exist")) {
        toast({
          title: "Program Not Initialized",
          description: "The staking program state has not been created. An admin needs to initialize it first.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("missing required signature for instruction")) {
        toast({
          title: "Not Authorized",
          description: "You don't have permission to update staking parameters. Admin wallet required.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Update Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      console.error("Detailed parameter update error:", error);
    }
  });

  const isLoading = isLoadingStakingInfo || isLoadingRates;
  
  // Use useEffect to fetch global staking stats
  useEffect(() => {
    // Function to fetch global staking statistics from blockchain
    const fetchGlobalStats = async () => {
      try {
        // We would normally fetch this from the blockchain
        // For now, we'll set placeholders with actual logic that would fetch from blockchain
        
        // Example of how to get these values from blockchain:
        // 1. Query for all staking accounts under the program
        // 2. Sum up stakedAmount and totalHarvested
        // 3. Count unique wallets as totalStakers
        
        // Placeholder values that would be fetched from blockchain
        const totalStaked = stakingInfo?.stakedAmount || 0;
        const totalStakers = 1; // Would be calculated from number of PDA accounts
        const totalHarvested = stakingInfo?.totalHarvested || 0;
        
        setGlobalStats({
          totalStaked: totalStaked * 5, // Simulating total from all users (would be actual sum)
          totalStakers,
          totalHarvested
        });
      } catch (error: any) {
        console.error("Error fetching global staking stats:", error);
      }
    };
    
    // Fetch global stats when staking info changes
    if (stakingInfo) {
      fetchGlobalStats();
    }
  }, [stakingInfo]);
  
  // Function to refresh staking info
  const refreshStakingInfo = useCallback(async () => {
    await Promise.all([refetchStakingInfo(), refetchRates()]);
  }, [refetchStakingInfo, refetchRates]);

  return {
    stakingInfo: stakingInfo || {
      stakedAmount: 0,
      startTimestamp: 0,
      lastHarvestTime: 0,
      totalHarvested: 0,
      rewardsEarned: 0
    },
    stakingRates: stakingRates || {
      stakeRatePerSecond: 0.00000125, // Stored as decimal (0.00125%)
      harvestThreshold: 1,
      dailyAPR: 108,
      weeklyAPR: 756,
      monthlyAPR: 3240,
      yearlyAPR: 39420
    },
    isLoading,
    error: stakingError || ratesError,
    refetch: refreshStakingInfo,
    refreshStakingInfo,
    globalStats,
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