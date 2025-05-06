/**
 * This script initializes the Multi-Hub Swap program directly
 * It uses the new program ID: Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP
 */
const fs = require('fs');
const { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction 
} = require('@solana/web3.js');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const { programId, admin } = appConfig.solana.multiHubSwap;
const { yot: yotToken, yos: yosToken } = appConfig.solana.tokens;
const rpcUrl = appConfig.solana.rpcUrl;

// Connect to Solana
const connection = new Connection(rpcUrl, 'confirmed');

// Constants
const PROGRAM_ID = new PublicKey(programId);
const ADMIN_WALLET = new PublicKey(admin);
const YOT_MINT = new PublicKey(yotToken.address);
const YOS_MINT = new PublicKey(yosToken.address);

console.log('======= MULTI-HUB SWAP INITIALIZATION =======');
console.log('Program ID:', PROGRAM_ID.toBase58());
console.log('Admin Wallet:', ADMIN_WALLET.toBase58());
console.log('YOT Mint:', YOT_MINT.toBase58());
console.log('YOS Mint:', YOS_MINT.toBase58());

// Find PDAs
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

// Create a new keypair for the transaction
async function createSignerKeypair() {
  const keypair = Keypair.generate();
  
  // Fund the keypair with SOL
  console.log('Funding keypair with SOL for initialization...');
  const sig = await connection.requestAirdrop(
    keypair.publicKey,
    1000000000 // 1 SOL
  );
  await connection.confirmTransaction(sig);
  
  return keypair;
}

// Initialize the program
async function initializeProgram() {
  try {
    // Get PDAs
    const { pda: programState, bump: stateBump } = findProgramStateAddress();
    const { pda: programAuthority, bump: authorityBump } = findProgramAuthority();
    
    console.log('Program State:', programState.toBase58(), 'Bump:', stateBump);
    console.log('Program Authority:', programAuthority.toBase58(), 'Bump:', authorityBump);
    
    // Check if program state already exists
    const stateInfo = await connection.getAccountInfo(programState);
    if (stateInfo) {
      console.log('Program state already exists. Size:', stateInfo.data.length, 'bytes');
      return { success: true, message: 'Program already initialized' };
    }
    
    // Create keypair for transaction
    const signer = await createSignerKeypair();
    console.log('Transaction Signer:', signer.publicKey.toBase58());
    
    // Build instruction data (discriminator 0 for Initialize)
    const instructionData = Buffer.from([0]);
    
    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: false },
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
    
    // Create transaction
    const transaction = new Transaction().add(instruction);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = signer.publicKey;
    
    console.log('Sending initialization transaction...');
    
    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [signer],
      {
        skipPreflight: true,
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );
    
    console.log('Transaction successful!');
    console.log('Signature:', signature);
    
    // Verify program state exists
    const newStateInfo = await connection.getAccountInfo(programState);
    if (newStateInfo) {
      console.log('Program state account created! Size:', newStateInfo.data.length, 'bytes');
      return { success: true, message: 'Program initialized successfully', signature };
    } else {
      console.log('Program state account still does not exist after initialization');
      return { success: false, message: 'Failed to create program state account' };
    }
  } catch (error) {
    console.error('Error initializing program:', error);
    return { success: false, error: error.toString() };
  }
}

// Run initialization
initializeProgram()
  .then(result => {
    console.log('Initialization result:', result);
    console.log('=============================================');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.log('=============================================');
  });