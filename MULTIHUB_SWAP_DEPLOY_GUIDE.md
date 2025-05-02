# MultiHub Swap Deployment Guide

This guide provides detailed instructions for deploying the fixed MultiHub Swap program to Solana devnet.

## Prerequisites

1. Solana CLI tools installed (v1.17.x or newer recommended)
2. Rust and Cargo installed
3. The Solana BPF toolchain (`cargo-build-sbf`)
4. A funded devnet wallet with enough SOL for deployment
5. The program keypair file (`multihub-keypair.json`)

## Step 1: Prepare the Environment

Ensure your system is configured for Solana development:

```bash
# Install Solana CLI if needed
sh -c "$(curl -sSfL https://release.solana.com/v1.17.31/install)"

# Update your PATH (add to your .bashrc or .zshrc for persistence)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install the BPF toolchain if needed
cargo install --git https://github.com/solana-labs/rbpf cargo-build-sbf

# Configure for devnet
solana config set --url https://api.devnet.solana.com

# Check your configuration
solana config get

# Check your wallet balance
solana balance
```

## Step 2: Build the Program

Build both the original and fixed implementation of the MultiHub Swap program:

```bash
# Navigate to the program directory
cd program

# Build the original program
cargo build-sbf

# Build the fixed implementation
cargo build-sbf --bin multihub_swap_fixed_new
```

## Step 3: Deploy the Program

Use the provided deployment script to automate the process:

```bash
# Make the deployment script executable
chmod +x deploy_multihub_swap.sh

# Run the deployment script
./deploy_multihub_swap.sh
```

The script will:
1. Verify you have the correct keypair file
2. Build both implementations
3. Let you choose which one to deploy
4. Deploy the selected implementation to the MultiHub Swap program ID
5. Verify the deployment was successful

## Step 4: Initialize the Program (if needed)

If this is a fresh deployment (not an upgrade), you'll need to initialize the program:

1. Navigate to the web interface
2. Connect your admin wallet (must match the admin wallet used during development)
3. Go to the Admin tab
4. Click "Initialize MultiHub Swap Program"
5. Provide the following parameters:
   - YOT Mint: `2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF`
   - YOS Mint: `GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n`
   - Liquidity Contribution: 20 (%)
   - Admin Fee: 0.1 (%)
   - YOS Cashback: 5 (%)

## Step 5: Verify the Deployment

Test the deployment by:

1. Connect a wallet that has never received YOS tokens
2. Attempt a swap on the CashbackSwap page
3. The transaction should succeed on the first attempt
4. Check that a new YOS token account was created for the user
5. Verify that YOS cashback was received

## Troubleshooting

If deployment fails:

1. Check that your wallet has enough SOL
2. Verify the program ID in the keypair file matches the expected ID
3. Ensure you have the correct permissions for the program deployment
4. Check for any error messages in the transaction logs

## Important Notes

- The program ID for the MultiHub Swap is: `3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps`
- The updated implementation handles YOS token account validation correctly
- All percentage values in the program are stored as integers:
  - 20% = 20
  - 5% = 5
  - 0.1% = 1 (scaled by 10)

## Next Steps

After deployment:

1. Monitor initial user interactions to confirm the fix works as expected
2. Update any client code to use the improved implementation
3. Consider future improvements as outlined in the MULTIHUB_SWAP_FIX_README.md