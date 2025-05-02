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
export const MULTIHUB_SWAP_PROGRAM_ID = 'Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L';

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

/**
 * Close the program (admin only)
 */
export async function closeProgram(
  connection: Connection,
  wallet: any
): Promise<string> {
  // Create a new transaction
  const transaction = new Transaction();
  
  // Get program state address
  const [programStateAddress, _] = findProgramStateAddress();
  
  // Create the close program instruction
  const borshCoder = new BorshCoder({});
  const closeProgramData = borshCoder.instruction.encode(
    'close_program',
    {}
  );
  
  // Add the close program instruction to the transaction
  transaction.add({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true }
    ],
    programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
    data: Buffer.from(closeProgramData)
  });
  
  // Send the transaction
  const signature = await wallet.sendTransaction(transaction, connection);
  console.log('Program close transaction sent:', signature);
  
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
  performSwap,
  closeProgram
};