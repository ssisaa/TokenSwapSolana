# Multihub Swap V3 Initialization Guide

This guide walks you through initializing the newly deployed V3 version of the Multihub Swap contract.

## Overview

The Multihub Swap V3 contract has been successfully deployed with program ID:
```
Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L
```

This new version includes several key improvements:
- Robust token account validation at the smart contract level 
- CloseProgram instruction for admin-controlled resets
- Automatic YOS token account creation

## Initialization Steps

1. **Access the Admin Page**:
   - Navigate to `/multihub-v3-admin` in the application
   - Or click "Multihub V3 Admin" in the sidebar

2. **Connect Your Wallet**:
   - Connect the admin wallet (AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ)
   - Only this wallet can initialize and manage the program

3. **Initialize the Program**:
   - Click the "Initialize Program" button
   - This sets up the program with the following parameters:
     - LP Contribution: 20%
     - Admin Fee: 0.1%
     - YOS Cashback: 3%
     - Swap Fee: 0.3%
     - Referral Fee: 0.5%

4. **Approve the Transaction**:
   - Confirm the transaction in your wallet
   - Wait for confirmation on the blockchain

5. **Verify Initialization**:
   - The success toast will appear with a link to the transaction
   - You can now use the swap functionality with the new program

## Using the Swap with V3

To use the new V3 contract for token swaps:

1. Navigate to the regular swap page
2. The application will now use the V3 contract behind the scenes
3. Token accounts will be automatically created as needed

The key improvements in the V3 swap process:
- YOS token account is validated at the contract level
- Account creation happens automatically 
- Error messages are clearer and more specific

## Troubleshooting

If you encounter any issues:

1. **Program Already Initialized**:
   - If the program is already initialized, you'll see an "Account already initialized" error
   - No action is needed - proceed to using the swap

2. **Reset the Program**:
   - If you need to reset the program, use the "Close Program" button
   - After closing, you can initialize again with the same or different parameters

3. **Transaction Verification Errors**:
   - Ensure you're using the admin wallet
   - Check that you have sufficient SOL for transaction fees
   - Verify the correct token addresses are being used

## Technical Details

The initialization process creates the following PDAs (Program Derived Addresses):
- Program State Address: Stores parameters and token addresses
- Program Authority: Handles token transfers and YOS minting

These accounts are created with the correct seeds and bumps to ensure they're secure and accessible only to the program.