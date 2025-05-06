/**
 * Test script for the Simplified Swap Program
 * 
 * This is a completely separate Solana program designed for reliability and simplicity.
 * It focuses only on the SOL to YOT swap functionality with proper distribution rules.
 * 
 * Command to run: node test-simplified-swap.cjs
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const BN = require('bn.js');

// Constants - these would normally be imported from config
const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const SOL_POOL_WALLET = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const YOT_POOL_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// The program ID is unique to the deployed simplified swap program
// This will be replaced after actual deployment
const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu';

/**
 * Find the program state PDA
 * @param programId The program ID
 * @returns [pda, bump]
 */
function findProgramStatePda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

/**
 * Find the program authority PDA
 * @param programId The program ID
 * @returns [pda, bump]
 */
function findProgramAuthorityPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

/**
 * Create a buffer with instruction data for initialization
 */
function createInitializeInstructionData(
  solDistributionRatio = 80,  // 80% to pool, 20% to liquidity wallet
  yotDistributionRatio = 95,  // 95% to user, 5% as YOS cashback
  minSolAmount = 0.001 * LAMPORTS_PER_SOL  // Minimum 0.001 SOL for swap
) {
  const instruction = Buffer.alloc(11); // 1 (tag) + 1 + 1 + 8
  
  // Instruction tag (0 = Initialize)
  instruction.writeUInt8(0, 0);
  
  // Distribution ratios
  instruction.writeUInt8(solDistributionRatio, 1);
  instruction.writeUInt8(yotDistributionRatio, 2);
  
  // Min SOL amount as u64 (little-endian)
  const minAmount = new BN(minSolAmount);
  instruction.writeBigUInt64LE(BigInt(minAmount.toString()), 3);
  
  return instruction;
}

/**
 * Create a buffer with instruction data for swap
 */
function createSwapInstructionData(
  solAmount,  // Amount of SOL to swap (in lamports)
  minYotAmount  // Minimum YOT amount to receive (in tokens)
) {
  const instruction = Buffer.alloc(17); // 1 (tag) + 8 + 8
  
  // Instruction tag (1 = Swap)
  instruction.writeUInt8(1, 0);
  
  // SOL amount as u64 (little-endian)
  instruction.writeBigUInt64LE(BigInt(solAmount), 1);
  
  // Min YOT amount as u64 (little-endian)
  instruction.writeBigUInt64LE(BigInt(minYotAmount), 9);
  
  return instruction;
}

/**
 * Main test function
 */
async function main() {
  try {
    // Load the keypair from file
    const keypairBuffer = fs.readFileSync(path.join(__dirname, '.keypair-test.json'), 'utf8');
    const keypairData = JSON.parse(keypairBuffer);
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    // Create connection
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Check wallet balance
    const walletBalance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${walletBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Print important addresses
    console.log('Test addresses:');
    console.log(`Wallet address: ${wallet.publicKey.toString()}`);
    console.log(`YOT mint: ${YOT_MINT}`);
    console.log(`YOS mint: ${YOS_MINT}`);
    console.log(`SOL pool: ${SOL_POOL_WALLET}`);
    console.log(`YOT pool: ${YOT_POOL_TOKEN_ACCOUNT}`);
    console.log(`Common wallet: ${COMMON_WALLET_ADDRESS}`);
    
    // Get the program ID (placeholder for now)
    const programId = new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID);
    
    // Find PDAs
    const [programStatePda, _] = findProgramStatePda(programId);
    const [programAuthorityPda, __] = findProgramAuthorityPda(programId);
    console.log(`Program state PDA: ${programStatePda.toString()}`);
    console.log(`Program authority PDA: ${programAuthorityPda.toString()}`);
    
    // Get token accounts
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      wallet.publicKey
    );
    const userYosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_MINT),
      wallet.publicKey
    );
    console.log(`User YOT account: ${userYotAccount.toString()}`);
    console.log(`User YOS account: ${userYosAccount.toString()}`);
    
    // IMPORTANT: This is just a simulation since the program hasn't been deployed yet
    console.log('\nSimulating program initialization...');
    console.log('(The actual program needs to be deployed before this can be done for real)');
    
    // Prepare initialization parameters
    const solDistributionRatio = 80;  // 80% to pool, 20% to liquidity wallet
    const yotDistributionRatio = 95;  // 95% to user, 5% as YOS cashback
    const minSolAmount = 0.001 * LAMPORTS_PER_SOL;  // Minimum 0.001 SOL for swap
    
    // Create initialization instruction
    const initializeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStatePda, isSigner: false, isWritable: true },
        { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(YOT_MINT), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId,
      data: createInitializeInstructionData(solDistributionRatio, yotDistributionRatio, minSolAmount),
    });
    
    console.log('\nSimulating swap operation...');
    console.log('(The actual program needs to be deployed before this can be done for real)');
    
    // Prepare swap parameters
    const solAmount = 0.1 * LAMPORTS_PER_SOL;  // Swap 0.1 SOL
    const minYotAmount = 0.095 * solAmount;  // 5% slippage tolerance
    
    // Create swap instruction
    const swapInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStatePda, isSigner: false, isWritable: true },
        { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(SOL_POOL_WALLET), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOT_POOL_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: createSwapInstructionData(solAmount, minYotAmount),
    });
    
    console.log('\nInstructions prepared successfully!');
    console.log('\nTo complete this test:');
    console.log('1. Deploy the simplified swap program using:');
    console.log('   ./build-simplified-swap.sh');
    console.log('   solana program deploy program/simplified_swap_program/target/simplified/deploy/simplified_swap_program.so');
    console.log('2. Update the SIMPLIFIED_SWAP_PROGRAM_ID constant in this file with the deployed program ID');
    console.log('3. Rerun this test script');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();