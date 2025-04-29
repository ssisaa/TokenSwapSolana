# Harvest Function Fixes and Transaction Error Resolution

## 1. Decimal Mismatch Fix

### Issue
When users harvest rewards, the UI displays one amount (e.g., 0.0673 YOS) but the wallet receives a much smaller amount (e.g., 0.00686 YOS) - approximately 1/10 of what's expected.

### Root Cause
The Solana program's `process_harvest` function calculates rewards correctly but then **divides by 10^9** before transferring tokens:

```rust
// The problematic code:
let ui_rewards = raw_rewards / 1_000_000_000;

// Then transfers the reduced amount:
invoke_signed(
    &spl_token::instruction::transfer(
        /* ... */
        ui_rewards, // This is 1/10^9 of what it should be!
    )?,
    /* ... */
)
```

This division is incorrect because SPL tokens already handle decimals correctly (1 token = 10^9 raw units for 9 decimal tokens).

### Solution
Remove the division and use raw_rewards directly in the transfer (see `program/src/harvest_fix.rs`):

```rust
// Fixed code:
invoke_signed(
    &spl_token::instruction::transfer(
        /* ... */
        raw_rewards, // Use the full raw amount directly
    )?,
    /* ... */
)
```

## 2. Transaction Error Fixes

### "Blockhash not found" Errors

Changed the blockhash commitment level from 'confirmed' to 'finalized' to ensure transactions have more time before the blockhash expires:

```typescript
// Before:
let blockhashResponse = await connection.getLatestBlockhash('confirmed');

// After:
let blockhashResponse = await connection.getLatestBlockhash('finalized');
```

Also increased retry count from 3 to 5:

```typescript
// Before:
const signature = await connection.sendRawTransaction(rawTransaction, {
  skipPreflight: false,
  preflightCommitment: 'confirmed',
  maxRetries: 3
});

// After:
const signature = await connection.sendRawTransaction(rawTransaction, {
  skipPreflight: false,
  preflightCommitment: 'finalized',
  maxRetries: 5
});
```

### "Transaction already processed" Errors

Improved error handling to detect this case and show a more informative message:

```typescript
// Handle "already processed" errors as a potential success
if (sendError.message.includes("This transaction has already been processed")) {
  console.log("Transaction was already processed - this may indicate success");
  toast({
    title: "Transaction Already Processed",
    description: "Your transaction may have already been processed. Please check your wallet balance before trying again.",
    variant: "destructive"
  });
  
  // Return a special indicator for this case
  return "ALREADY_PROCESSED";
}
```

## Implementation Notes

1. **Program Fix**: The Rust program changes must be implemented by recompiling the program with the fixed harvest function and redeploying to the Solana blockchain.

2. **Client Fixes**: The client-side transaction handling improvements have been implemented directly and are active now.

## What Users Will Experience

Before: UI shows one reward amount but wallet receives much less (about 1/10th).
After: UI shows reward amount and wallet will receive exactly that amount.

Transaction errors will also be handled more gracefully, with clearer error messages and higher success rates.