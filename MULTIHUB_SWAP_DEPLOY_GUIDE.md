# MultiHub Swap Contract Deployment Guide

This guide outlines the steps to build and deploy the fixed MultiHub Swap contract to Solana devnet.

## Prerequisites

1. Solana CLI tools (v1.17.0+)
2. Rust and Cargo installed
3. The Solana BPF toolchain
4. A funded Solana devnet wallet for deployment 
5. Access to the program keypair file (`multihub-keypair.json`)

## Build Process

### 1. Ensure Required Tools Are Installed

```bash
# Check Solana CLI version
solana --version

# Make sure Rust is installed
rustc --version
cargo --version

# Install Solana BPF toolchain if not already installed
sh -c "$(curl -sSfL https://release.solana.com/v1.16.14/install)"
cargo install --git https://github.com/solana-labs/rbpf cargo-build-sbf
rustup component add rust-src
```

### 2. Configure Solana CLI for Devnet

```bash
# Configure Solana CLI to use devnet
solana config set --url https://api.devnet.solana.com

# Ensure your wallet is funded (required for deployment)
solana balance
```

### 3. Build the Contract

```bash
# Navigate to the program directory
cd program

# Build the program
cargo build-sbf
```

This will create a compiled `.so` file in the `target/deploy` directory.

## Deployment Process

### 1. Deploy the Contract to Devnet

```bash
# Deploy using the program keypair
solana program deploy \
  --program-id multihub-keypair.json \
  target/deploy/multihub_swap.so
```

Alternatively, if you want to deploy the fixed version:

```bash
solana program deploy \
  --program-id multihub-keypair.json \
  target/deploy/multihub_swap_fixed_new.so
```

### 2. Verify Deployment

```bash
# Get program account info to confirm successful deployment
solana program show \
  --programs \
  3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps
```

### 3. Initialize the Program

After deploying the contract, you need to initialize it using the client application. Navigate to the Transaction Debug page in the web application and click "Initialize MultiHub Swap."

## Important Notes

1. The program ID must match `3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps` for compatibility with the client application.
2. Ensure the `multihub-keypair.json` file is used to maintain the same program ID.
3. Store your deployment wallet securely as it has authority over program upgrades.

## Troubleshooting

### Common Deployment Issues

1. **Insufficient Funds**: Ensure your wallet has enough SOL for deployment (approximately 5 SOL).
   ```bash
   solana airdrop 2 # Request devnet SOL
   ```

2. **Program Size Limit**: If the program exceeds Solana's size limit (≈400kb), you may need to optimize the code.

3. **RPC Node Connection Issues**: Try switching to a different RPC endpoint if deployment fails:
   ```bash
   solana config set --url https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY
   ```

### Verifying Contract Functionality

After deployment, test the functionality through the web interface:
1. Connect your wallet to the application
2. Navigate to the CashbackSwap page
3. Perform a test swap with a small amount
4. Verify in Solana Explorer that the transaction succeeded

## Upgrade Process

To upgrade the existing program:

```bash
solana program deploy \
  --program-id multihub-keypair.json \
  target/deploy/multihub_swap_fixed_new.so \
  --upgrade
```

## Security Considerations

1. Never share your deployment keypair (`multihub-keypair.json`).
2. Use program authority PDAs for privileged operations within the contract.
3. Maintain proper access controls for admin functions.