#!/bin/bash
set -e

# Deploy the simplified swap program
echo "Deploying simplified swap program..."

# Check if .keypair-test.json exists
if [ ! -f ".keypair-test.json" ]; then
  echo "Error: .keypair-test.json not found. Please make sure you have a valid keypair file."
  exit 1
fi

# Build the program first
./build-simplified-swap.sh

# Deploy using solana program deploy
echo "Deploying to Solana devnet..."
PROGRAM_OUTPUT=$(solana program deploy --keypair .keypair-test.json program/simplified_swap_program/target/simplified/deploy/simplified_swap_program.so)

# Extract program ID from output
PROGRAM_ID=$(echo "$PROGRAM_OUTPUT" | grep "Program Id:" | awk '{print $3}')

if [ -n "$PROGRAM_ID" ]; then
  echo "Program deployed successfully!"
  echo "Program ID: $PROGRAM_ID"
  
  # Update the SIMPLIFIED_SWAP_PROGRAM_ID in the test script
  echo "Updating program ID in test script..."
  sed -i "s/const SIMPLIFIED_SWAP_PROGRAM_ID = '.*';/const SIMPLIFIED_SWAP_PROGRAM_ID = '$PROGRAM_ID';/" test-simplified-swap.cjs
  
  echo "You can now run the test script with:"
  echo "node test-simplified-swap.cjs"
else
  echo "Deployment failed. Please check the output above for errors."
  exit 1
fi