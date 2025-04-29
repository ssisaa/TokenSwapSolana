#!/bin/bash

# Exit on error
set -e

echo "Building Solana program..."
cargo build

echo "Converting to BPF..."
cargo build --target bpfel-unknown-unknown --release

echo "Preparing deployment..."
mkdir -p target/deploy
cp target/bpfel-unknown-unknown/release/stake.so target/deploy/

echo "Deploying to Solana devnet..."
solana program deploy --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 target/deploy/stake.so

echo "Deployment completed successfully."