#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${GREEN}Multi-Hub Swap Program Deployment Script (V2)${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Set Solana network to devnet
echo -e "${YELLOW}Setting Solana network to devnet...${NC}"
solana config set --url devnet

# Configuration
PROGRAM_ID="J66SY1YNFyXt6jat8Ek8uAUshxBY2mLrubsMRN4wggt3"
KEYPAIR_PATH="program/keys/multihub-swap-v2-keypair.json"
PROGRAM_DIR="program"
BUILD_DIR="$PROGRAM_DIR/target/deploy"

# Verify keypair exists
if [ ! -f "$KEYPAIR_PATH" ]; then
    echo -e "${RED}Error: Keypair file not found at $KEYPAIR_PATH${NC}"
    exit 1
fi

# Build the program
echo -e "${YELLOW}Building the Solana program...${NC}"
cd "$PROGRAM_DIR" || exit
cargo build-bpf
cd ..

# Verify the built program exists
if [ ! -f "$BUILD_DIR/multihub_swap.so" ]; then
    echo -e "${RED}Error: Program binary not found at $BUILD_DIR/multihub_swap.so${NC}"
    exit 1
fi

# Deploy the program
echo -e "${YELLOW}Deploying program with ID: $PROGRAM_ID${NC}"
solana program deploy --program-id "$PROGRAM_ID" --keypair "$KEYPAIR_PATH" "$BUILD_DIR/multihub_swap.so"

# Check deployment status
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment successful!${NC}"
    echo -e "${YELLOW}New Program ID: $PROGRAM_ID${NC}"
    echo -e "${BLUE}=======================================================${NC}"
    echo -e "${YELLOW}IMPORTANT: Update client-side code to use the new Program ID${NC}"
    echo -e "${BLUE}=======================================================${NC}"
else
    echo -e "${RED}Deployment failed. Please check the error messages above.${NC}"
fi