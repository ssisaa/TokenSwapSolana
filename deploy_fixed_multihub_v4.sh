#!/bin/bash

# Deploy multihub swap v4 with improved account validation
# This script deploys the enhanced multihub_swap_v4.rs contract with
# improved state account validation to prevent InvalidAccountData errors

set -e

# Prompt for confirmation
echo "This will deploy the FIXED multihub swap v4 contract to the Solana devnet"
echo "The fixed contract includes enhanced account validation to prevent state account errors"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Set paths
PROGRAM_DIR="program"
BUILD_DIR="deploy_files"
PROGRAM_FILE="$PROGRAM_DIR/src/multihub_swap_v4.rs"
KEYPAIR_FILE="program-keypair.json"

# Ensure build directory exists
mkdir -p $BUILD_DIR

echo "====== Building Multihub Swap V4 (Fixed) ======"

echo "Compiling program..."
cargo build-sbf --manifest-path $PROGRAM_DIR/Cargo.toml

echo "Copying compiled program..."
cp $PROGRAM_DIR/target/deploy/multihub_swap.so $BUILD_DIR/
cp $PROGRAM_DIR/target/deploy/multihub_swap-keypair.json $BUILD_DIR/

echo "Deploying program to Solana devnet..."
solana program deploy \
  --keypair $KEYPAIR_FILE \
  --url devnet \
  --program-id Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L \
  $BUILD_DIR/multihub_swap.so

echo "====== Deployment Complete ======"
echo "Program ID: Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L"
echo "Remember to initialize the program through the admin UI"
echo "✓ Successfully deployed fixed multihub swap v4 contract"