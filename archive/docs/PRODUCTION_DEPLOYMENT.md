# Production Deployment Guide

This guide outlines the steps required to deploy the Multihub Swap V3 application to Solana Mainnet.

## Prerequisites

1. Admin wallet with sufficient SOL balance (~1-2 SOL) to cover transaction fees and account creation
2. Admin wallet with mint authority for YOT and YOS tokens
3. Solana Mainnet RPC endpoint (recommend using a premium endpoint for production)

## Configuration Steps

### 1. Update `app.config.json`

Update the `app.config.json` file with mainnet values:

```json
{
  "network": "mainnet-beta",
  "programs": {
    "multiHub": {
      "v4": "YOUR_DEPLOYED_MAINNET_PROGRAM_ID"
    }
  },
  "tokens": {
    "YOT": "MAINNET_YOT_TOKEN_MINT_ADDRESS",
    "YOS": "MAINNET_YOS_TOKEN_MINT_ADDRESS"
  },
  "admin": "ADMIN_WALLET_ADDRESS",
  "parameters": {
    "swap": {
      "liquidityContributionRate": 0.2,
      "adminFeeRate": 0.001,
      "yosCashbackRate": 0.03,
      "swapFeeRate": 0.003,
      "referralRate": 0.005
    }
  },
  "accounts": {
    "pool": {
      "authority": "POOL_AUTHORITY_PDA_ADDRESS_IN_MAINNET",
      "state": "STATE_PDA_ADDRESS_IN_MAINNET",
      "sol": "SOL_ACCOUNT_ADDRESS_IN_MAINNET",
      "yot": "YOT_TOKEN_ACCOUNT_IN_MAINNET",
      "yos": "YOS_TOKEN_ACCOUNT_IN_MAINNET" 
    }
  }
}
```

### 2. Deploy the Program to Mainnet

1. Set up the Solana CLI with your deployment wallet
2. Build the program with optimizations enabled:
   ```bash
   cd program
   cargo build-bpf --release
   ```
3. Deploy to mainnet:
   ```bash
   solana program deploy --program-id path/to/program-keypair.json target/deploy/multihub_swap_v4.so
   ```
4. Update `app.config.json` with the deployed program ID

### 3. Initialize and Fund the Program

Follow these steps in the admin dashboard:

1. Initialize the Program
   - Click "Initialize Program" in the admin dashboard
   - Approve the transaction in your wallet
   - Verify the transaction on the Solana Explorer

2. Fund the Program Authority with SOL
   - Send at least 0.1 SOL to the program authority
   - This is needed for the program to create token accounts and perform swaps

3. Create Token Accounts and Fund with Liquidity
   - Use the Token Transfer Panel to transfer or mint tokens to the program PDAs
   - For YOT: Mint or transfer at least 1,000,000 YOT tokens to enable SOL → YOT swaps
   - For YOS: Mint or transfer at least 1,000,000 YOS tokens for cashback rewards

### 4. Final Verification

Before launching to users, perform these verification steps:

1. Check Program State
   - Verify all parameters are correctly set
   - Confirm pool authority PDAs are properly funded with SOL

2. Verify Token Accounts
   - Confirm YOT and YOS token accounts are created and funded
   - Check token balances are sufficient for expected trading volume

3. Test Swaps
   - Perform a small SOL → YOT swap
   - Perform a small YOT → SOL swap
   - Verify that YOS cashback is received

4. Monitor for Errors
   - Check browser console for any errors
   - Verify transaction logs on Solana Explorer

## Maintenance Procedures

### Increasing Liquidity

When additional liquidity is needed:

1. Go to the admin dashboard
2. Use the Token Transfer Panel to mint or transfer additional tokens to the program PDAs
3. Monitor token balances periodically to ensure sufficient liquidity

### Emergency Procedures

If issues are detected:

1. Pause trading (if applicable)
2. Backup all program data and account states
3. Use the "Close Program" function if a complete reset is required
4. Re-initialize with correct parameters after identifying and fixing the issue

## Security Considerations

1. **Wallet Security**: Store the admin wallet securely, preferably in hardware wallets
2. **Monitoring**: Set up monitoring for unusual transaction patterns
3. **Backup**: Regularly backup all program keypairs, PDAs, and configuration
4. **Access Control**: Restrict admin dashboard access to authorized personnel only

## Contact Information

For deployment support, contact:
- Technical Support: [tech-support@example.com](mailto:tech-support@example.com)
- Emergency Support: [emergency@example.com](mailto:emergency@example.com)