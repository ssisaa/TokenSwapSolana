#!/bin/bash
# Build and deploy script for Solana program

set -e # Exit on error

echo "Building Solana program..."

# Navigate to program directory
cd program

# Build the program with cargo-build-bpf
cargo build-bpf

# Get the path to the compiled program
PROGRAM_SO="./target/deploy/multi_hub_swap.so"

if [ ! -f "$PROGRAM_SO" ]; then
  echo "Error: Compiled program not found at $PROGRAM_SO"
  exit 1
fi

echo "Program built successfully!"

# Check if we have the program keypair
PROGRAM_KEYPAIR="../program-keypair.json"

if [ ! -f "$PROGRAM_KEYPAIR" ]; then
  echo "Error: Program keypair not found at $PROGRAM_KEYPAIR"
  echo "Cannot deploy without the program keypair"
  exit 1
fi

echo "Program keypair found. Proceeding with deployment..."

# Deploy the program to devnet
echo "Deploying to Solana devnet..."
solana program deploy \
  --keypair "$PROGRAM_KEYPAIR" \
  --url https://api.devnet.solana.com \
  --program-id $(solana-keygen pubkey "$PROGRAM_KEYPAIR") \
  "$PROGRAM_SO"

echo "Deployment completed successfully!"
echo "You can now test the program with the test-repair-program-state.js script"