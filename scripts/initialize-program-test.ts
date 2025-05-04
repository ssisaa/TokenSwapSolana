/**
 * MultihubSwap V4 Program Initialization Test
 * 
 * This script tests initializing the MultihubSwap V4 program with manual buffer serialization.
 * It confirms that the program can be properly initialized with our new buffer-based serialization approach.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Configuration
const MULTIHUB_PROGRAM_ID = new PublicKey('Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L'); // Will be replaced by deployment script
const YOT_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');

// Constants (in basis points)
const LP_CONTRIBUTION_RATE = 2000n; // 20%
const ADMIN_FEE_RATE = 10n;         // 0.1%
const YOS_CASHBACK_RATE = 300n;     // 3%
const SWAP_FEE_RATE = 30n;          // 0.3%
const REFERRAL_RATE = 50n;          // 0.5%

// Find the program state PDA
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTIHUB_PROGRAM_ID
  );
}

// Find the program authority PDA
function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTIHUB_PROGRAM_ID
  );
}

// Build the initialize instruction buffer manually
function buildInitializeInstruction({
  admin,
  yotMint,
  yosMint,
  lpContributionRate,
  adminFeeRate,
  yosCashbackRate,
  swapFeeRate,
  referralRate
}: {
  admin: PublicKey;
  yotMint: PublicKey;
  yosMint: PublicKey;
  lpContributionRate: bigint;
  adminFeeRate: bigint;
  yosCashbackRate: bigint;
  swapFeeRate: bigint;
  referralRate: bigint;
}): Buffer {
  // Instruction variant discriminator: 0 = Initialize
  const discriminator = Buffer.from([0]);
  
  // Calculate total buffer size: 1 (discriminator) + 32*3 (pubkeys) + 8*5 (u64 rates)
  const buffer = Buffer.alloc(1 + 32*3 + 8*5);
  
  // Fill the buffer
  let offset = 0;
  
  // Write discriminator
  discriminator.copy(buffer, offset);
  offset += 1;
  
  // Write admin public key
  admin.toBuffer().copy(buffer, offset);
  offset += 32;
  
  // Write YOT mint public key
  yotMint.toBuffer().copy(buffer, offset);
  offset += 32;
  
  // Write YOS mint public key
  yosMint.toBuffer().copy(buffer, offset);
  offset += 32;
  
  // Write rates in little-endian format
  buffer.writeBigUInt64LE(lpContributionRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(adminFeeRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(yosCashbackRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(swapFeeRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(referralRate, offset);
  
  return buffer;
}

// Main function to initialize the program
async function initializeProgram() {
  try {
    console.log('Starting MultihubSwap V4 initialization test...');

    // Load the payer's keypair
    let payer: Keypair;
    try {
      // First try to use a keypair file if it exists
      const HOME = process.env.HOME || '';
      const keypairPath = path.join(HOME, '.config/solana/id.json');
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (err) {
      // If no keypair file, generate a new one
      console.log('No keypair found, generating a new one');
      payer = Keypair.generate();
    }

    console.log('Using payer address:', payer.publicKey.toBase58());

    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Check the payer's balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      console.log('Requesting airdrop for the payer...');
      const signature = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`Airdrop confirmed! New balance: ${(await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL} SOL`);
    }

    // Derive the program state and authority PDAs
    const [programState, programStateBump] = findProgramStateAddress();
    const [programAuthority, programAuthorityBump] = findProgramAuthorityAddress();

    console.log('Program ID:', MULTIHUB_PROGRAM_ID.toBase58());
    console.log('Program State PDA:', programState.toBase58());
    console.log('Program Authority PDA:', programAuthority.toBase58());

    // Build the initialize instruction data
    const initData = buildInitializeInstruction({
      admin: ADMIN_WALLET,
      yotMint: YOT_MINT,
      yosMint: YOS_MINT,
      lpContributionRate: LP_CONTRIBUTION_RATE,
      adminFeeRate: ADMIN_FEE_RATE,
      yosCashbackRate: YOS_CASHBACK_RATE,
      swapFeeRate: SWAP_FEE_RATE,
      referralRate: REFERRAL_RATE
    });

    console.log(`Initialize instruction data created (${initData.length} bytes)`);
    console.log('First byte (discriminator):', initData[0]);

    // Create a new transaction with the initialization instruction
    const transaction = new Transaction().add({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: programState, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: MULTIHUB_PROGRAM_ID,
      data: initData,
    });

    console.log('Transaction created, simulating...');
    
    // Simulate the transaction first
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      console.error('Simulation failed:', simulation.value.err);
      console.log('Logs:', simulation.value.logs);
      throw new Error('Transaction simulation failed');
    } else {
      console.log('Simulation successful!');
      console.log('Logs:', simulation.value.logs);
    }
    
    console.log('Sending transaction...');
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log('Transaction confirmed!');
    console.log('Signature:', signature);
    console.log('MultihubSwap V4 program initialized successfully!');
    
    return {
      success: true,
      signature,
      programState: programState.toBase58(),
    };
  } catch (error) {
    console.error('Error initializing MultihubSwap V4 program:', error);
    return {
      success: false,
      error,
    };
  }
}

// If directly executed
if (require.main === module) {
  initializeProgram().then((result) => {
    console.log('Initialization result:', result);
    process.exit(result.success ? 0 : 1);
  });
}

export { initializeProgram, buildInitializeInstruction };