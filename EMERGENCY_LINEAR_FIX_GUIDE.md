# EMERGENCY FIX: Million-fold Reward Discrepancy

## Critical Issue

We've identified a critical issue where the UI shows a small number of rewards (e.g., 6.5 YOS) but users receive millions of tokens (e.g., 6,257,082 YOS) when harvesting or unstaking.

This massive discrepancy must be fixed immediately to prevent token economics disruption.

## Root Cause

After extensive analysis, we've determined that the compound interest formula in the Solana program is causing exponential overflow due to improper rate scaling.

## Emergency Fix Approach

We're replacing the compound interest calculation with a simple linear interest calculation in both:
1. The Solana program
2. The frontend calculations

This approach sacrifices compound interest (APY) for correctness and ensures that what users see is what they get.

## Implementation Steps

### 1. Update the Solana Program

Replace the `calculate_rewards` function in `program/src/lib.rs` with this simplified version:

```rust
fn calculate_rewards(
    staked_amount: u64,
    time_staked_seconds: i64,
    stake_rate_per_second: u64
) -> u64 {
    // Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
    let rate_percentage = (stake_rate_per_second as f64) / 1_000_000.0;
    
    // Convert from percentage to decimal 
    let rate_decimal = rate_percentage / 100.0;
    
    // Convert raw amount to token units for calculation
    let principal_tokens = staked_amount as f64 / 1_000_000_000.0;
    
    // SIMPLE LINEAR INTEREST: principal * rate * time
    // No exponentiation, no compounding
    let rewards_tokens = principal_tokens * rate_decimal * time_staked_seconds as f64;
    
    // Convert back to raw token units for blockchain storage
    let raw_rewards = (rewards_tokens * 1_000_000_000.0) as u64;
    
    // Log all values for transparency and debugging
    msg!("Staked amount: {} tokens ({} raw units)", principal_tokens, staked_amount);
    msg!("Rate: {}% per second ({} decimal)", rate_percentage, rate_decimal);
    msg!("Time staked: {} seconds", time_staked_seconds);
    msg!("Calculated rewards: {} tokens ({} raw units)", rewards_tokens, raw_rewards);
    
    raw_rewards
}
```

### 2. Build and Deploy the Solana Program

```bash
cd program
cargo build-bpf
solana program deploy --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 --keypair program-keypair.json target/deploy/token_staking.so
```

### 3. Update Frontend Calculation

Replace the reward calculation in the frontend code with this linear approach:

```typescript
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
  
  console.log(`LINEAR REWARDS CALCULATION: ${stakedAmount} × ${rateDecimal} × ${timeStakedSinceLastHarvest} = ${linearRewards}`);
  
  return linearRewards;
}
```

This function should replace the existing reward calculation in `hooks/useStaking.ts`.

## Verification After Deployment

1. **Check UI Display**: The UI should show realistic reward amounts (similar to before)
2. **Test Harvesting**: Harvest rewards and verify the amount received matches the UI
3. **Test Unstaking**: Unstake tokens and verify rewards received match expectations

If the fix is successful, the UI should display approximately 6.61 YOS for current users, and they should receive exactly 6.61 YOS when harvesting/unstaking - not millions.

## Future Considerations

1. This fix changes from compound to simple interest, which may affect advertised APY
2. Consider informing users of the calculation method change
3. A more complex fix could restore compound interest in the future while maintaining accuracy

## Rollback Plan

If issues persist, restore the original program using the backup:

```bash
solana program deploy --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 --keypair program-keypair.json staking_program_backup.so
```