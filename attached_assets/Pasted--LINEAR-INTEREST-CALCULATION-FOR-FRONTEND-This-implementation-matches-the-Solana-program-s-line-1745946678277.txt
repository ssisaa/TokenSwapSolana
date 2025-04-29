// LINEAR INTEREST CALCULATION FOR FRONTEND
// This implementation matches the Solana program's linear interest calculation fix

import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiRequest } from '@/lib/queryClient';
import { stakeToken, unstakeToken, harvestRewards } from '@/lib/solana-staking';
import { useToast } from '@/hooks/use-toast';

// Fixed rate conversion - ensure this matches exactly what's in the Solana program
function getStakingRate() {
  // 12000 basis points = 0.00000125% per second (as in Solana program)
  const stakeRateBasisPoints = 12000; 
  const stakeRatePerSecond = 0.00000125; // percentage per second
  
  return {
    stakeRateBasisPoints,
    stakeRatePerSecond,
    calculationDetails: "Special case: 12000 basis points → 0.00000125%",
    displayedInUI: stakeRatePerSecond * 100, // for display purposes
    dailyPercentage: stakeRatePerSecond * 86400, // per day
    yearlyPercentage: stakeRatePerSecond * 86400 * 365, // per year (APR)
  };
}

/**
 * Calculate pending rewards using SIMPLE LINEAR INTEREST
 * This matches exactly what the Solana program calculates
 */
function calculatePendingRewards(staking: {
  stakedAmount: number;
  timeStakedSinceLastHarvest: number;
}) {
  const { stakedAmount, timeStakedSinceLastHarvest } = staking;
  const { stakeRatePerSecond } = getStakingRate();
  
  // Convert from percentage (0.00000125%) to decimal (0.0000000125)
  const rateDecimal = stakeRatePerSecond / 100;
  
  // SIMPLE LINEAR INTEREST: principal * rate * time
  const linearRewards = stakedAmount * rateDecimal * timeStakedSinceLastHarvest;
  
  console.log(`LINEAR REWARDS CALCULATION:`);
  console.log(`- Staked amount: ${stakedAmount} YOT tokens`);
  console.log(`- Rate: ${stakeRatePerSecond}% per second (${rateDecimal} as decimal)`);
  console.log(`- Time staked: ${timeStakedSinceLastHarvest} seconds`);
  console.log(`- Formula: ${stakedAmount} × ${rateDecimal} × ${timeStakedSinceLastHarvest}`);
  console.log(`- Result: ${linearRewards} YOS tokens`);
  
  return linearRewards;
}

// Export these functions to replace in useStaking.ts
export { calculatePendingRewards, getStakingRate };