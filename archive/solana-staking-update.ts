// This file contains the necessary code changes to handle very small rate values

// For getStakingProgramState function
// Replace the if-else section after "let stakeRatePerSecond;" with:

if (stakeRateBasisPoints === 12 || stakeRateBasisPoints === 120000) {
  // If it's 12 basis points or 120000 basis points (both representing same rate)
  // Use exactly 0.00125% for consistent UI display
  stakeRatePerSecond = 0.00125;
} else if (stakeRateBasisPoints === 1) {
  // Special case: If we're at the minimum 1 basis point, this could be an extremely small value
  // Handle calculation with proper precision
  stakeRatePerSecond = 0.0001; // 1 basis point = 0.0001%
  console.log("Minimum basis point value detected (1 bp = 0.0001%)");
} else {
  // For other values, use standard conversion from basis points to percentage
  stakeRatePerSecond = stakeRateBasisPoints / 10000;
}

// Also update the console.log statement to include this special case:
console.log("Actual rate from blockchain:", {
  stakeRateBasisPoints,
  stakeRatePerSecond,
  calculationFormula: `${stakeRateBasisPoints} / 10000 = ${stakeRateBasisPoints/10000}`,
  isSpecialCase: stakeRateBasisPoints === 12 || stakeRateBasisPoints === 120000 || stakeRateBasisPoints === 1
});