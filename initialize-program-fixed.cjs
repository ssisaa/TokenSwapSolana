/**
 * Improved script to initialize the multi-hub swap program
 */
const fs = require('fs');
const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const { programId: programIdStr, admin: adminStr } = appConfig.solana.multiHubSwap;
const { yot: yotToken, yos: yosToken } = appConfig.solana.tokens;
const rpcUrl = appConfig.solana.rpcUrl;

// Constants
const PROGRAM_ID = new PublicKey(programIdStr);
const ADMIN_WALLET = new PublicKey(adminStr);
const YOT_MINT = new PublicKey(yotToken.address);
const YOS_MINT = new PublicKey(yosToken.address);

// Connect to Solana
const connection = new Connection(rpcUrl, 'confirmed');

// Derive PDAs
function findProgramStateAddress() {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
  return { pda, bump };
}

function findProgramAuthority() {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    PROGRAM_ID
  );
  return { pda, bump };
}

// Load program keypair (required for initialization)
function loadProgramKeypair() {
  try {
    const secretKeyString = fs.readFileSync('./program-keypair.json', 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    
    return keypair;
  } catch (error) {
    console.error('Error loading program keypair:', error);
    throw new Error('Failed to load program keypair');
  }
}

// Build the instruction data for initialization
function encodeInitializeInstruction() {
  // Instruction type for Initialize = 0
  const instructionTypeBuffer = Buffer.alloc(8);
  instructionTypeBuffer.writeUInt8(0, 0);
  
  return instructionTypeBuffer;
}

// Initialize the program with proper parameters
async function initializeProgram() {
  try {
    // Load program keypair for signing
    const programKeypair = loadProgramKeypair();
    console.log(`Program Keypair Public Key: ${programKeypair.publicKey.toBase58()}`);
    
    // Get PDAs
    const { pda: programState, bump: stateBump } = findProgramStateAddress();
    const { pda: programAuthority, bump: authorityBump } = findProgramAuthority();
    
    console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);
    console.log(`Program State: ${programState.toBase58()} (bump: ${stateBump})`);
    console.log(`Program Authority: ${programAuthority.toBase58()} (bump: ${authorityBump})`);
    console.log(`Admin Wallet: ${ADMIN_WALLET.toBase58()}`);
    console.log(`YOT Mint: ${YOT_MINT.toBase58()}`);
    console.log(`YOS Mint: ${YOS_MINT.toBase58()}`);
    
    // Check if program state already exists
    const stateInfo = await connection.getAccountInfo(programState);
    if (stateInfo) {
      console.log(`Program state already exists (size: ${stateInfo.data.length} bytes). No initialization needed.`);
      return { success: true, message: 'Program already initialized' };
    }
    
    // Create the instruction data
    const instructionData = encodeInitializeInstruction();
    
    // Create the instruction to initialize the program
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: programKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: programState, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: ADMIN_WALLET, isSigner: false, isWritable: false },
        { pubkey: YOT_MINT, isSigner: false, isWritable: false },
        { pubkey: YOS_MINT, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    
    console.log('Sending initialization transaction...');
    
    // Add program keypair as signer
    const signers = [programKeypair];
    
    // Create a retry function for transaction sending
    const sendWithRetry = async (tx, signers, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          // Add a recent blockhash
          tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          tx.feePayer = programKeypair.publicKey;
          
          // Send and confirm the transaction
          const signature = await sendAndConfirmTransaction(connection, tx, signers, {
            skipPreflight: true,
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
          });
          
          console.log(`Transaction successful! Signature: ${signature}`);
          return { success: true, signature };
        } catch (error) {
          console.error(`Attempt ${i + 1} failed:`, error);
          
          if (i === retries - 1) {
            throw error;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };
    
    // Send with retry
    return await sendWithRetry(transaction, signers);
  } catch (error) {
    console.error('Error initializing program:', error);
    return { success: false, error: error.toString() };
  }
}

// Verify configuration
function verifyConfig() {
  // Check if the program ID in config matches the program keypair
  const programKeypair = loadProgramKeypair();
  const programIdFromConfig = PROGRAM_ID.toBase58();
  const programIdFromKeypair = programKeypair.publicKey.toBase58();
  
  console.log(`Program ID from config: ${programIdFromConfig}`);
  console.log(`Program ID from keypair: ${programIdFromKeypair}`);
  
  if (programIdFromConfig !== programIdFromKeypair) {
    console.error('ERROR: Program ID in config does not match keypair!');
    console.error('Please update the config to match the keypair, or use the correct keypair file.');
    throw new Error('Program ID mismatch');
  }
  
  console.log('✅ Program ID verification passed');
}

// Main function
async function main() {
  console.log('============================================');
  console.log('Multi-Hub Swap Program Initialization');
  console.log('============================================');
  
  try {
    // Verify config matches keypair
    verifyConfig();
    
    // Initialize the program
    console.log('\nInitializing program...');
    const result = await initializeProgram();
    
    if (result.success) {
      console.log('\n✅ Program initialization successful!');
      
      // Verify program state exists
      const { pda: programState } = findProgramStateAddress();
      const stateInfo = await connection.getAccountInfo(programState);
      
      if (stateInfo) {
        console.log(`✅ Program state account created (size: ${stateInfo.data.length} bytes)`);
        console.log(`  Owner: ${stateInfo.owner.toBase58()}`);
      } else {
        console.log('❌ Program state account still does not exist');
      }
    } else {
      console.error('\n❌ Program initialization failed');
    }
    
    console.log('\n============================================');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the main function
main();