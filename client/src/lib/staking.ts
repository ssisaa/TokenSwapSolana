import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair, 
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { connection, poolAuthorityKeypair } from '@/lib/completeSwap';
import { 
  YOT_TOKEN_ADDRESS, 
  YOT_TOKEN_ACCOUNT, 
  YOS_TOKEN_ADDRESS, 
  YOS_TOKEN_ACCOUNT,
  POOL_AUTHORITY
} from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

// For production, this would be in a Solana program
// For this demonstration, we'll use the server's database and make blockchain transfers
// This implements a simple staking protocol where tokens are sent to a staking account

// Staking program public key (this would be a deployed Solana program in a real implementation)
const STAKING_PROGRAM_ID = new PublicKey(POOL_AUTHORITY);

// Create a constant for staking data index
const STAKING_DATA_SEED = 'staking_account';

// Function to stake YOT tokens
export async function stakeYOTTokens(walletAddressStr: string, amount: number): Promise<boolean> {
  try {
    // Security checks
    if (!walletAddressStr || typeof walletAddressStr !== 'string') {
      console.error("Invalid wallet address provided");
      return false;
    }
    
    // Sanitize and validate the amount
    if (isNaN(amount) || amount <= 0) {
      console.error("Invalid stake amount");
      return false;
    }
    
    // Security: Limit amount size to prevent overflow attacks
    const safeAmount = Math.min(amount, 1_000_000_000); // Set a reasonable maximum amount
    
    console.log(`Staking ${safeAmount} YOT tokens from ${walletAddressStr}`);
    
    // In production, this would create a transaction that calls the staking program
    // We'd use the program's instructions to stake tokens
    
    // Ensure timestamp is a numeric value (Unix timestamp in milliseconds)
    const timestamp = Date.now();
    
    // Create staking data with sanitized inputs
    const stakingData = {
      walletAddress: walletAddressStr.trim(), // Remove whitespace
      stakedAmount: safeAmount,
      startTimestamp: timestamp,
      harvestableRewards: 0
    };
    
    // Security: Use try-catch for network requests to handle failures gracefully
    try {
      // Send the staking data to the server to be stored with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stakingData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server responded with error:", errorData);
        throw new Error(errorData.message || 'Failed to save staking data');
      }
      
      return true;
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error("Request timed out");
        throw new Error("Request timed out. Please try again.");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error staking YOT tokens:", error);
    return false;
  }
}

// Function to unstake YOT tokens
export async function unstakeYOTTokens(walletAddressStr: string): Promise<boolean> {
  try {
    // Security checks
    if (!walletAddressStr || typeof walletAddressStr !== 'string') {
      console.error("Invalid wallet address provided");
      return false;
    }
    
    // Sanitize the wallet address
    const safeWalletAddress = walletAddressStr.trim();
    
    console.log(`Unstaking YOT tokens for ${safeWalletAddress}`);
    
    // In production, this would create a transaction that calls the staking program
    // We'd use the program's instructions to unstake tokens
    
    // Security: Use try-catch for network requests to handle failures gracefully
    try {
      // Send unstake request to the server with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Use encodeURIComponent to prevent URL injection attacks
      const response = await fetch(`/api/staking/unstake?wallet=${encodeURIComponent(safeWalletAddress)}`, {
        method: 'POST',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server responded with error:", errorData);
        throw new Error(errorData.message || 'Failed to unstake tokens');
      }
      
      // In a real implementation, we would now run a blockchain transaction
      // to transfer the YOT tokens back to the user's wallet
      
      return true;
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error("Request timed out");
        throw new Error("Request timed out. Please try again.");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error unstaking YOT tokens:", error);
    return false;
  }
}

// Function to harvest YOS rewards
export async function harvestYOSRewards(walletAddressStr: string): Promise<boolean> {
  try {
    // Security checks
    if (!walletAddressStr || typeof walletAddressStr !== 'string') {
      console.error("Invalid wallet address provided");
      return false;
    }
    
    // Sanitize the wallet address
    const safeWalletAddress = walletAddressStr.trim();
    
    console.log(`Harvesting YOS rewards for ${safeWalletAddress}`);
    
    // Security: Validate rewards eligibility before making request
    try {
      // Get current staking info
      const stakingInfo = await getStakingInfo(safeWalletAddress);
      
      // Get harvest threshold from settings
      const settings = await getAdminSettings();
      const harvestThreshold = settings.harvestThreshold 
        ? parseFloat(settings.harvestThreshold.toString()) 
        : 100;
      
      // Check if rewards are above threshold
      if (stakingInfo.rewardsEarned < harvestThreshold) {
        throw new Error(`Rewards below threshold. Need ${harvestThreshold} YOS.`);
      }
      
      // In production, this would create a transaction that calls the staking program
      // We'd use the program's instructions to harvest rewards
      
      // Security: Use try-catch for network requests with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Use encodeURIComponent to prevent URL injection attacks
      const response = await fetch(`/api/staking/harvest?wallet=${encodeURIComponent(safeWalletAddress)}`, {
        method: 'POST',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server responded with error:", errorData);
        throw new Error(errorData.message || 'Failed to harvest rewards');
      }
      
      // In a real implementation, we would now run a blockchain transaction
      // to transfer the YOS tokens to the user's wallet
      
      return true;
    } catch (innerError: any) {
      if (innerError?.name === 'AbortError') {
        console.error("Request timed out");
        throw new Error("Request timed out. Please try again.");
      }
      throw innerError;
    }
  } catch (error) {
    console.error("Error harvesting YOS rewards:", error);
    return false;
  }
}

// Function to get staking information
export async function getStakingInfo(walletAddressStr: string): Promise<{
  stakedAmount: number,
  rewardsEarned: number,
  startTimestamp: number | null
}> {
  try {
    // Security checks
    if (!walletAddressStr || typeof walletAddressStr !== 'string') {
      console.error("Invalid wallet address provided");
      return {
        stakedAmount: 0,
        rewardsEarned: 0,
        startTimestamp: null
      };
    }
    
    // Sanitize the wallet address
    const safeWalletAddress = walletAddressStr.trim();
    
    console.log(`Getting staking info for ${safeWalletAddress}`);
    
    // In production, this would query the Solana blockchain
    // We'd use the program's state to get staking information
    
    // Security: Use try-catch for network requests to handle failures gracefully
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Use encodeURIComponent to prevent URL injection attacks
      const response = await fetch(`/api/staking/info?wallet=${encodeURIComponent(safeWalletAddress)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // If no staking record is found or there's a server error, return zeros
      if (!response.ok) {
        console.log(`No staking record found or server error: ${response.status}`);
        return {
          stakedAmount: 0,
          rewardsEarned: 0,
          startTimestamp: null
        };
      }
      
      const data = await response.json();
      
      // Security: Validate the received data
      if (!data || typeof data !== 'object') {
        console.error("Invalid data format received from server");
        return {
          stakedAmount: 0,
          rewardsEarned: 0,
          startTimestamp: null
        };
      }
      
      // Calculate current rewards based on staking duration and rate
      const now = Date.now();
      
      // Parse and validate timestamp (ensure it's a number)
      let startTime = data.startTimestamp;
      if (startTime && (typeof startTime !== 'number')) {
        startTime = parseInt(startTime, 10);
        if (isNaN(startTime)) startTime = null;
      }
      
      // Parse and validate staked amount (ensure it's a number)
      let stakedAmount = 0;
      if (data.stakedAmount) {
        if (typeof data.stakedAmount === 'number') {
          stakedAmount = data.stakedAmount;
        } else {
          stakedAmount = parseFloat(data.stakedAmount.toString());
          if (isNaN(stakedAmount)) stakedAmount = 0;
        }
      }
      
      // Safeguard against negative values
      stakedAmount = Math.max(0, stakedAmount);
      
      // Validate harvested rewards
      const harvestedRewards = data.harvestedRewards 
        ? (typeof data.harvestedRewards === 'number'
            ? data.harvestedRewards
            : parseFloat(data.harvestedRewards.toString()) || 0)
        : 0;
      
      // Calculate time staked in seconds (with defensive programming)
      // Handle both old (milliseconds) and new (seconds) timestamp formats
      const nowInSeconds = Math.floor(now / 1000);
      let startTimeInSeconds: number;
      
      if (startTime && startTime > 0) {
        // If timestamp is in milliseconds (larger than what makes sense for seconds)
        // then convert it to seconds, otherwise assume it's already in seconds
        startTimeInSeconds = startTime > 9999999999 ? Math.floor(startTime / 1000) : startTime;
      } else {
        startTimeInSeconds = nowInSeconds;
      }
      
      const timeStakedSeconds = Math.max(0, nowInSeconds - startTimeInSeconds); // Ensure we never have negative time
      
      // Get staking rate securely
      const settings = await getAdminSettings();
      let ratePerSecond = 0.00125 / 100; // Default rate
      
      if (settings && settings.stakeRatePerSecond) {
        if (typeof settings.stakeRatePerSecond === 'number') {
          ratePerSecond = settings.stakeRatePerSecond / 100;
        } else {
          const parsedRate = parseFloat(settings.stakeRatePerSecond.toString()) / 100;
          if (!isNaN(parsedRate)) ratePerSecond = parsedRate;
        }
      }
      
      // Calculate rewards with safety checks
      const pendingRewards = calculateRewards(stakedAmount, timeStakedSeconds, ratePerSecond);
      
      return {
        stakedAmount: stakedAmount,
        rewardsEarned: pendingRewards,
        startTimestamp: startTime
      };
    } catch (apiError: any) {
      if (apiError?.name === 'AbortError') {
        console.error("Request timed out when getting staking info");
      } else {
        console.log("API error, using default values:", apiError);
      }
      return {
        stakedAmount: 0,
        rewardsEarned: 0,
        startTimestamp: null
      };
    }
  } catch (error) {
    console.error("Error getting staking info:", error);
    return {
      stakedAmount: 0,
      rewardsEarned: 0,
      startTimestamp: null
    };
  }
}

// Function to get admin settings
async function getAdminSettings() {
  try {
    const response = await fetch('/api/admin/settings');
    if (!response.ok) {
      throw new Error('Failed to fetch admin settings');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    // Return default settings
    return {
      stakeRatePerSecond: 0.00125, // 0.00125% per second
      harvestThreshold: 100 // 100 YOS
    };
  }
}

// Function to calculate rewards
function calculateRewards(stakedAmount: number, timeInSeconds: number, ratePerSecond: number): number {
  return stakedAmount * timeInSeconds * ratePerSecond;
}