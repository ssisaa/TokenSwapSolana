#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Starting Multi-Hub Swap V3 Deployment Process${NC}"
echo -e "${YELLOW}=============================================${NC}"

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error: Solana CLI is not installed${NC}"
    echo "Please install the Solana CLI tool before continuing"
    exit 1
fi

# Program keypair
KEYPAIR_PATH="./program/keys/multihub-swap-v3-keypair.json"
PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR_PATH")

echo -e "${GREEN}Using program keypair:${NC} $KEYPAIR_PATH"
echo -e "${GREEN}Program ID:${NC} $PROGRAM_ID"

# Verify we have enough SOL for deployment
BALANCE=$(solana balance)
echo -e "${GREEN}Current wallet balance:${NC} $BALANCE"

# Build the program
echo -e "\n${YELLOW}Building Solana program...${NC}"
cargo build-bpf --manifest-path=./program/Cargo.toml || {
    echo -e "${RED}Build failed${NC}"
    exit 1
}

echo -e "${GREEN}Build successful!${NC}"

# Deploy the program
echo -e "\n${YELLOW}Deploying program to Solana...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"

solana program deploy \
  --program-id "$KEYPAIR_PATH" \
  ./program/target/deploy/multihub_swap.so || {
    echo -e "${RED}Deployment failed${NC}"
    exit 1
}

echo -e "\n${GREEN}Program deployed successfully!${NC}"
echo -e "${GREEN}Program ID:${NC} $PROGRAM_ID"

echo -e "\n${YELLOW}Updating client code with new program ID...${NC}"

# Create a new multihub-contract-v3.ts file with the new program ID
cat > client/src/lib/multihub-contract-v3.ts << EOF
/**
 * MultihubSwap V3 Contract
 * 
 * This is an upgraded version of the multihub swap contract with improved
 * token account validation and error handling.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { BorshCoder } from '@project-serum/anchor';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// Program ID for the multihub swap V3 contract
export const MULTIHUB_SWAP_PROGRAM_ID = '$PROGRAM_ID';

// Token addresses (same as original contract)
export const YOT_TOKEN_MINT = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_MINT = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Constants for the program
export const LP_CONTRIBUTION_RATE = 2000; // 20%
export const ADMIN_FEE_RATE = 10; // 0.1%
export const YOS_CASHBACK_RATE = 300; // 3%  
export const SWAP_FEE_RATE = 30; // 0.3%
export const REFERRAL_RATE = 50; // 0.5%

/**
 * Find the program's authority PDA
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find the program's state PDA
 */
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Initialize the multihub swap program
 */
export async function initializeProgram(
  connection: Connection,
  wallet: any
): Promise<string> {
  const transaction = new Transaction();
  
  // Get program state address
  const [programStateAddress, _] = findProgramStateAddress();
  const [programAuthorityAddress, __] = findProgramAuthorityAddress();
  
  // Create the initialize instruction
  const borshCoder = new BorshCoder({});
  const initializeData = borshCoder.instruction.encode(
    'initialize',
    {
      admin: wallet.publicKey,
      yot_mint: new PublicKey(YOT_TOKEN_MINT),
      yos_mint: new PublicKey(YOS_TOKEN_MINT),
      lp_contribution_rate: LP_CONTRIBUTION_RATE,
      admin_fee_rate: ADMIN_FEE_RATE,
      yos_cashback_rate: YOS_CASHBACK_RATE,
      swap_fee_rate: SWAP_FEE_RATE,
      referral_rate: REFERRAL_RATE
    }
  );
  
  // Add the initialize instruction to the transaction
  transaction.add({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
    ],
    programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
    data: Buffer.from(initializeData)
  });
  
  // Send the transaction
  const signature = await wallet.sendTransaction(transaction, connection);
  console.log('Program initialization transaction sent:', signature);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  return signature;
}

/**
 * Ensure a token account exists, or create it if it doesn't
 */
async function ensureTokenAccount(
  connection: Connection,
  wallet: any,
  mint: PublicKey,
  transaction: Transaction
): Promise<PublicKey> {
  // Get the associated token address for the wallet
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey
  );
  
  // Check if the account exists
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  
  // If account doesn't exist, create it
  if (!accountInfo) {
    console.log('Creating token account for mint:', mint.toString());
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      tokenAccount,
      wallet.publicKey,
      mint
    );
    transaction.add(createAtaIx);
  }
  
  return tokenAccount;
}

/**
 * Perform a token swap using the multihub swap V3 program
 */
export async function performSwap(
  connection: Connection,
  wallet: any,
  tokenFromMint: PublicKey,
  tokenToMint: PublicKey,
  amountIn: number,
  minAmountOut: number
): Promise<string> {
  // Create a new transaction
  const transaction = new Transaction();
  
  // Ensure token accounts exist
  const tokenFromAccount = await ensureTokenAccount(
    connection, 
    wallet, 
    tokenFromMint, 
    transaction
  );
  
  const tokenToAccount = await ensureTokenAccount(
    connection, 
    wallet, 
    tokenToMint, 
    transaction
  );
  
  // Ensure YOS token account exists
  const yosTokenAccount = await ensureTokenAccount(
    connection,
    wallet,
    new PublicKey(YOS_TOKEN_MINT),
    transaction
  );
  
  // Get program addresses
  const [programStateAddress, _] = findProgramStateAddress();
  const [programAuthorityAddress, __] = findProgramAuthorityAddress();
  
  // Create the swap instruction
  const borshCoder = new BorshCoder({});
  const swapData = borshCoder.instruction.encode(
    'swap',
    {
      amount_in: amountIn,
      min_amount_out: minAmountOut
    }
  );
  
  // Add the swap instruction to the transaction
  transaction.add({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
      { pubkey: tokenFromAccount, isSigner: false, isWritable: true },
      { pubkey: tokenToAccount, isSigner: false, isWritable: true },
      { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
      { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }
    ],
    programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
    data: Buffer.from(swapData)
  });
  
  // Send the transaction
  console.log('Sending swap transaction...');
  const signature = await wallet.sendTransaction(transaction, connection);
  console.log('Swap transaction sent:', signature);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  return signature;
}

export default {
  MULTIHUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_MINT,
  YOS_TOKEN_MINT,
  findProgramAuthorityAddress,
  findProgramStateAddress,
  initializeProgram,
  performSwap
};
EOF

echo -e "${GREEN}Created client/src/lib/multihub-contract-v3.ts${NC}"

# Update the integration layer to use V3
cat > client/src/lib/multihub-integration-v3.ts << EOF
/**
 * Multi-Hub Integration Module (V3)
 * This module integrates the V3 version of the Multi-Hub Swap contract.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import MultihubSwapV3 from './multihub-contract-v3';
import { TokenInfo } from './token-search-api';
import { SwapEstimate, SwapProvider } from './multi-hub-swap';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// Constants for the different program versions
export const PROGRAM_ID_V3 = MultihubSwapV3.MULTIHUB_SWAP_PROGRAM_ID;

// Token constants
export const YOT_TOKEN_MINT = new PublicKey(MultihubSwapV3.YOT_TOKEN_MINT);
export const YOS_TOKEN_MINT = new PublicKey(MultihubSwapV3.YOS_TOKEN_MINT);
export const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Prepare for a swap by ensuring all necessary token accounts exist
 */
export async function prepareForSwap(
  connection: Connection,
  wallet: any,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey
) {
  console.log('Preparing for swap transaction with V3');
  
  // Create a new transaction
  const transaction = new Transaction();
  
  // Ensure all token accounts exist
  const tokenAccounts = new Map<string, PublicKey>();
  
  // Input token
  const inputTokenAccount = await getAssociatedTokenAddress(
    inputTokenMint,
    wallet.publicKey
  );
  const inputAccountInfo = await connection.getAccountInfo(inputTokenAccount);
  if (!inputAccountInfo) {
    console.log('Creating input token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      inputTokenAccount,
      wallet.publicKey,
      inputTokenMint
    );
    transaction.add(createAtaIx);
  }
  tokenAccounts.set(inputTokenMint.toString(), inputTokenAccount);
  
  // Output token
  const outputTokenAccount = await getAssociatedTokenAddress(
    outputTokenMint,
    wallet.publicKey
  );
  const outputAccountInfo = await connection.getAccountInfo(outputTokenAccount);
  if (!outputAccountInfo) {
    console.log('Creating output token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      outputTokenAccount,
      wallet.publicKey,
      outputTokenMint
    );
    transaction.add(createAtaIx);
  }
  tokenAccounts.set(outputTokenMint.toString(), outputTokenAccount);
  
  // YOS token
  const yosTokenAccount = await getAssociatedTokenAddress(
    YOS_TOKEN_MINT,
    wallet.publicKey
  );
  const yosAccountInfo = await connection.getAccountInfo(yosTokenAccount);
  if (!yosAccountInfo) {
    console.log('Creating YOS token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      yosTokenAccount,
      wallet.publicKey,
      YOS_TOKEN_MINT
    );
    transaction.add(createAtaIx);
  }
  tokenAccounts.set(YOS_TOKEN_MINT.toString(), yosTokenAccount);
  
  return {
    transaction,
    tokenAccounts,
    yosTokenAccount,
    needsSetup: transaction.instructions.length > 0
  };
}

/**
 * Perform a token swap using the multi-hub approach with V3
 */
export async function performMultiHubSwap(
  wallet: any,
  tokenFrom: TokenInfo,
  tokenTo: TokenInfo,
  amountIn: number,
  swapEstimate: SwapEstimate,
  provider: string = 'multihub'
): Promise<string> {
  console.log(`Preparing Multi-Hub Swap V3: ${tokenFrom.symbol} → ${tokenTo.symbol}`);
  console.log(`Amount: ${amountIn}, Estimated output: ${swapEstimate.outAmount}`);
  
  const connection = new Connection(DEVNET_ENDPOINT);
  
  // Convert token info to PublicKey objects
  const inputMint = new PublicKey(tokenFrom.address);
  const outputMint = new PublicKey(tokenTo.address);
  
  // Prepare all necessary token accounts
  const setupResult = await prepareForSwap(
    connection,
    wallet,
    inputMint,
    outputMint
  );
  
  // If accounts need to be created first, do that in a separate transaction
  if (setupResult.needsSetup) {
    console.log('Creating missing token accounts first...');
    const setupSignature = await wallet.sendTransaction(setupResult.transaction, connection);
    console.log('Token account setup transaction sent:', setupSignature);
    
    // Wait for confirmation
    await connection.confirmTransaction(setupSignature, 'confirmed');
    console.log('Token account setup confirmed');
  }
  
  // Now perform the actual swap
  return MultihubSwapV3.performSwap(
    connection,
    wallet,
    inputMint,
    outputMint,
    amountIn,
    Math.floor(swapEstimate.outAmount * 0.99) // Allow 1% slippage
  );
}

/**
 * Export a clean API for the integration
 */
export const MultihubIntegrationV3 = {
  PROGRAM_ID_V3,
  YOT_TOKEN_MINT: YOT_TOKEN_MINT.toString(),
  YOS_TOKEN_MINT: YOS_TOKEN_MINT.toString(),
  performMultiHubSwap,
  prepareForSwap
};

export default MultihubIntegrationV3;
EOF

echo -e "${GREEN}Created client/src/lib/multihub-integration-v3.ts${NC}"

echo -e "\n${GREEN}Deployment and client code update completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Initialize the program with: solana-keygen pubkey $KEYPAIR_PATH"
echo "2. Update your frontend to use the new V3 integration"
echo "3. Test a swap transaction with the new program"