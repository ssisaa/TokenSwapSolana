#!/bin/bash

set -e

# Program keypair - you should generate this with 'solana-keygen new'
KEYPAIR_PATH="./program/keys/multihub-swap-v3-keypair.json"
PROGRAM_ID_PATH="./program/src/lib.rs"

# Generate a new keypair if it doesn't exist
if [ ! -f "$KEYPAIR_PATH" ]; then
  echo "Generating new program keypair at $KEYPAIR_PATH..."
  mkdir -p $(dirname "$KEYPAIR_PATH")
  solana-keygen new --no-bip39-passphrase -o "$KEYPAIR_PATH"
fi

# Get the program ID from the keypair
PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR_PATH")
echo "Program ID: $PROGRAM_ID"

# Update the program ID in the Rust code
echo "Updating program ID in source code..."
sed -i "s/solana_program::declare_id!(\"[^\"]*\")/solana_program::declare_id!(\"$PROGRAM_ID\")/g" "$PROGRAM_ID_PATH"

# Build the program
echo "Building program..."
cargo build-bpf --manifest-path=./program/Cargo.toml

# Deploy the program
echo "Deploying program..."
solana program deploy --program-id "$KEYPAIR_PATH" ./program/target/deploy/multihub_swap.so

echo "Deployment complete!"
echo "Program ID: $PROGRAM_ID"