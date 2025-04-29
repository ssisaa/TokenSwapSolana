# Decimal Fix Deployment Guide

## Overview of Fixes Made

We've identified and fixed a critical decimal mismatch issue in the staking program:

1. The root cause: In both `process_harvest` and `process_unstake` functions, the program was incorrectly dividing the rewards amount by 10^9 before transferring tokens:
   ```rust
   let ui_rewards = raw_rewards / 1_000_000_000;
   
   // Then used this reduced amount in transfer
   invoke_signed(
       &spl_token::instruction::transfer(
           /* ... */
           ui_rewards, // This is 1/10^9 of what it should be!
       )?,
       /* ... */
   )
   ```

2. The fix: We've removed this division and now use the raw amount directly:
   ```rust
   invoke_signed(
       &spl_token::instruction::transfer(
           /* ... */
           raw_rewards, // Use the full raw amount directly
       )?,
       /* ... */
   )
   ```

## Deployment Steps

To implement this fix, you need to build and deploy the updated Solana program:

1. Make sure you have the Solana CLI tools installed and configured:
   ```bash
   solana --version
   solana config get
   ```

2. Navigate to the program directory:
   ```bash
   cd program
   ```

3. Build the program:
   ```bash
   cargo build-bpf
   ```
   
   *Alternative build commands if build-bpf doesn't work:*
   ```bash
   cargo build --target bpfel-unknown-unknown --release
   mkdir -p target/deploy
   cp target/bpfel-unknown-unknown/release/stake.so target/deploy/
   ```

4. Deploy the program to the Solana devnet (using the existing program ID):
   ```bash
   solana program deploy --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 target/deploy/stake.so
   ```

## Verification Steps

After deployment, you should verify the fix works correctly:

1. Check the staking dashboard and note the pending rewards amount
2. Perform a harvest operation
3. Verify that your wallet receives the full amount shown in the UI (not 1/10th)

For example:
- Before: UI shows 2.4177 YOS pending rewards, wallet receives 0.2318 YOS
- After: UI shows 2.4177 YOS pending rewards, wallet receives 2.4177 YOS

## Other Improvements

In addition to the decimal fix, we've also:

1. Improved error handling for "Transaction already processed" errors
2. Updated block commitment level from 'confirmed' to 'finalized'
3. Increased transaction retry count from 3 to 5

These client-side improvements will help reduce transaction failures due to network issues.

## Detailed Explanation

For a deeper understanding of the decimal issue, read the full explanation in:
- `program/HARVEST_FIX_GUIDE.md`
- `HARVEST_FUNCTION_FIXES.md`