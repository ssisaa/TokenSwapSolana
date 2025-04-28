import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
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
  getStakingProgramState,
  getGlobalStakingStats
} from '@/lib/solana-staking';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, STAKING_PROGRAM_ID } from '@/lib/constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Define utility functions internally since they're not exported by solana-staking.ts
function findStakingAccountAddress(walletAddress: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("staking"), walletAddress.toBuffer()],
    new PublicKey(STAKING_PROGRAM_ID)
  );
}

function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(STAKING_PROGRAM_ID)
  );
}

function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(STAKING_PROGRAM_ID)
  );
}

// Use getAssociatedTokenAddress from spl-token instead
async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey> {
  return await getAssociatedTokenAddress(
    tokenMintAddress,
    walletAddress,
    true // allowOwnerOffCurve if needed for PDAs
  );
}

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
  // APY calculations
  dailyAPY: number;
  weeklyAPY: number;
  monthlyAPY: number;
  yearlyAPY: number;
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
  } = useQuery<StakingRates | null>({
    queryKey: ['staking', 'rates'],
    queryFn: async () => {
      try {
        return await getStakingProgramState();
      } catch (error) {
        console.error("Failed to get staking program state:", error);
        // The getStakingProgramState function now handles errors internally
        // and returns default values instead of throwing, but we'll keep this as a fallback
        if (error instanceof Error) {
          // Log the error but don't throw it - we'll get default values from getStakingProgramState
          console.warn(`Staking program state error: ${error.message}`);
          // Return values from another attempt - our updated function handles errors
          return await getStakingProgramState();
        }
        return null;
      }
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
        console.log("Starting unstake operation with detailed debugging...");
        console.log("Amount to unstake:", amount);
        
        // Get the wallet public key string for logging
        const walletAddress = publicKey.toString();
        console.log("Wallet address:", walletAddress);
        
        // Find associated token accounts for wallet
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        
        // Check if the user's YOT token account exists
        const userYotAccount = await findAssociatedTokenAddress(publicKey, new PublicKey(YOT_TOKEN_ADDRESS));
        const userYotAccountInfo = await connection.getAccountInfo(userYotAccount);
        console.log("User YOT account:", userYotAccount.toString(), "exists:", !!userYotAccountInfo);
        
        // Check if the user's YOS token account exists
        const userYosAccount = await findAssociatedTokenAddress(publicKey, new PublicKey(YOS_TOKEN_ADDRESS));
        const userYosAccountInfo = await connection.getAccountInfo(userYosAccount);
        console.log("User YOS account:", userYosAccount.toString(), "exists:", !!userYosAccountInfo);
        
        // Find staking account PDA
        const [userStakingAddress] = findStakingAccountAddress(publicKey);
        const userStakingAccountInfo = await connection.getAccountInfo(userStakingAddress);
        console.log("User staking account:", userStakingAddress.toString(), "exists:", !!userStakingAccountInfo);
        if (userStakingAccountInfo) {
          console.log("User staking account size:", userStakingAccountInfo.data.length, "bytes");
        }
        
        // Check program state account
        const [programStateAddress] = findProgramStateAddress();
        const programStateInfo = await connection.getAccountInfo(programStateAddress);
        console.log("Program state account:", programStateAddress.toString(), "exists:", !!programStateInfo);
        if (programStateInfo) {
          console.log("Program state account size:", programStateInfo.data.length, "bytes");
        }
        
        // Get the program token accounts
        const [programAuthorityAddress] = findProgramAuthorityAddress();
        
        // Check program's YOT token account
        const programYotAccount = await findAssociatedTokenAddress(programAuthorityAddress, new PublicKey(YOT_TOKEN_ADDRESS));
        const programYotAccountInfo = await connection.getAccountInfo(programYotAccount);
        console.log("Program YOT account:", programYotAccount.toString(), "exists:", !!programYotAccountInfo);
        
        // Check program's YOS token account
        const programYosAccount = await findAssociatedTokenAddress(programAuthorityAddress, new PublicKey(YOS_TOKEN_ADDRESS));
        const programYosAccountInfo = await connection.getAccountInfo(programYosAccount);
        console.log("Program YOS account:", programYosAccount.toString(), "exists:", !!programYosAccountInfo);
        
        // Check token balances
        if (programYotAccountInfo) {
          try {
            const programYotBalance = await connection.getTokenAccountBalance(programYotAccount);
            console.log("Program YOT balance:", programYotBalance.value.uiAmount);
          } catch (e) {
            console.error("Error getting program YOT balance:", e);
          }
        }
        
        if (programYosAccountInfo) {
          try {
            const programYosBalance = await connection.getTokenAccountBalance(programYosAccount);
            console.log("Program YOS balance:", programYosBalance.value.uiAmount);
          } catch (e) {
            console.error("Error getting program YOS balance:", e);
          }
        }
        
        // Now call the actual unstake operation with all this debugging information
        console.log("Now executing actual unstake operation...");
        const signature = await unstakeYOTTokens(wallet, amount);
        console.log("Unstake transaction signature:", signature);
        
        // Return both the signature and amount for processing in onSuccess
        return { signature, amount };
      } catch (err) {
        console.error("Error during unstaking operation:", err);
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
        console.log("Starting harvest operation with detailed debugging...");
        
        // Get the wallet public key string for logging
        const walletAddress = publicKey.toString();
        console.log("Wallet address:", walletAddress);
        
        // Find associated token accounts for wallet
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        
        // Check if the user's YOT token account exists
        const userYotAccount = await findAssociatedTokenAddress(publicKey, new PublicKey(YOT_TOKEN_ADDRESS));
        const userYotAccountInfo = await connection.getAccountInfo(userYotAccount);
        console.log("User YOT account:", userYotAccount.toString(), "exists:", !!userYotAccountInfo);
        
        // Check if the user's YOS token account exists
        const userYosAccount = await findAssociatedTokenAddress(publicKey, new PublicKey(YOS_TOKEN_ADDRESS));
        const userYosAccountInfo = await connection.getAccountInfo(userYosAccount);
        console.log("User YOS account:", userYosAccount.toString(), "exists:", !!userYosAccountInfo);
        
        // Find staking account PDA
        const [userStakingAddress] = findStakingAccountAddress(publicKey);
        const userStakingAccountInfo = await connection.getAccountInfo(userStakingAddress);
        console.log("User staking account:", userStakingAddress.toString(), "exists:", !!userStakingAccountInfo);
        if (userStakingAccountInfo) {
          console.log("User staking account size:", userStakingAccountInfo.data.length, "bytes");
        }
        
        // Check program state account
        const [programStateAddress] = findProgramStateAddress();
        const programStateInfo = await connection.getAccountInfo(programStateAddress);
        console.log("Program state account:", programStateAddress.toString(), "exists:", !!programStateInfo);
        if (programStateInfo) {
          console.log("Program state account size:", programStateInfo.data.length, "bytes");
        }
        
        // Get the program token accounts
        const [programAuthorityAddress] = findProgramAuthorityAddress();
        
        // Check program's YOT token account
        const programYotAccount = await findAssociatedTokenAddress(programAuthorityAddress, new PublicKey(YOT_TOKEN_ADDRESS));
        const programYotAccountInfo = await connection.getAccountInfo(programYotAccount);
        console.log("Program YOT account:", programYotAccount.toString(), "exists:", !!programYotAccountInfo);
        
        // Check program's YOS token account
        const programYosAccount = await findAssociatedTokenAddress(programAuthorityAddress, new PublicKey(YOS_TOKEN_ADDRESS));
        const programYosAccountInfo = await connection.getAccountInfo(programYosAccount);
        console.log("Program YOS account:", programYosAccount.toString(), "exists:", !!programYosAccountInfo);
        
        // Check token balances
        if (programYosAccountInfo) {
          try {
            const programYosBalance = await connection.getTokenAccountBalance(programYosAccount);
            console.log("Program YOS balance:", programYosBalance.value.uiAmount);
            
            // Check if rewards are available
            const stakingInfo = await getStakingInfo(walletAddress);
            console.log("Calculated rewards:", stakingInfo.rewardsEarned);
            console.log("Last harvest time:", new Date(stakingInfo.lastHarvestTime * 1000).toISOString());
            console.log("Program has enough tokens to pay rewards:", 
              programYosBalance.value.uiAmount >= stakingInfo.rewardsEarned);
          } catch (e) {
            console.error("Error getting program YOS balance:", e);
          }
        }
        
        // Now call the actual harvest operation with all this debugging information
        console.log("Now executing actual harvest operation...");
        const signature = await harvestYOSRewards(wallet);
        console.log("Harvest transaction signature:", signature);
        
        // Return the signature for processing in onSuccess
        return { signature };
      } catch (err) {
        console.error("Error during harvesting operation:", err);
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
  
  // Use React Query to fetch global stats to ensure consistency
  const {
    data: globalStatsData,
    isLoading: isLoadingGlobalStats,
    refetch: refetchGlobalStats
  } = useQuery<GlobalStakingStats>({
    queryKey: ['staking', 'globalStats'],
    queryFn: async () => {
      try {
        console.log("Fetching global stats with React Query...");
        // Get global stats directly from blockchain using our function
        return await getGlobalStakingStats();
      } catch (error) {
        console.error("Error in global stats query:", error);
        // Return default structure instead of throwing
        return {
          totalStaked: 0,
          totalStakers: 0,
          totalHarvested: 0
        };
      }
    },
    refetchInterval: 60000, // Refetch every minute to keep data fresh
  });
  
  // Keep backwards compatibility with the setState pattern
  // This ensures existing components using globalStats continue to work
  useEffect(() => {
    if (globalStatsData) {
      // Update state with the query data
      setGlobalStats({
        totalStaked: globalStatsData.totalStaked,
        totalStakers: globalStatsData.totalStakers,
        totalHarvested: globalStatsData.totalHarvested
      });
      
      // Log for debugging
      console.log("Updated global stats from query:", globalStatsData);
    }
  }, [globalStatsData]);
  
  // Function to refresh staking info
  const refreshStakingInfo = useCallback(async () => {
    await Promise.all([
      refetchStakingInfo(),
      refetchRates(), 
      refetchGlobalStats() // Add global stats refresh
    ]);
  }, [refetchStakingInfo, refetchRates, refetchGlobalStats]);

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
      dailyAPR: 0.108,
      weeklyAPR: 0.756,
      monthlyAPR: 3.24,
      yearlyAPR: 39.42,
      // Add APY calculations (compound interest)
      dailyAPY: 0.108,
      weeklyAPY: 0.76,
      monthlyAPY: 3.31,
      yearlyAPY: 48.37
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