import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createApproveInstruction 
} from '@solana/spl-token';
import * as fs from 'fs';

// Constants - Replace with your actual program and token addresses
const PROGRAM_ID = "SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE";
const YOT_TOKEN_ADDRESS = "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF";
const YOS_TOKEN_ADDRESS = "GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n";

// User account addresses
const USER_YOT_ACCOUNT = "BtHDQ6QwAffeeGftkNQK8X22n7HfnX3dud5vVsPZdqzE";
const USER_YOS_ACCOUNT = "BLz2mfhb9qoPAtKuFNVfrj9uTEyChHKKbZsniS1eRaUB";

// Pool/vault account addresses
const POOL_YOT_ACCOUNT = "7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS";
const POOL_AUTHORITY = "7m7RAFhzGXr4eYUWUdQ8U72fJtu137vwzQAyRd9zE7dHS";

// Program state account
const PROGRAM_STATE = "2sR6kFJfCa7oG9hrMWxeTK6ESir7PNZe4vky2JDiNrKC";

// Load wallet from keypair file
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

// Find program state address
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(PROGRAM_ID)
  );
}

// Find program authority
function findProgramAuthority() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(PROGRAM_ID)
  );
}

// Find liquidity contribution account for a user
function findLiquidityContributionAddress(userWallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liq"), userWallet.publicKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

// Encode a u64 number in little-endian format
function encodeU64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

// Try a much simpler approach to the swap
async function simpleSwapTest() {
  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet from file
  const wallet = loadWalletFromFile();
  console.log('Using wallet:', wallet.publicKey.toString());
  
  // Find PDAs
  const [programState, _] = findProgramStateAddress();
  const [programAuthority, __] = findProgramAuthority();
  const [liquidityContribution, ___] = findLiquidityContributionAddress(wallet);
  
  console.log('Program state account:', programState.toString());
  console.log('Program authority:', programAuthority.toString());
  console.log('Liquidity contribution:', liquidityContribution.toString());
  
  // Amount to swap (in raw units)
  // We'll use a very small amount for testing: 0.2 YOT = 200,000,000 (with 9 decimals)
  const amount = 200_000_000;
  console.log(`Swap amount: ${amount} raw units (0.2 YOT)`);
  
  try {
    // Create a transaction with compute budget settings
    const transaction = new Transaction();
    
    // Add compute budget instructions to ensure enough compute units
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1_000_000
      })
    );
    
    // Create an approval instruction to allow the program authority to move tokens
    transaction.add(
      createApproveInstruction(
        new PublicKey(USER_YOT_ACCOUNT),       // Source account
        new PublicKey(programAuthority),       // Delegate
        wallet.publicKey,                      // Owner
        amount                                 // Amount
      )
    );
    
    // Create instruction data for buy_and_distribute (instruction code 4)
    const instructionData = Buffer.concat([
      Buffer.from([4]), // Instruction code for buy_and_distribute
      encodeU64(amount) // Amount parameter
    ]);
    
    // Add the main swap instruction
    transaction.add({
      programId: new PublicKey(PROGRAM_ID),
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey(POOL_YOT_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(USER_YOT_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(POOL_YOT_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOS_TOKEN_ADDRESS), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(USER_YOS_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: liquidityContribution, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(PROGRAM_STATE), isSigner: false, isWritable: false },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(POOL_AUTHORITY), isSigner: false, isWritable: false }
      ],
      data: instructionData
    });
    
    console.log("Transaction built with compute budget and approval");
    
    // Get a recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;
    
    console.log("Sending transaction...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log("Transaction successful!");
    console.log("Signature:", signature);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    return signature;
    
  } catch (error) {
    console.error("Error in swap transaction:", error);
    
    // If simulation error, display logs if available
    if (error.logs) {
      console.error("Transaction logs:");
      error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
    }
    
    // Try to extract more specific error information
    const errorStr = error.toString();
    if (errorStr.includes("BorshIoError")) {
      console.error("DIAGNOSIS: Borsh serialization/deserialization error detected.");
      console.error("This suggests an issue with account data format or structure.");
    } else if (errorStr.includes("Custom program error")) {
      console.error("DIAGNOSIS: Custom program error. Check the program logs for details.");
    }
    
    throw error;
  }
}

// Run the test
simpleSwapTest().then(() => {
  console.log("Test completed successfully");
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});