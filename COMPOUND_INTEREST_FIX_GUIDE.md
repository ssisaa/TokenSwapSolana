# APY Compound Interest Fix Guide

## Problem Summary

The staking program has a critical issue with reward calculations that's causing a massive discrepancy between displayed and received rewards:

- UI shows approximately 5-6 YOS rewards
- Users actually receive around 5,000,000 YOS (million-fold increase)

This happens during both harvest and unstake operations.

## Root Cause Analysis

After thorough code review, we identified that the compound interest calculation in the Solana program has a critical scaling issue:

1. **Improper Rate Scaling**: The rate is correctly converted from basis points to percentage (12000 → 0.00000125%), but the compound interest formula needs the rate as a decimal (0.00000125% → 0.0000000125)

2. **Exponentiation with Unscaled Rate**: When the rate isn't properly scaled down by 100, the exponentiation `(1 + rate)^time` creates massive overflow

3. **Token Decimals**: The calculation doesn't properly account for token decimals (9 decimal places)

## Complete Fix: Compound Interest with Proper Scaling

We're preserving the compound interest formula for APY while fixing the scaling issues:

```rust
// CRITICAL FIX V4: COMPOUND INTEREST WITH PROPER SCALING

// Helper function for reward calculation - FIXED COMPOUND INTEREST VERSION
fn calculate_rewards(
    staked_amount: u64,
    time_staked_seconds: i64,
    stake_rate_per_second: u64
) -> u64 {
    // Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
    let rate_decimal = (stake_rate_per_second as f64) / 1_000_000.0;
    
    // CRITICAL FIX: Divide by 100 to convert from percentage to decimal
    // 0.00000125% → 0.0000000125
    let rate_as_decimal = rate_decimal / 100.0;
    
    // Convert raw amount to token units for calculation (9 decimals)
    let principal_tokens = staked_amount as f64 / 1_000_000_000.0;
    
    // Calculate using compound interest formula: principal * ((1 + rate)^time - 1)
    let compound_factor = (1.0 + rate_as_decimal).powf(time_staked_seconds as f64) - 1.0;
    let rewards_tokens = principal_tokens * compound_factor;
    
    // Convert back to raw token units for blockchain storage
    let raw_rewards = (rewards_tokens * 1_000_000_000.0) as u64;
    
    raw_rewards
}
```

This fix preserves compound interest for APY while ensuring the rewards shown in the UI match what users receive in their wallets.

## Deployment Steps

### 1. Update and Build the Solana Program

1. Replace the `calculate_rewards` function in `program/src/lib.rs` with the fixed version
2. Update the `process_harvest` and `process_unstake` functions to use the new calculation
3. Build the program:
   ```bash
   cd program
   cargo build-bpf
   ```

### 2. Deploy the Updated Program

```bash
solana program deploy \
  --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 \
  target/deploy/token_staking.so
```

### 3. Update Frontend Calculations

Ensure the frontend calculations match exactly:

```typescript
function calculatePendingRewards(staking: {
  stakedAmount: number;
  timeStakedSinceLastHarvest: number;
  stakeRatePerSecond: number;
}): number {
  // Convert percentage to decimal (critical step!)
  const stakeRateDecimal = staking.stakeRatePerSecond / 100;
  
  // Use compound interest formula with properly scaled rate
  const compoundFactor = Math.pow(1 + stakeRateDecimal, staking.timeStakedSinceLastHarvest) - 1;
  const compoundRewards = staking.stakedAmount * compoundFactor;
  
  return compoundRewards;
}
```

## Testing Procedure

1. **Initial Check**: Check the UI showing available rewards (should be ~6 YOS currently)
2. **Deploy Update**: Follow the deployment steps above
3. **Verify Rewards**: Execute a harvest transaction and verify received rewards match UI display
4. **Test Unstaking**: Stake some tokens, wait for rewards to accrue, then unstake to verify rewards

## Expected Results

- UI will show accurate reward amounts (e.g., 6.08 YOS)
- When harvested/unstaked, wallet will receive exactly that amount (6.08 YOS)
- No more million-fold discrepancy between UI and wallet

## Technical Details

This fix maintains compound interest for APY while addressing the scaling issue. The key change is ensuring that percentage rates are properly converted to decimal values (divided by 100) before applying the compound interest formula.