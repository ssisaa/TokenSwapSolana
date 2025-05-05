#!/bin/bash
# MultihubSwap V4 deployment script
# This script builds and deploys the updated MultihubSwap V4 program
# with manual instruction parsing to fix the BorshIoError issues

set -e # Exit on error

echo "Starting MultihubSwap V4 build and deployment process..."

# Check if program ID keypair exists, create it if it doesn't
if [ ! -f "multihub-keypair.json" ]; then
  echo "Generating new program keypair..."
  solana-keygen new --no-passphrase -o multihub-keypair.json
  PROGRAM_ID=$(solana-keygen pubkey multihub-keypair.json)
  echo "New program ID: $PROGRAM_ID"
else
  PROGRAM_ID=$(solana-keygen pubkey multihub-keypair.json)
  echo "Using existing program ID: $PROGRAM_ID"
fi

# Update the program ID in the code
echo "Updating program ID in source files..."
sed -i "s/solana_program::declare_id!(\"[^\"]*\")/solana_program::declare_id!(\"$PROGRAM_ID\")/" program/src/multihub_swap_v4.rs

# Create a dedicated Cargo.toml for MultihubSwap
echo "Creating dedicated MultihubSwap Cargo.toml for building..."
cat > program/Cargo.toml.multihub << EOL
[package]
name = "multihub_swap"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "1.14.6"
borsh = "0.9.3"
spl-token = {version = "3.5.0", features = ["no-entrypoint"]}
spl-associated-token-account = {version = "1.1.1", features = ["no-entrypoint"]}

[lib]
name = "multihub_swap"
crate-type = ["cdylib", "lib"]
path = "src/multihub_lib.rs"
EOL

# Copy the custom Cargo.toml for building
echo "Using dedicated MultihubSwap Cargo configuration..."
cp program/Cargo.toml program/Cargo.toml.original
cp program/Cargo.toml.multihub program/Cargo.toml

# Build the program
echo "Building the MultihubSwap V4 program..."
cd program
cargo build-bpf
cd ..

# Restore the original Cargo.toml to not affect the staking program
echo "Restoring original Cargo configuration..."
mv program/Cargo.toml.original program/Cargo.toml

# Deploy the program
echo "Deploying the program to Solana devnet..."
solana program deploy \
  --keypair multihub-keypair.json \
  --url https://api.devnet.solana.com \
  program/target/deploy/multihub_swap.so

# Update the program ID in the frontend code
echo "Updating program ID in frontend code..."
sed -i "s/export const MULTIHUB_SWAP_PROGRAM_ID = '[^']*'/export const MULTIHUB_SWAP_PROGRAM_ID = '$PROGRAM_ID'/" client/src/lib/multihub-contract-v3.ts

echo "======================================================"
echo "MultihubSwap V4 deployed successfully!"
echo "Program ID: $PROGRAM_ID"
echo "======================================================"
echo ""
echo "Important notes:"
echo "1. The MultihubSwap V4 is now deployed as a separate program"
echo "2. It uses manual byte parsing instead of Borsh deserialization"
echo "3. This should resolve all BorshIoError: Unknown issues"
echo "4. The original staking program remains unaffected"
echo ""
echo "To initialize the program, use the MultihubSwap Admin page"