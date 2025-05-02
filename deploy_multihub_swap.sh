#!/bin/bash
# Script to build and deploy the MultiHub Swap program to Solana devnet

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MultiHub Swap Contract Deployment ===${NC}"

# Check for prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v solana &> /dev/null; then
  echo -e "${RED}Error: Solana CLI is not installed${NC}"
  echo "Please install Solana CLI first:"
  echo "sh -c \"\$(curl -sSfL https://release.solana.com/v1.17.31/install)\""
  exit 1
fi

if ! command -v cargo &> /dev/null; then
  echo -e "${RED}Error: Cargo not found${NC}"
  echo "Please install Rust and Cargo first:"
  echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

if ! command -v cargo-build-sbf &> /dev/null; then
  echo -e "${RED}Error: cargo-build-sbf not found${NC}"
  echo "Please install the Solana BPF toolchain:"
  echo "cargo install --git https://github.com/solana-labs/rbpf cargo-build-sbf"
  exit 1
fi

# Configure for devnet
echo -e "${BLUE}Configuring Solana CLI for devnet...${NC}"
solana config set --url https://api.devnet.solana.com

# Check balance
echo -e "${BLUE}Checking wallet balance...${NC}"
BALANCE=$(solana balance)
echo "Current balance: $BALANCE"

# Check for keypair file
if [ ! -f "multihub-keypair.json" ]; then
  echo -e "${RED}Error: multihub-keypair.json not found in current directory${NC}"
  exit 1
fi

# Verify program ID matches expected value
KEYPAIR_FILE="multihub-keypair.json"
EXPECTED_ID="3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps"

echo -e "${BLUE}Using Program ID: ${EXPECTED_ID}${NC}"

# Check if the keypair file exists
if [ ! -f "$KEYPAIR_FILE" ]; then
  echo -e "${RED}Error: Keypair file ${KEYPAIR_FILE} not found${NC}"
  echo "Would you like to create a new keypair file? This is NOT recommended if you're updating an existing program."
  read -p "Create new keypair? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating new keypair file: ${KEYPAIR_FILE}"
    solana-keygen new -o "$KEYPAIR_FILE" --force
  else
    exit 1
  fi
fi

# Verify program ID matches expected value
PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR_FILE")

if [ "$PROGRAM_ID" != "$EXPECTED_ID" ]; then
  echo -e "${RED}Warning: Program ID from keypair doesn't match expected ID${NC}"
  echo "Expected: $EXPECTED_ID"
  echo "Found: $PROGRAM_ID"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Build the program
echo -e "${BLUE}Building the MultiHub Swap program...${NC}"
cd program
cargo build-sbf

echo -e "${BLUE}Building fixed implementation...${NC}"
cargo build-sbf --bin multihub_swap_fixed_new

# Deploy the program
echo -e "${BLUE}Deploying the fixed MultiHub Swap program...${NC}"

read -p "Do you want to deploy the fixed implementation? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}Deploying fixed implementation...${NC}"
  solana program deploy \
    --program-id ../$KEYPAIR_FILE \
    target/deploy/multihub_swap_fixed_new.so \
    --upgrade
else
  echo -e "${BLUE}Deploying standard implementation...${NC}"
  solana program deploy \
    --program-id ../$KEYPAIR_FILE \
    target/deploy/multihub_swap.so \
    --upgrade
fi

# Verify deployment
echo -e "${BLUE}Verifying deployment...${NC}"
solana program show --programs | grep "$EXPECTED_ID"

echo -e "${GREEN}Deployment complete!${NC}"
echo "Program ID: $EXPECTED_ID"
echo -e "${BLUE}Don't forget to initialize the program through the web interface.${NC}"