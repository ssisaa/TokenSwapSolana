# Solana Playground Deployment Guide for Multihub Swap V3

This guide provides step-by-step instructions for deploying the Multihub Swap V3 program using Solana Playground.

## Preparation

1. Copy the program code to Solana Playground:
   - Go to [Solana Playground](https://beta.solpg.io/)
   - Create a new project
   - Copy the entire content of `multihub_swap_v3.rs` to the main file

## Program ID Setup

2. Create a new program ID in Solana Playground:
   - Click on "Build" menu in Playground
   - Select "Create New Program ID"
   - Save the generated Program ID (you'll need it later)

3. Update the program ID in the code:
   - Find the line with `solana_program::declare_id!("Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L");`
   - Replace it with the new Program ID from Playground: `solana_program::declare_id!("YOUR_NEW_PLAYGROUND_PROGRAM_ID");`

## Build and Deploy

4. Build the program:
   - Click "Build" button in Playground
   - Verify there are no errors in the console output

5. Deploy the program:
   - Click "Deploy" button in Playground
   - Select "Deploy new" option
   - Wait for deployment to complete (this may take a few minutes)
   - If you encounter any errors, check the console output for details

## Initialization

6. Initialize the program:
   - Using Playground's interface:
     - Click on "Program" tab
     - Select "Initialize" from the instruction dropdown
     - Fill in the parameters:
       - Admin: Your wallet address
       - YOT Mint: `2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF`
       - YOS Mint: `GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n`
       - LP Contribution Rate: `2000` (20%)
       - Admin Fee Rate: `10` (0.1%)
       - YOS Cashback Rate: `300` (3%) 
       - Swap Fee Rate: `30` (0.3%)
       - Referral Rate: `50` (0.5%)
     - Click "Send Transaction"
     - Approve the transaction in your wallet

## Update Client Code

7. Update the client code with the new Program ID:

```typescript
// Update in client/src/lib/multihub-contract-v3.ts
export const MULTIHUB_SWAP_PROGRAM_ID = 'YOUR_NEW_PLAYGROUND_PROGRAM_ID';
```

## Troubleshooting

If you encounter "invalid account data for instruction" errors:
1. Try initializing the program first before attempting any swaps
2. Make sure all token accounts exist before interacting with the program
3. Check the program logs for detailed error messages

## Common Issues and Solutions

### Issue: Transaction simulation failed
Solution: Ensure the YOS token account exists for the user before sending the swap transaction. The program will validate this account.

### Issue: Program already initialized
Solution: Use the CloseProgram instruction to reset the program state before reinitializing.

### Issue: Insufficient funds
Solution: Make sure your wallet has enough SOL to cover transaction fees and account creation.

## Testing the Deployment

After successful deployment and initialization, you can test the program using Playground's interface:

1. Create token accounts for testing:
   - Click on "SPL Token" tab
   - Use "Create Account" to create accounts for YOT, YOS and test tokens

2. Test a swap:
   - Click on "Program" tab
   - Select "Swap" from the instruction dropdown
   - Fill in the parameters:
     - Amount In: Amount of tokens to swap (e.g., `1000000000` for 1 token with 9 decimals)
     - Min Amount Out: Minimum amount you expect to receive
   - Click "Send Transaction"
   - Approve the transaction in your wallet

## Integrating with Frontend

Once deployed and tested, update your frontend to use the new program ID:

1. Update the program ID in `multihub-contract-v3.ts` 
2. Use `MultihubIntegrationV3` for token swaps
3. Test the integration with various token combinations