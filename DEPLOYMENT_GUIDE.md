# Solana Staking Program Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the updated Solana staking program that fixes the critical reward calculation issue. The updated program uses a linear interest calculation model that ensures consistent and accurate reward distribution.

## Prerequisites

- Solana CLI installed and configured for devnet
- Program source code in the `program` directory
- Program keypair file `program-keypair.json` in the root directory

## Deployment Steps

### 1. Build the Solana Program

```bash
cd program
cargo build-bpf
```

This compiles the Rust program into a deployable Solana BPF program.

### 2. Deploy to Solana Devnet

```bash
solana program deploy \
  --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 \
  --keypair ../program-keypair.json \
  target/deploy/token_staking.so
```

> **Important**: Make sure to use the existing program ID to update the program rather than deploying as a new program.

### 3. Verify Deployment

Confirm that the program has been successfully deployed:

```bash
solana program show --programs | grep 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
```

You should see your program ID in the output with the updated program size.

## Testing the Fix

### Test Case: Harvesting Rewards

1. Connect your wallet to the application
2. Navigate to the Staking page
3. Check the current displayed rewards value (e.g., ~7.6 YOS)
4. Click the "Harvest" button
5. Approve the transaction in your wallet
6. Verify that the amount of YOS tokens received matches what was displayed in the UI

### Test Case: Unstaking with Rewards

1. Navigate to the Staking page
2. Click "Unstake" and enter an amount of YOT to unstake
3. Approve the transaction in your wallet
4. Verify that the YOT tokens are returned to your wallet
5. Verify that the YOS rewards received match what was displayed in the UI

## Changes Made

The critical fix replaced the compound interest calculation with a linear interest calculation:

```rust
// SIMPLE LINEAR INTEREST: principal * rate * time
let rewards_tokens = principal_tokens * rate_decimal * time_staked_seconds as f64;
```

This approach guarantees that:
1. What users see in the UI is what they receive
2. No more million-fold discrepancy between displayed and received tokens
3. Stable and predictable reward calculation

## Rollback Procedure (If Needed)

If any issues arise with the new implementation, you can roll back to the previous version:

```bash
solana program deploy \
  --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 \
  --keypair program-keypair.json \
  backup/token_staking_backup.so
```

> Note: Ensure you have a backup of the original program before deploying the fix.