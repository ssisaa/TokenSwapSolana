# Mint Authority Change Guide

This guide explains how to set the mint authority for the YOS token so that the Multi-Hub Swap program can mint rewards tokens.

## Problem Summary

To enable YOS token rewards, the program's PDA account must be set as the mint authority for the YOS token. Currently, the mint authority is a different wallet (`CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9`).

## Option 1: Using the Admin Interface (requires mint authority wallet)

If you have access to the wallet with address `CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9`:

1. Go to the Admin page in the application
2. Connect using the wallet with address `CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9`
3. Click "Check Authority" to verify the current authority
4. Click "Set Program as Authority" to transfer the mint authority to the program

## Option 2: Using the Command-Line Script (for the mint authority owner)

We've provided a script (`set-mint-authority.js`) that the owner of the wallet with address `CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9` can run.

### Step 1: Setup

1. Ensure you have Node.js installed
2. Install the required dependencies:
   ```
   npm install @solana/web3.js @solana/spl-token
   ```

### Step 2: Prepare the Wallet Private Key

The script requires access to the private key of the wallet with the mint authority. The private key must be stored in a file as a JSON array. For security:

1. Create this file in a secure location
2. Delete it immediately after use
3. Never share the private key or post it online

Example private key file format:
```json
[137, 42, 171, 49, ...]
```

### Step 3: Run the Script

Run the script with the path to the private key file:

```bash
node set-mint-authority.js /path/to/private-key-file.json
```

The script will:
1. Verify the loaded wallet matches the expected mint authority
2. Derive the program authority PDA
3. Create and send a transaction to set the program authority PDA as the new mint authority
4. Display the transaction signature for verification

### Expected Output

If successful, you'll see output similar to:

```
Successfully loaded keypair for CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9
This matches the expected mint authority.
Program authority PDA: Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ (bump: 255)
Sending transaction to set mint authority...
✓ SUCCESS! Transaction sent successfully
Transaction signature: 4RPM6vfiBr5qrqY3...
View on Solana Explorer: https://explorer.solana.com/tx/4RPM6vfiBr5qrqY3...?cluster=devnet

The mint authority for YOS token (2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop) has been successfully set to:
Program authority PDA: Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ
```

## Option 3: Create a New YOS Token (alternative solution)

If you cannot access the mint authority wallet, you can:

1. Create a new YOS token with your own wallet as the mint authority
2. Set the program as the mint authority for this new token
3. Update the program configuration to use the new YOS token address

Contact the development team for assistance with this option.