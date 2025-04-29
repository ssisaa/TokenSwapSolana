// CRITICAL FIX V4: Update frontend reward calculations to match Solana program
// Using compound interest with proper scaling for APY

/**
 * Calculate pending rewards using compound interest with proper scaling
 * This makes the frontend match exactly what the Solana program will calculate
 */
function calculatePendingRewards(staking: {
  stakedAmount: number;
  timeStakedSinceLastHarvest: number;
  stakeRateDecimal: number;
}): number {
  const { stakedAmount, timeStakedSinceLastHarvest, stakeRateDecimal } = staking;
  
  // CRITICAL FIX: Use compound interest formula with proper scaling
  // stakeRateDecimal is already converted to decimal (e.g., 0.00000125/100 = 1.25e-8)
  // Formula: principal * ((1 + rate)^time - 1)
  const compoundFactor = Math.pow(1 + stakeRateDecimal, timeStakedSinceLastHarvest) - 1;
  const compoundRewards = stakedAmount * compoundFactor;
  
  console.log(`Rewards calculation (COMPOUND INTEREST): ${stakedAmount} YOT tokens × (Math.pow(1 + ${stakeRateDecimal}, ${timeStakedSinceLastHarvest}) - 1) = ${compoundRewards} YOS`);
  
  return compoundRewards;
}

// This function should be used when calculating rewards in the frontend

/**
 * Implementation Requirements:
 * 
 * 1. The Solana program will use EXACTLY this same formula:
 *    - Convert staking_rate from basis points to decimal (÷ 1,000,000)
 *    - Convert from percentage to decimal (÷ 100)
 *    - Calculate using compound formula: principal * ((1 + rate)^time - 1)
 * 
 * 2. The key fix in the Solana program is:
 *    - Rates must be properly scaled (÷ 100) to get actual decimal rates
 *    - Apply compound interest after proper scaling
 *    - This ensures that UI shows the same values as what users receive
 */

// Example usage:
/*
// IMPORTANT: stakeRatePerSecond is in percentage per second (e.g., 0.00000125%)
// We need to convert it to a decimal rate by dividing by 100
const stakeRateDecimal = stakeRatePerSecond / 100;  

const pendingRewards = calculatePendingRewards({
  stakedAmount: userStakingData.stakedAmount,
  timeStakedSinceLastHarvest: timeStakedSeconds,
  stakeRateDecimal: stakeRateDecimal,
});
*/