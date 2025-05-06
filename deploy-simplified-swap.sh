#!/bin/bash

# Deploy script for simplified swap Solana program
# This script builds and deploys the standalone simplified swap program to Solana devnet

set -e  # Exit on any error

# Program paths
SOURCE_DIR="./program/simplified_swap_program"
OUTPUT_DIR="./target/deploy"
PROGRAM_NAME="simplified_swap"

# Keypair for program deployment
PROGRAM_KEYPAIR="./program-keypair.json"

# Generate a new keypair if none exists
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "Generating new program keypair..."
    solana-keygen new -o "$PROGRAM_KEYPAIR" --no-passphrase --silent
    echo "New program keypair generated at $PROGRAM_KEYPAIR"
fi

# Build the program
echo "Building simplified swap program..."
cd "$SOURCE_DIR" && cargo build-bpf || { echo "Build failed"; exit 1; }

# Get program ID from keypair
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "Program ID: $PROGRAM_ID"

# Make sure output directory exists
mkdir -p "$OUTPUT_DIR"

# Deploy the program
echo "Deploying program to Solana devnet..."
solana program deploy \
    --keypair "$PROGRAM_KEYPAIR" \
    --program-id "$PROGRAM_KEYPAIR" \
    --url devnet \
    "$SOURCE_DIR/target/deploy/${PROGRAM_NAME}.so" || { echo "Deployment failed"; exit 1; }

echo "Program deployed successfully!"
echo "Program ID: $PROGRAM_ID"

# Update the program ID in test scripts
echo "Updating program ID in test scripts..."
sed -i.bak "s/const SIMPLIFIED_SWAP_PROGRAM_ID = '.*';/const SIMPLIFIED_SWAP_PROGRAM_ID = '$PROGRAM_ID';/g" test-simplified-swap.cjs
sed -i.bak "s/const SIMPLIFIED_SWAP_PROGRAM_ID = '.*';/const SIMPLIFIED_SWAP_PROGRAM_ID = '$PROGRAM_ID';/g" test-simplified-swap-init.cjs

echo "Test scripts updated with new program ID"
echo ""
echo "Next steps:"
echo "1. Run 'node test-simplified-swap-init.cjs' to initialize the program state"
echo "2. Run 'node test-simplified-swap.cjs' to test SOL to YOT swap"
echo ""
echo "Deployment complete!"