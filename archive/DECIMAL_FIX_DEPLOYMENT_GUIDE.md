# Solana Staking Program - Decimal Overflow Fix Deployment Guide (V2)

## Problem Summary

We identified a critical issue with the staking reward calculation in the Solana staking program that was causing massive decimal overflow. When users tried to harvest their staking rewards:

1. **Initial Issue**: UI showed ~10x what the wallet actually received (UI: 2.4177 YOS, wallet: 0.2318 YOS)
2. **After First Fix Attempt**: UI showed small amounts but wallet received millions of tokens (UI: 3.6124 YOS, wallet: 349M YOS)

## Root Cause

The root cause was identified in both the `process_harvest` and `process_unstake` functions:

1. **Incorrect Rate Conversion**: The program was converting staking rate from basis points to a decimal using `/10000.0` when it should have used a much higher denominator `/1,000,000.0` to properly express the very small per-second rate.

2. **Missing Token Unit Conversions**: The rewards calculation was not properly converting between token units (human-readable with decimals) and raw units (blockchain representation without decimals).

3. **Compounding Decimal Error**: The calculation error was amplified by large token amounts and long staking periods, resulting in massive overflows.

## Implemented Fixes

The following critical fixes have been applied:

1. **Rate Conversion Fix**: Changed the rate conversion from `/10000.0` to `/1,000,000.0` to properly handle the very small per-second rate (12000 basis points = 0.00000125% per second).

2. **Token Unit Conversion**: Added proper conversion between token units and raw blockchain units by:
   - Converting staked amounts from raw units to token units (`/ 1_000_000_000.0`)
   - Calculating rewards in human-readable token units 
   - Converting back to raw units for blockchain storage (`* 1_000_000_000.0`)

3. **Consistent Approach**: Applied the same fix to both `process_harvest` and `process_unstake` functions, as well as the helper `calculate_rewards` function.

## Deployment Steps

1. Update and build the Solana program with the fixes:
   ```
   cd program
   cargo build-bpf
   ```

2. Deploy the updated program to Solana devnet:
   ```
   solana program deploy ./target/deploy/token_staking.so --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
   ```

3. Verify the deployment was successful:
   ```
   solana program show --programs | grep 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
   ```

4. Test the fix by:
   - Staking a small amount of YOT tokens
   - Waiting a few minutes
   - Attempting to harvest rewards
   - Verifying that the amount shown in the UI matches what is received in the wallet

## Verification

After deploying the program, confirm that:

1. The reward calculation in the UI matches what users actually receive in their wallets.
2. No more overflow errors occur with large token amounts or long staking periods.
3. The harvesting and unstaking processes complete successfully.

## Technical Details

The key changes from the original implementation are:

Original code:
```rust
// Convert staking rate from basis points to decimal
let rate_decimal = (program_state.stake_rate_per_second as f64) / 10000.0;

// Calculate raw rewards based on staked amount, time, and CURRENT rate
let raw_rewards = (staking_data.staked_amount as f64 * time_staked_seconds as f64 * rate_decimal) as u64;
```

Fixed code:
```rust
// CRITICAL FIX FOR DECIMAL OVERFLOW
// Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
let rate_decimal = (program_state.stake_rate_per_second as f64) / 1_000_000.0;

// Calculate rewards in token units first (e.g., 3.5 YOS)
let rewards_token_units = (staking_data.staked_amount as f64 / 1_000_000_000.0) * 
                          (time_staked_seconds as f64) * 
                          rate_decimal;

// Convert token units to raw units for storage and transfer
let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
```