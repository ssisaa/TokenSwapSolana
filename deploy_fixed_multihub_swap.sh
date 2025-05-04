#!/bin/bash
# Script to build and deploy the updated MultihubSwap contract with fixed PDA handling

echo "Building and deploying the updated MultihubSwap contract..."

# Set variables
PROGRAM_KEYPAIR="multihub-keypair.json"  # Path to program keypair file
WALLET_KEYPAIR="id.json"                # Path to wallet keypair file
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR" 2>/dev/null || echo "KEY_NOT_FOUND")

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if keypair files exist
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
  echo -e "${RED}Error: Program keypair file $PROGRAM_KEYPAIR not found${NC}"
  echo "Do you want to create a new program keypair? (y/n)"
  read -r create_keypair
  if [[ "$create_keypair" == "y" ]]; then
    solana-keygen new -o "$PROGRAM_KEYPAIR" --force
    PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
    echo -e "${GREEN}Created new program keypair with ID: $PROGRAM_ID${NC}"
  else
    echo "Please provide a valid program keypair file and try again."
    exit 1
  fi
fi

if [ ! -f "$WALLET_KEYPAIR" ]; then
  echo -e "${RED}Error: Wallet keypair file $WALLET_KEYPAIR not found${NC}"
  echo "Please provide a valid wallet keypair file."
  exit 1
fi

# Print current configuration
echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "Program ID: $PROGRAM_ID"
echo "Program Keypair: $PROGRAM_KEYPAIR"
echo "Wallet Keypair: $WALLET_KEYPAIR"
echo

# Update lib.rs to use the fixed multihub_swap_v4.rs version
echo "Updating program entry point to use updated version..."
cat > program/src/lib.rs << EOL
use solana_program::entrypoint;
entrypoint!(multihub_swap_v4::process_instruction);

pub mod multihub_swap_v3;
pub mod multihub_swap_v4;
EOL
echo -e "${GREEN}Updated lib.rs to use multihub_swap_v4${NC}"

# Check if the Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error: Solana CLI is not installed or not in PATH${NC}"
    exit 1
fi

# Build the program
echo "Building the program..."
cd program || { echo -e "${RED}Error: Could not find program directory${NC}"; exit 1; }
cargo build-bpf || { echo -e "${RED}Error: Build failed${NC}"; exit 1; }
cd ..

echo -e "${GREEN}Build successful!${NC}"

# Deploy the program
echo "Deploying to Solana devnet..."
solana program deploy \
  --keypair "$WALLET_KEYPAIR" \
  --program-id "$PROGRAM_KEYPAIR" \
  --url devnet \
  program/target/deploy/multihub_swap.so

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Deployment successful!${NC}"
  echo -e "${YELLOW}Program ID: $PROGRAM_ID${NC}"
  echo -e "${YELLOW}Remember to update your client code to reference this Program ID.${NC}"
  
  # Create quick reference for client updates
  echo "// Update these in your client code" > program_id_reference.js
  echo "const MULTIHUB_SWAP_PROGRAM_ID = \"$PROGRAM_ID\";" >> program_id_reference.js
  echo -e "${GREEN}Created program_id_reference.js with the new Program ID${NC}"
else
  echo -e "${RED}Deployment failed.${NC}"
  exit 1
fi

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Initialize the program using the admin panel"
echo "2. Fund the program with YOT and YOS tokens"
echo "3. Test with a small amount first"

exit 0