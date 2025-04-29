# Linear Interest Fix Deployment Guide

## Critical Issue Summary

We've identified a severe discrepancy in the staking rewards calculation where the UI shows a small amount (e.g., 8.02 YOS) but users receive millions of tokens (e.g., ~8 million YOS) when harvesting or unstaking. This occurs because the compound interest formula is causing massive token overflow.

## Solution Overview

We're implementing a consistent linear interest calculation across all parts of the system:

1. The `calculate_rewards` function (already updated)
2. The `process_harvest` function
3. The `process_unstake` function 
4. Frontend calculations for UI display

By using a simple linear interest formula (`principal * rate * time`), we ensure that what users see is what they get, with no more million-fold discrepancies.

## Deployment Steps

### Step 1: Update the Solana Program

The critical functions have been pre-written for you in `program/INTEGRATED_LINEAR_FIX.rs`. You need to:

1. Open `program/src/lib.rs` and locate the `process_harvest` and `process_unstake` functions
2. Replace them with the versions from `program/INTEGRATED_LINEAR_FIX.rs`

### Step 2: Build the Updated Program

```bash
cd program
cargo build-bpf
```

### Step 3: Deploy to Solana Devnet

```bash
solana program deploy \
  --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 \
  --keypair ../program-keypair.json \
  target/deploy/token_staking.so
```

### Step 4: Update Frontend Calculation (Optional)

For the frontend to match exactly with the blockchain calculations:

1. Open `client/src/hooks/useStaking.ts`
2. Find the function that calculates pending rewards
3. Replace it with the `calculatePendingRewards` function from `client/src/hooks/useStaking.linear.ts`

## Testing the Fix

### Test for Harvesting

1. Connect your wallet and navigate to the Staking page
2. Note the displayed rewards amount (e.g., ~8.02 YOS)
3. Click "Harvest"
4. Approve the transaction in your wallet
5. Verify that the amount of YOS tokens received matches what was displayed in the UI

### Test for Unstaking

1. Connect wallet and navigate to the Staking page
2. Note your staked amount and pending rewards
3. Click "Unstake" and enter an amount of YOT to unstake
4. Approve the transaction in your wallet
5. Verify that:
   - You received the YOT tokens you unstaked
   - You received the correct amount of YOS rewards (not millions)

## Technical Details of the Fix

### Original Issue

The compound interest formula was causing massive overflow:
```rust
let compound_rewards_tokens = principal_tokens * ((1.0 + rate_decimal).powf(time_staked_seconds as f64) - 1.0);
```

### Linear Interest Fix

We replaced it with a simple linear interest calculation:
```rust
// Convert staking rate from basis points to percentage
let rate_percentage = (program_state.stake_rate_per_second as f64) / 1_000_000.0;

// Convert from percentage to decimal
let rate_decimal = rate_percentage / 100.0;

// SIMPLE LINEAR INTEREST: principal * rate * time
let rewards_tokens = principal_tokens * rate_decimal * time_staked_seconds as f64;
```

This approach:
1. Properly converts the rate from basis points to a decimal
2. Uses a simple multiplication formula that can't overflow
3. Is consistent across all parts of the system

## Rollback Plan (If Needed)

If any issues arise with the deployment:

1. Make sure you have a backup of the original program before deploying
2. If you need to rollback:
   ```bash
   solana program deploy \
     --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 \
     --keypair ../program-keypair.json \
     backup/token_staking_backup.so
   ```

## Verification

After deployment, monitor:
1. UI displayed rewards
2. Actual tokens received when harvesting/unstaking
3. Program logs to ensure calculations are consistent