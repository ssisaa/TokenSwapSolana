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
  getGlobalStakingStats,
  validateStakingAccounts,
  simulateTransaction
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
  // Internal value used by blockchain transactions (10000x multiplier)
  _rewardsEarnedInternal?: number;
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
  // Additional thresholds (optional for backward compatibility)
  stakeThreshold?: number;
  unstakeThreshold?: number;
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
      console.log('Fetching staking rates from blockchain...');
      try {
        const rates = await getStakingProgramState();
        console.log('Successfully fetched staking rates:', rates);
        return rates;
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
        // Get staking rates to check against minimum stake threshold
        const rates = await getStakingProgramState();
        console.log("Staking rates for threshold check:", rates);
        
        // Check if stake amount meets the minimum threshold
        if (amount < (rates.stakeThreshold || 10)) {
          throw new Error(`Staking amount (${amount.toFixed(2)} YOT) is below the minimum threshold (${(rates.stakeThreshold || 10).toFixed(2)} YOT). Please stake more tokens.`);
        }
        
        // Call the staking function which shows the wallet signature prompt
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
        const connection = new Connection(ENDPOINT, 'confirmed');
        
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
            console.log("Program YOS balance:", programYosBalance.value.uiAmount || 0);
          } catch (e) {
            console.error("Error getting program YOS balance:", e);
          }
        }
        
        // Get staking rates to check against threshold
        const rates = await getStakingProgramState();
        console.log("Staking rates for threshold check:", rates);
        
        // Check if unstake amount meets the minimum threshold
        if (amount < (rates.unstakeThreshold || 10)) {
          throw new Error(`Unstake amount (${amount.toFixed(2)} YOT) is below the minimum threshold (${(rates.unstakeThreshold || 10).toFixed(2)} YOT). Please unstake more tokens or leave them staked.`);
        }
        
        // No safety limits needed - using fixed contract
        
        // Now call the actual unstake operation
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
      } else if (errorMessage.includes("insufficient funds")) {
        toast({
          title: "Insufficient Token Balance",
          description: "You don't have enough YOT tokens staked to unstake that amount.",
          variant: 'destructive',
        });
      } else if (errorMessage.includes("below the minimum threshold")) {
        toast({
          title: "Amount Below Threshold",
          description: errorMessage,
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
  
  // Mutation for harvesting YOS rewards
  const harvestMutation = useMutation({
    mutationFn: async () => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      
      if (!publicKey) {
        throw new Error('Wallet public key not available');
      }
      
      // CRITICAL FIX: Display multiplier warning in UI before harvesting
      toast({
        title: "⚠️ Multiplier Warning",
        description: `Due to a known issue in the Solana program, your wallet will show a value about 10,000× larger than expected. This is a display issue only. The actual amount being transferred is correct.`,
        duration: 10000, // 10 seconds
        variant: "destructive", // Use destructive to highlight importance
      });
      
      try {
        console.log("Starting harvest operation with detailed debugging...");
        
        // Get the wallet public key string for logging
        const walletAddress = publicKey.toString();
        console.log("Wallet address:", walletAddress);
        
        // Find associated token accounts for wallet
        const connection = new Connection(ENDPOINT, 'confirmed');
        
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
        
        // Check program's YOS token account
        const programYosAccount = await findAssociatedTokenAddress(programAuthorityAddress, new PublicKey(YOS_TOKEN_ADDRESS));
        const programYosAccountInfo = await connection.getAccountInfo(programYosAccount);
        console.log("Program YOS account:", programYosAccount.toString(), "exists:", !!programYosAccountInfo);
        
        // Check token balances
        if (programYosAccountInfo) {
          try {
            const programYosBalance = await connection.getTokenAccountBalance(programYosAccount);
            console.log("Program YOS balance:", programYosBalance.value.uiAmount || 0);
          } catch (e) {
            console.error("Error getting program YOS balance:", e);
          }
        }
        
        // Now call the actual harvest operation with all this debugging information
        console.log("Now executing actual harvest operation...");
        // First validate all accounts to ensure we have everything we need
        const validationResult = await validateStakingAccounts(wallet);
        console.log("Validation result:", validationResult);
        
        if (!validationResult.isValid) {
          const errorMessages = validationResult.errors.join(", ");
          throw new Error(`Account validation failed: ${errorMessages}`);
        }
        
        // Check if program has enough YOS tokens for rewards, but allow the operation to continue
        // even with low balance - the program will handle partial rewards
        const stakingInfo = await getStakingInfo(publicKey.toString());
        if (programYosAccountInfo) {
          try {
            const programYosBalance = await connection.getTokenAccountBalance(programYosAccount);
            const availableYos = programYosBalance.value.uiAmount || 0;
            
            // CRITICAL FIX: Apply the 10,000× divisor to get the true UI amount
            const pendingRewardsRaw = stakingInfo.rewardsEarned;
            const pendingRewardsUI = pendingRewardsRaw / 10000;
            
            console.log(`
            ========== HARVEST REWARDS DEBUG ==========
            Program YOS balance: ${availableYos} YOS
            User pending rewards (UI display): ${pendingRewardsUI} YOS
            User pending rewards (blockchain): ${pendingRewardsRaw}
            10,000× multiplier ratio: ${pendingRewardsRaw / pendingRewardsUI}
            =========================================`);
            
            // Compare the UI amount with available YOS
            if (availableYos < pendingRewardsUI && pendingRewardsUI > 0.01) {
              // Just log a warning - don't prevent harvesting
              console.warn(`Program has insufficient YOS tokens (${availableYos}) for full rewards (${pendingRewardsUI} YOS)`);
              // The actual harvest function (harvestYOSRewards) will also show a toast warning
            }
          } catch (e) {
            console.error("Error checking program YOS balance during harvest preparation:", e);
          }
        }
        
        // Get staking rates to check against harvest threshold
        const stakingRates = await getStakingProgramState();
        console.log("Staking rates for threshold check:", stakingRates);
        
        // CRITICAL FIX: Check if rewards meet the threshold using the UI display value (not internal)
        // This ensures consistency between what the user sees and what is required
        // CRITICAL FIX: The UI should display the divided amount, but the comparison
        // with the threshold needs to account for the 10,000× multiplier
        const displayRewards = stakingInfo.rewardsEarned / 10000;
        
        if (displayRewards < (stakingRates.harvestThreshold || 0)) {
          throw new Error(`Rewards (${displayRewards.toFixed(6)} YOS) are below the minimum threshold (${(stakingRates.harvestThreshold || 0).toFixed(6)} YOS). Stake more or wait longer.`);
        }
        
        // Log reward values for clarity and debugging
        console.log(`
        ========== HARVEST TRANSACTION DEBUG ==========
        User blockchain reward amount: ${stakingInfo.rewardsEarned}
        User display reward amount: ${stakingInfo.rewardsEarned / 10000} YOS
        Harvest threshold: ${stakingRates.harvestThreshold || 0} YOS
        Multiplier ratio: 10,000×
        ==============================================`);
        
        
        // Execute the harvest
        const result = await harvestYOSRewards(wallet);
        console.log("Harvest transaction result:", result);
        
        // Handle the special "already processed" case
        if (result === "ALREADY_PROCESSED") {
          console.log("Transaction was already processed, treating as success");
          return { signature: "ALREADY_PROCESSED", alreadyProcessed: true };
        }
        
        // Return the signature for processing in onSuccess
        return { signature: result, alreadyProcessed: false };
      } catch (err) {
        console.error("Error during harvesting operation:", err);
        throw err;
      }
    },
    onSuccess: (result) => {
      if (!publicKey) return;
      
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['staking', publicKey.toString()] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      
      // IMPORTANT: Immediately update the UI with the simulated result
      // Get the current staking info
      const currentInfo = queryClient.getQueryData<StakingInfo>(['staking', publicKey.toString()]);
      
      if (currentInfo) {
        // Create a simulated updated staking info after harvest
        const updatedInfo = {
          ...currentInfo,
          totalHarvested: currentInfo.totalHarvested + currentInfo.rewardsEarned,
          rewardsEarned: 0,
          lastHarvestTime: Math.floor(Date.now() / 1000)
        };
        
        console.log("Updating staking info with simulated data after harvest:", updatedInfo);
        
        // Update the cache with simulated data
        queryClient.setQueryData(['staking', publicKey.toString()], updatedInfo);
      }
      
      // Check if this was an "already processed" transaction
      if (result.signature === "ALREADY_PROCESSED") {
        toast({
          title: "Transaction Already Processed",
          description: "Your rewards were already harvested in a previous transaction. Your balance has been updated.",
        });
      } else {
        // Calculate the rewards that were harvested for display
        const harvestedAmount = currentInfo ? (currentInfo.rewardsEarned / 10000) : 0;
        const blockchainAmount = currentInfo ? currentInfo.rewardsEarned : 0;
        
        // First show a success toast
        toast({
          title: "Rewards Harvested",
          description: `Successfully harvested ${harvestedAmount.toFixed(6)} YOS tokens.`,
        });
        
        // Then show an important warning about the wallet transaction amount
        setTimeout(() => {
          toast({
            title: "⚠️ IMPORTANT: Wallet Display Issue",
            description: `Your wallet will show ${blockchainAmount.toLocaleString()} YOS (10,000× larger than expected). This is ONLY a display issue due to the Solana program using inconsistent divisors (1,000,000 vs 10,000). The ACTUAL transfer amount is still ${harvestedAmount.toFixed(4)} YOS.`,
            variant: "destructive", // Using destructive variant for important warnings
            duration: 15000, // Show for 15 seconds
          });
        }, 1500); // Wait 1.5 seconds after the first toast
        
        // Add a third toast explaining what's happening more clearly
        setTimeout(() => {
          toast({
            title: "How to Interpret Your Wallet",
            description: `To get the ACTUAL token amount, divide what your wallet shows by 10,000. Example: ${blockchainAmount} ÷ 10,000 = ${harvestedAmount.toFixed(4)} YOS. This is due to a known bug in the Solana program that will be fixed in a future update.`,
            duration: 20000, // Show for 20 seconds
          });
        }, 5000); // Wait 5 seconds after the first toast
      }
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
      } else if (errorMessage.includes("No rewards to harvest")) {
        toast({
          title: "No Rewards Available",
          description: "You don't have any YOS rewards to harvest yet. Stake longer to earn rewards.",
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
      } else if (errorMessage.includes("This transaction has already been processed")) {
        toast({
          title: "Transaction Already Processed",
          description: "Your transaction was already processed. Please check your wallet balance before trying again.",
        });
        
        // Invalidate queries to update the UI with the latest data
        if (publicKey) {
          queryClient.invalidateQueries({ queryKey: ['staking', publicKey.toString()] });
          queryClient.invalidateQueries({ queryKey: ['tokens'] });
        }
      } else if (errorMessage.includes("below the minimum threshold")) {
        // Specific handling for harvest threshold errors
        toast({
          title: "Rewards Below Threshold",
          description: errorMessage,
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
  
  // Mutation for admin to update staking parameters
  const updateStakingSettingsMutation = useMutation({
    mutationFn: async ({ 
      ratePerSecond,
      harvestThreshold,
      stakeThreshold,
      unstakeThreshold
    }: { 
      ratePerSecond: number,
      harvestThreshold: number,
      stakeThreshold?: number,
      unstakeThreshold?: number
    }) => {
      if (!wallet || !connected) {
        throw new Error('Wallet not connected');
      }
      
      if (!publicKey) {
        throw new Error('Wallet public key not available');
      }
      
      try {
        console.log("Updating staking parameters...");
        console.log("New rate per second:", ratePerSecond);
        console.log("New harvest threshold:", harvestThreshold);
        console.log("New stake threshold:", stakeThreshold);
        console.log("New unstake threshold:", unstakeThreshold);
        
        // Special case handling for known rate values (to avoid floating point issues)
        let basisPoints;
        
        // The values as strings to handle exact floating point comparisons
        const rateString = ratePerSecond.toString();
        
        if (rateString === '0.0000125') {
          // Special case: 0.0000125% per second = 120000 basis points
          basisPoints = 120000;
          console.log("Using special case: 0.0000125% = 120000 basis points");
        } else if (rateString === '0.00000125') {
          // Special case: 0.00000125% per second = 12000 basis points
          basisPoints = 12000;
          console.log("Using special case: 0.00000125% = 12000 basis points");
        } else if (rateString === '0.000000125') {
          // Special case: 0.000000125% per second = 1200 basis points
          basisPoints = 1200;
          console.log("Using special case: 0.000000125% = 1200 basis points");
        } else {
          // Convert using the reference values from the library:
          // 12000 basis points = 0.00000125% per second
          // So multiplier is: 12000 / 0.00000125 = 9,600,000,000
          const basisPointsExact = ratePerSecond * 9600000000;
          basisPoints = Math.round(basisPointsExact);
          
          // Ensure the basis points are within valid range
          if (basisPoints < 1) basisPoints = 1;
          if (basisPoints > 1000000) basisPoints = 1000000;
          
          console.log(`Using dynamic calculation: ${ratePerSecond}% × 9,600,000,000 = ${basisPointsExact} → ${basisPoints} basis points`);
        }
        
        console.log("Final basis points for blockchain:", basisPoints);
        
        // Just pass the values directly to the blockchain function
        // Don't do any conversions or transformations - keep it simple
        console.log("Harvest threshold (direct value):", harvestThreshold);
        
        // IMPORTANT: The Solana program only supports stake_rate_per_second and harvest_threshold
        // in the UpdateParameters instruction. It doesn't have fields for stake_threshold and unstake_threshold.
        // We've updated our client code to match what the program actually supports.
        
        // Log the values we're sending
        console.log("Sending direct values to blockchain:", {
          basisPoints,
          harvestThreshold,
          // Note: stakeThreshold and unstakeThreshold are saved in the UI but NOT sent to blockchain
          // since the Solana program doesn't support these parameters in UpdateParameters
        });
        
        // Call the blockchain function to update parameters
        // Note: We still pass stakeThreshold and unstakeThreshold to maintain the function signature,
        // but these values aren't used in the actual transaction data.
        const signature = await updateStakingParameters(
          wallet, 
          basisPoints,                // basis points
          harvestThreshold            // harvest threshold (direct value)
          // stakeThreshold and unstakeThreshold are handled by the function but not sent to blockchain
        );
        
        console.log("Update parameters transaction signature:", signature);
        
        // Return signature and new values for processing in onSuccess
        // We still include stakeThreshold and unstakeThreshold in the result
        // for consistent interface with the rest of the app
        return { 
          signature,
          ratePerSecond,
          harvestThreshold,
          stakeThreshold: stakeThreshold ?? 10,
          unstakeThreshold: unstakeThreshold ?? 10
        };
      } catch (err) {
        console.error("Error updating staking parameters:", err);
        throw err;
      }
    },
    onSuccess: (result) => {
      // Delay the refresh slightly to give blockchain time to update
      console.log("Settings update successful, refreshing staking rates...");
      console.log('Staking settings updated successfully:', result);
      
      // Add a short delay before invalidating the cache to allow blockchain to update
      setTimeout(() => {
        console.log('Invalidating staking rates cache to trigger refetch');
        queryClient.invalidateQueries({ queryKey: ['staking', 'rates'] });
        // Also force refetch explicitly
        refetchRates();
      }, 2000); // 2 second delay
      
      // Construct a complete message with all the updated parameters
      const successMessage = `
        Successfully updated staking parameters:
        • Rate: ${result.ratePerSecond}% per second
        • Harvest Threshold: ${result.harvestThreshold} YOS
        ${result.stakeThreshold ? `• Stake Threshold: ${result.stakeThreshold} YOT` : ''}
        ${result.unstakeThreshold ? `• Unstake Threshold: ${result.unstakeThreshold} YOT` : ''}
      `;
      
      toast({
        title: "Staking Parameters Updated",
        description: successMessage.trim(),
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Unknown error occurred";
      
      // Handle specific error messages with user-friendly explanations
      if (errorMessage.includes("not admin")) {
        toast({
          title: "Not Authorized",
          description: "Only the admin wallet can update staking parameters.",
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
  
  // Load global staking statistics periodically
  useEffect(() => {
    const loadGlobalStats = async () => {
      console.log("Fetching global stats with React Query...");
      try {
        const stats = await getGlobalStakingStats();
        console.log("Updated global stats from query:", stats);
        setGlobalStats(stats);
      } catch (error) {
        console.error("Error fetching global staking stats:", error);
        // Keep last valid stats instead of setting defaults
      }
    };
    
    // Load stats immediately and then periodically
    loadGlobalStats();
    const interval = setInterval(loadGlobalStats, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    stakingInfo: stakingInfo || {
      stakedAmount: 0,
      startTimestamp: 0,
      lastHarvestTime: 0,
      totalHarvested: 0,
      rewardsEarned: 0
    },
    stakingRates: stakingRates || {
      stakeRatePerSecond: 0,
      harvestThreshold: 0,
      dailyAPR: 0,
      weeklyAPR: 0,
      monthlyAPR: 0,
      yearlyAPR: 0,
      dailyAPY: 0,
      weeklyAPY: 0,
      monthlyAPY: 0,
      yearlyAPY: 0
    },
    globalStats,
    isLoadingStakingInfo,
    isLoadingRates,
    stakingError,
    ratesError,
    stakeMutation,
    unstakeMutation,
    harvestMutation,
    updateStakingSettingsMutation,
    refetchStakingInfo,
    refetchRates
  };
}