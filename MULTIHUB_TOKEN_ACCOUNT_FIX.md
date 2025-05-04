# Multihub Token Account Fix Guide

When trying to swap tokens and encountering the `InvalidAccountData` error, the issue might be with the token accounts needed for the swap. Here's how to verify and fix these accounts:

## Diagnostic Steps for InvalidAccountData Error

The error is occurring at the instruction at index 2, which is happening because either:

1. The program authority PDA is being misused (trying to deserialize data from it)
2. One of the token accounts doesn't exist yet or isn't properly initialized
3. A combination of both issues

## Steps to Fix Token Account Issues

### 1. Verify Program Authority Account

First, make sure the program authority account is properly funded with SOL:

```javascript
// Click the "Fix InvalidAccountData Error" button in the debug panel
// This verifies and funds the program authority account
```

### 2. Verify All Token Accounts Exist

For each token involved in the swap (from, to, and YOS for cashback), verify that:

1. The user has a token account for each token
2. The program authority has an associated token account for each token
3. All token accounts are properly initialized

### 3. For a SOL → YOT Swap (Important!)

For a SOL → YOT swap, the program needs:

1. A YOT token account owned by program authority (for sending YOT to the user)
2. This YOT account must be FUNDED with YOT tokens

```javascript
// Check if program has YOT tokens available to send to user
// If not, you will get an error because it can't complete the swap
```

### 4. Try with a Smaller Amount

If the swap is failing with a large amount, try with a much smaller amount first:

```javascript
// Try swapping just 0.01 SOL instead of a larger amount
// This can help identify if there's a balance issue
```

## Technical Background: Why This Happens

When the program runs `TokenAccount::unpack(&account.data.borrow())?`, it expects:

1. The account to exist
2. The account to be a valid SPL Token account with correct data layout
3. The account to be properly initialized

If any of these conditions fail, you'll get an `InvalidAccountData` error.

## How Swap Transactions Work

For a swap to be successful, these steps must happen in order:

1. The user's token account for the source token must exist and be funded
2. The program authority's token account for the source token must exist
3. The program authority's token account for the destination token must exist AND be funded
4. The user's token account for the destination token must exist
5. The program authority's YOS token account must exist AND be funded for cashback

If any of these accounts don't exist or aren't properly funded, the swap will fail.

## Fund Program Accounts

To ensure the program has enough tokens to process swaps:

1. Go to the Admin/Debug Panel
2. Use the "Fund Program YOT Account" function to send YOT tokens to the program
3. Use the "Fund Program YOS Account" function to send YOS tokens for cashback

This ensures the program has tokens available to send to users during swaps.