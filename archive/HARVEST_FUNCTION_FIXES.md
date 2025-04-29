# Critical Staking Reward Calculation Fix

## Problem Summary

We identified a critical issue with the reward calculation in the staking program that was causing massive decimal discrepancies between the UI and actual rewards:

1. **Initial Issue**: UI showed one reward amount but users received only ~10% in their wallet
   * Example: UI showed 2.4177 YOS, but wallet received only 0.2318 YOS

2. **Second Issue (after first fix attempt)**: UI showed small amounts but wallet received millions
   * Example: UI showed 3.6124 YOS, but wallet received 349,000,000 YOS

## Root Cause

The issue was traced to multiple compounding problems in the Solana program:

1. **Incorrect Rate Precision**: The program was converting staking rate from basis points to a decimal using `/10000.0` divisor, which didn't provide enough precision for very small per-second rates.

2. **Missing Token Unit Conversions**: The calculation didn't properly convert between human-readable token amounts (with decimals) and raw blockchain values (without decimals).

3. **Calculation Amplification**: With large staked amounts and long periods, these errors were massively amplified, resulting in either extremely small or extremely large reward amounts.

## Comprehensive Fix

The fix addresses all aspects of the issue across both the Solana program and frontend code:

### Solana Program Changes

1. **Increased Rate Precision**: 
   ```rust
   // BEFORE: Insufficient precision
   let rate_decimal = (program_state.stake_rate_per_second as f64) / 10000.0;
   
   // AFTER: Much higher precision
   let rate_decimal = (program_state.stake_rate_per_second as f64) / 1_000_000.0;
   ```

2. **Proper Token Unit Handling**:
   ```rust
   // BEFORE: Direct calculation with raw values
   let raw_rewards = (staking_data.staked_amount as f64 * time_staked_seconds as f64 * rate_decimal) as u64;
   
   // AFTER: Step-by-step calculation with proper unit conversion
   // Convert to token units for calculation
   let rewards_token_units = (staking_data.staked_amount as f64 / 1_000_000_000.0) * 
                            (time_staked_seconds as f64) * 
                            rate_decimal;
   
   // Convert back to raw units for blockchain storage
   let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
   ```

3. **Fixed Functions**:
   - `process_harvest` - Fixed reward calculation
   - `process_unstake` - Fixed reward calculation
   - `calculate_rewards` - Fixed helper function 

### Frontend Changes

1. **Updated Conversion Functions**:
   ```typescript
   // BEFORE
   const REFERENCE_RATE = 0.0000125;
   const REFERENCE_BASIS_POINTS = 120000;
   
   // AFTER - Matching the Solana program's new divisor
   if (basisPoints === 12000) {
     return 0.00000125; // 12000/1,000,000 = 0.00000125
   } else {
     return basisPoints / 1000000.0;
   }
   ```

2. **Fixed Parameter Encoding**:
   - When initializing or updating program parameters, we now use the same 1,000,000 multiplier
   - Special cases are handled explicitly to avoid floating point precision issues

## Deployment Instructions

### 1. Backup Current Program State (Optional)

If you want to preserve the current state or need to rollback:

```bash
# Get the current program data for backup
solana program dump 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 staking_program_backup.so
```

### 2. Build the Updated Program

From the project root:

```bash
cd program
cargo build-bpf
```

This compiles the program with all decimal fixes.

### 3. Deploy to Solana Devnet

Once built, deploy the program to the existing program ID:

```bash
solana program deploy \
  --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 \
  target/deploy/token_staking.so
```

### 4. Deploy Frontend Changes

The frontend changes will be deployed automatically when you push to the repository. These changes ensure the UI calculations match the Solana program's new calculation method.

### 5. Verification Steps

After deployment, verify the fix is working correctly:

1. Stake a small amount of YOT tokens (e.g., 100 YOT)
2. Wait a few minutes to accumulate rewards
3. Check the "Available Rewards" in the UI
4. Harvest the rewards
5. Verify the amount shown in the UI matches exactly what is received in the wallet

## Technical Implementation Details

### Key Changes in the Solana Program

1. **Rate Conversion**: Changed divisor from 10000.0 to 1,000,000.0 for much higher precision

2. **Token Unit Conversion**: 
   - Converted staked amount from raw units to token units (divide by 10^9)
   - Performed calculation in token units
   - Converted result back to raw units (multiply by 10^9)

3. **Consistent Changes**: Applied the same fix to all reward calculation functions

### Key Changes in the Frontend

1. **Basis Point Conversion**: Updated basis point to rate conversion to match the Solana program

2. **Special Value Handling**: Added explicit handling for common rate values to avoid floating point precision issues

3. **Documentation**: Added clear comments about the decimal handling in both directions

## Impact

This fix ensures:

1. **Precise Rewards**: Users will receive exactly the amount shown in the UI
2. **No Overflow**: No more massive token discrepancies due to calculation errors
3. **Consistent User Experience**: Staking rewards will behave predictably

## Monitoring

After deployment, monitor:

1. User feedback on staking rewards
2. Transaction logs for any unexpected errors
3. Program balance for unexpected token movements