// EMERGENCY FIX: Update frontend calculation to use simple linear interest
// This makes it match the Solana program's calculation

/**
 * Calculate pending rewards using SIMPLE LINEAR INTEREST
 * 
 * @param staking Object containing staked amount, time staked, and rate
 * @returns Calculated rewards
 */
function calculatePendingRewards(staking: {
  stakedAmount: number;
  timeStakedSinceLastHarvest: number;
  stakeRatePerSecond: number;
}): number {
  const { stakedAmount, timeStakedSinceLastHarvest, stakeRatePerSecond } = staking;
  
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

// To use this function, replace the existing reward calculation in useStaking.ts
// Make sure you're correctly passing:
// - stakedAmount: The amount of YOT tokens staked (in token units, not raw)
// - timeStakedSinceLastHarvest: Time in seconds since last harvest
// - stakeRatePerSecond: The rate in percentage per second (e.g., 0.00000125%)

// Example usage:
/*
// In fetchUserStakingInfo or wherever rewards are calculated:
const pendingRewards = calculatePendingRewards({
  stakedAmount: userStakingData.stakedAmount,
  timeStakedSinceLastHarvest: timeStakedSeconds,
  stakeRatePerSecond: stakeRatePerSecond, // Make sure this is in percentage form (e.g., 0.00000125)
});
*/

// For a complete fix, you need to:
// 1. Replace the existing calculatePendingRewards or calculateRewards function
// 2. Update the Solana program with the EMERGENCY_FIX_LINEAR.rs implementation
// 3. Deploy both changes and test by harvesting/unstaking