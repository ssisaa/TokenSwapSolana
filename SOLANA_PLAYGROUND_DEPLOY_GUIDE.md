# Solana Playground Deployment Guide

This guide provides instructions for deploying the MultiHub Swap program using Solana Playground, which doesn't support the `--force` flag. We've implemented a special version that avoids initialization conflicts.

## Overview

To deploy the program without using the `--force` flag in Solana Playground, we've modified the implementation to use a different seed for the program state account PDA. This allows us to deploy to the same program ID without conflicts.

## Key Modifications

1. **New PDA Seed**: Changed from `state` to `state_v2` for the program state account
2. **Client-Side Changes**: Updated the client code to use the new seed when finding the program state PDA
3. **Error Handling**: Improved error handling in YOS token account validation and creation

## Deployment Steps

### 1. Prepare the Program

Ensure the program is using the updated implementation with the `state_v2` seed for the program state PDA.

### 2. Deploy using Solana Playground

1. Open [Solana Playground](https://beta.solpg.io/)
2. Import the `multihub_swap_fixed_new.rs` file
3. Set the deployment target to Devnet
4. Configure the Program ID to match your existing program: `3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps`
5. Build the program
6. Deploy without using the `--force` flag

### 3. Initialize the Program

After deployment, initialize the program with the proper parameters:

```typescript
// Example initialization code
const initializeLayout = new InitializeLayout({
  liquidity_contribution_percent: 20,  // 20%
  admin_fee_percent: 1,               // 0.1%
  yos_cashback_percent: 5,            // 5%
});

// Create and send the initialization transaction
// (See client/src/lib/multihub-contract.ts for the full implementation)
```

## Verification

To verify the deployment was successful:

1. Check that the program state account exists with the new PDA:
```bash
solana account $(solana-keygen pubkey -s "state_v2" 3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps)
```

2. Try to perform a swap from a wallet that doesn't have a YOS token account yet:
   - The swap should succeed on the first try
   - A new YOS token account should be created automatically
   - YOS cashback should be received

## Troubleshooting

### Initialization Issues

If initialization fails, check:
- That you're using the correct admin wallet
- That the program state account doesn't already exist
- That the YOT and YOS token mints are correctly specified

### Swap Issues

If swaps fail, check:
- Transaction logs for detailed error messages
- That all required token accounts exist
- That the swap parameters are valid

### Token Account Creation

If token account creation fails:
- Ensure your wallet has enough SOL to cover account creation costs
- Try creating the token accounts manually before the swap

## Summary

This approach allows deploying to the same program ID using Solana Playground, which doesn't support the `--force` flag. By using a different PDA seed, we can initialize a new program state without conflicting with the existing one.

The updated implementation also fixes the critical issues with YOS token account handling, ensuring users can successfully perform swaps and receive cashback rewards.