#!/bin/bash
set -e

echo "Building simplified swap program..."

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
  echo "Error: cargo is not installed or not in PATH"
  exit 1
fi

# Create build directory if it doesn't exist
mkdir -p program/simplified_swap_program/target/simplified/deploy

# Navigate to the program directory
cd program/simplified_swap_program

# Build the program using cargo build-bpf
echo "Running cargo build-bpf..."
cargo build-bpf --target bpfel-unknown-unknown --release

# Copy the built program to the deploy directory
echo "Copying program binary to deploy directory..."
cp target/deploy/simplified_swap_program.so target/simplified/deploy/

echo "Build completed successfully!"
echo "Program binary is available at: program/simplified_swap_program/target/simplified/deploy/simplified_swap_program.so"