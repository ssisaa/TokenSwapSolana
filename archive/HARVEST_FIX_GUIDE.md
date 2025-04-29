# YOS Harvest Decimal Fix Guide

## Problem Description

We've identified a critical decimal mismatch in the harvest function where:

- **UI Display**: The web application correctly shows the pending rewards (e.g., 0.0673 YOS)
- **Wallet Reality**: When harvested, users receive a much smaller amount (e.g., 0.00686 YOS)

## Root Cause Analysis

The issue is in the Rust program's `process_harvest` function. The program correctly:
1. Calculates raw rewards based on staking amount, time, and rate
2. Updates the user's `total_harvested` field with this raw amount
3. Logs the correct UI amount for display 

However, when transferring the actual tokens, it incorrectly **divides the raw amount by 1,000,000,000** (10^9):

```rust
// The problematic code in process_harvest:
let ui_rewards = raw_rewards / 1_000_000_000;

// Then it transfers this reduced amount:
invoke_signed(
    &spl_token::instruction::transfer(
        token_program.key,
        program_yos_token_account.key,
        user_yos_token_account.key,
        program_authority.key,
        &[],
        ui_rewards, // This is 1/10^9 of what it should be!
    )?,
    // ...
)
```

This division is incorrect because the SPL token standard already accounts for decimals:
- 1 token = 10^9 raw units (for tokens with 9 decimals like YOT and YOS)
- The raw_rewards calculation already produces the correct raw amount

## The Fix

The fix is simple - we need to use `raw_rewards` directly in the transfer without dividing:

```rust
// Fixed code (see harvest_fix.rs):
invoke_signed(
    &spl_token::instruction::transfer(
        token_program.key,
        program_yos_token_account.key,
        user_yos_token_account.key,
        program_authority.key,
        &[],
        raw_rewards, // Use the full raw amount directly - NO division
    )?,
    // ...
)
```

## Implementation Notes

1. The Rust code in `harvest_fix.rs` provides a corrected version of the function
2. To implement this fix, the program needs to be recompiled with this updated function
3. After deployment, users will see the correct amount of YOS tokens transferred to their wallets

## Testing Procedure

1. Check the user's YOS token balance before harvesting
2. Note the displayed pending rewards in the UI (e.g., 1.234 YOS)
3. Perform a harvest operation
4. Verify the user receives the full displayed amount (1.234 YOS)
5. Check the logs to confirm the correct amount was transferred

## Expected Results After Fix

- Users will receive the full reward amount shown in the UI
- The transaction will properly transfer the exact YOS tokens displayed as "Pending Rewards"
- Log messages will correctly match both the UI display and the transferred amounts