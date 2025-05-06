#!/bin/bash
set -e

echo "Deploying simplified swap program to Solana Devnet..."

# Check if solana is available
if ! command -v solana &> /dev/null; then
  echo "Error: Solana CLI is not installed or not in PATH"
  exit 1
fi

# Build the program first
./build-simplified-swap.sh

# Generate a new keypair for the program if it doesn't exist
PROGRAM_KEYPAIR="program-simplified-swap-keypair.json"
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
  echo "Generating new program keypair..."
  solana-keygen new --no-bip39-passphrase -o "$PROGRAM_KEYPAIR"
fi

# Get program ID
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "Program ID: $PROGRAM_ID"

# Update program ID in relevant files
echo "Updating program ID in configuration files..."

# Update in client/src/lib/configConstants.ts
sed -i "s/export const SIMPLIFIED_SWAP_PROGRAM_ID = .*;/export const SIMPLIFIED_SWAP_PROGRAM_ID = '$PROGRAM_ID';/" client/src/lib/configConstants.ts

# Update in test-simplified-swap.cjs
sed -i "s/const SIMPLIFIED_SWAP_PROGRAM_ID = .*;/const SIMPLIFIED_SWAP_PROGRAM_ID = '$PROGRAM_ID';/" test-simplified-swap.cjs

# Deploy the program to Solana Devnet
echo "Deploying program to Devnet..."
PROGRAM_PATH="program/simplified_swap_program/target/simplified/deploy/simplified_swap_program.so"
solana program deploy --url devnet -v "$PROGRAM_PATH" --program-id "$PROGRAM_KEYPAIR"

echo "Deployment completed successfully!"
echo "Program ID: $PROGRAM_ID"
echo "You can now initialize the program state using the test-simplified-swap-init.cjs script."