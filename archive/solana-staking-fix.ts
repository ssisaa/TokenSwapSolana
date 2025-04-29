// CRITICAL FIX: Update frontend reward calculations to match Solana program

/**
 * Calculate pending rewards using simple interest instead of compound interest
 * This makes the frontend match exactly what the Solana program will calculate
 */
function calculatePendingRewards(staking: {
  stakedAmount: number;
  timeStakedSinceLastHarvest: number;
  stakeRateDecimal: number;
}): number {
  const { stakedAmount, timeStakedSinceLastHarvest, stakeRateDecimal } = staking;
  
  // CRITICAL FIX: Use simple interest formula instead of compound interest
  // Formula: principal * rate * time
  // This matches exactly what the Solana program calculates
  const simpleInterestRewards = stakedAmount * stakeRateDecimal * timeStakedSinceLastHarvest;
  
  console.log(`Rewards calculation (SIMPLE INTEREST): ${stakedAmount} YOT × ${stakeRateDecimal} × ${timeStakedSinceLastHarvest} seconds = ${simpleInterestRewards} YOS`);
  
  return simpleInterestRewards;
}

// This function needs to replace the current reward calculation in fetchUserStakingInfo
// And anywhere else that calculates pending rewards

// Example usage:
/*
const pendingRewards = calculatePendingRewards({
  stakedAmount: userStakingData.stakedAmount,
  timeStakedSinceLastHarvest: timeStakedSeconds,
  stakeRateDecimal: stakeRatePerSecond / 100, // Converting from percentage to decimal
});
*/

// To implement this fix:
// 1. Replace the compound interest formula in lib/solana-staking.ts
// 2. Replace the formula in hooks/useStaking.ts
// 3. Update any other places where rewards are calculated