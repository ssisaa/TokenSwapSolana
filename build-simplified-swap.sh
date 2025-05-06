#!/bin/bash
set -e

# Build and deploy the simplified swap program
echo "Building simplified swap program..."

# Change to program directory
cd program/simplified_swap_program

# Build the program using cargo-build-bpf
cargo build-bpf --target-directory=target/simplified 

# Output program binary path for deployment
echo "Program built successfully. Deploy using:"
echo "solana program deploy target/simplified/deploy/simplified_swap_program.so"

# Return to original directory
cd ../..

echo "Build process completed."