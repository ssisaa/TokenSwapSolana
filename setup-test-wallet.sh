#!/bin/bash

# Check if solana CLI is installed
command -v solana >/dev/null 2>&1 || { 
  echo >&2 "Solana CLI is required but not installed. Please install it first."; 
  echo "Visit: https://docs.solana.com/cli/install-solana-cli-tools";
  exit 1; 
}

# Check if test wallet already exists
if [ -f .keypair-test.json ]; then
  echo "Test wallet already exists at .keypair-test.json"
  PUBKEY=$(solana-keygen pubkey .keypair-test.json)
  echo "Public Key: $PUBKEY"
  
  # Check balance
  echo "Checking balance..."
  BALANCE=$(solana balance $PUBKEY --url https://api.devnet.solana.com)
  echo "Current balance: $BALANCE"
  
  # Ask if user wants to request airdrop
  read -p "Do you want to request a SOL airdrop? (y/n): " ANSWER
  if [ "$ANSWER" = "y" ] || [ "$ANSWER" = "Y" ]; then
    echo "Requesting airdrop of 1 SOL..."
    solana airdrop 1 $PUBKEY --url https://api.devnet.solana.com
    sleep 2
    echo "New balance:"
    solana balance $PUBKEY --url https://api.devnet.solana.com
  fi
else
  echo "Creating new test wallet..."
  solana-keygen new --outfile .keypair-test.json --no-bip39-passphrase
  PUBKEY=$(solana-keygen pubkey .keypair-test.json)
  echo "Wallet created with public key: $PUBKEY"
  
  # Request airdrop
  echo "Requesting initial airdrop of 2 SOL..."
  solana airdrop 2 $PUBKEY --url https://api.devnet.solana.com
  sleep 2
  echo "Balance after airdrop:"
  solana balance $PUBKEY --url https://api.devnet.solana.com
fi

echo ""
echo "Your test wallet is ready!"
echo "You can now run: node test-interactive-sol-yot-swap.js"