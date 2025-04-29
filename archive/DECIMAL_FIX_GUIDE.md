# Token Decimal Fix - Deployment Guide

## Issue Description

We've identified an issue in the Solana staking contract where token amounts are being transferred without properly considering token decimals, causing wallet displays to show very large numbers.

**Problem Symptoms:**
- When harvesting 4.0155 YOS rewards, wallet shows 384,754,332 YOS instead
- Internal calculations are correct, but the display is misleading to users

## Fix Details

The fix involves updating the Rust program code in two key functions:

1. **process_harvest function** - Ensures correct decimal handling during reward transfers
2. **process_unstake function** - Ensures correct decimal handling during combined unstaking and reward transfers

We've created several files with the fixed code:
- `program/src/harvest_fix.rs` - Fixed decimal handling in the harvest function
- `program/src/unstake_fix.rs` - Fixed decimal handling in the unstake function
- `program/src/unstake_improved.rs` - Advanced fix for unstaking that handles both decimal issues AND insufficient program YOS token balance

These changes maintain the same internal reward calculations but improve the display of token amounts in wallets by properly handling token decimals. The unstake_improved.rs version also adds graceful fallback to ensure users can always unstake their YOT tokens even if the program doesn't have enough YOS tokens to pay rewards.

## Deployment Steps

### 1. Update the Program Code

Replace the existing `process_harvest` and `process_unstake` functions in `program/src/lib.rs` with the versions provided in the fix files.

### 2. Build the Program

```bash
cd program
cargo build-bpf
```

This will compile your program into a BPF (Berkeley Packet Filter) file that can be deployed to the Solana blockchain.

### 3. Deploy to Solana Devnet

```bash
solana program deploy --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 --keypair <PATH_TO_DEPLOYER_KEYPAIR> target/deploy/staking_program.so
```

Replace `<PATH_TO_DEPLOYER_KEYPAIR>` with the path to the keypair that has authority to update the program.

### 4. Verification

After deployment, perform these tests:

1. Stake a small amount of YOT tokens
2. Wait a few minutes to generate rewards
3. Harvest rewards and verify the wallet shows the correct amount with proper decimals
4. Unstake with accumulated rewards and verify the wallet shows correct amounts

## Technical Implementation Notes

The key changes in the implementation are:

1. We maintain raw token amounts for internal calculations
2. We update log messages to display both raw and human-readable amounts
3. We're not changing how token amounts are calculated, only how they're displayed

This fix ensures that users see token amounts with the proper 9 decimals in their wallets when harvesting rewards.

## Fallback Plan

If any issues arise after deployment, we can revert to the previous version by redeploying the original program code.