/**
 * On-chain program state repair using the program's native instructions
 * This approach preserves all existing state but ensures all fields are properly set
 */
const { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram, 
  Keypair,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY
} = require('@solana/web3.js');
const fs = require('fs');

// Configuration from app.config.json
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

const POOL_AUTHORITY = new PublicKey('CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9');
const SOL_TOKEN_ACCOUNT = new PublicKey('Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH');
const YOT_TOKEN = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOT_TOKEN_ACCOUNT = new PublicKey('EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74');
const YOS_TOKEN = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');
const YOS_TOKEN_ACCOUNT = new PublicKey('7GnphdpgcV5Z8swNAFB8QkMdo43TPHa4SmdtUw1ApMxz');
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');

// Parameters from app.config.json
const LIQUIDITY_CONTRIBUTION_PERCENTAGE = 20; // 20%
const YOS_CASHBACK_PERCENTAGE = 5; // 5%
const ADMIN_FEE_PERCENTAGE = 0; // 0%
const SWAP_FEE_PERCENTAGE = 1; // 1%
const YOS_DISPLAY_NORMALIZATION_FACTOR = 9260; // Must be 9260, not 10000
const LIQUIDITY_THRESHOLD = 0.1 * 1000000000; // 0.1 SOL in lamports

function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
    const secretKey = Uint8Array.from(keypairData);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

function findProgramStateAddress() {
  const [address] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return address;
}

function findProgramAuthority() {
  const [address] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return address;
}

function encodeRepairStateInstruction() {
  // Create an 8-byte buffer for the instruction type (5 = RepairState)
  // Instruction 5 is for repairing/updating the program state
  const instructionTypeBuffer = Buffer.alloc(8);
  instructionTypeBuffer.writeUInt8(5); // Instruction type 5 = RepairState
  
  // Create a buffer for parameters
  const lpContributionPercentage = Buffer.alloc(8);
  const yosCashbackPercentage = Buffer.alloc(8);
  const adminFeePercentage = Buffer.alloc(8);
  const swapFeePercentage = Buffer.alloc(8);
  const yosDisplayNormalizationFactor = Buffer.alloc(8);
  const liquidityThreshold = Buffer.alloc(8);
  
  // Write parameters in little-endian format (u64)
  lpContributionPercentage.writeBigUInt64LE(BigInt(LIQUIDITY_CONTRIBUTION_PERCENTAGE));
  yosCashbackPercentage.writeBigUInt64LE(BigInt(YOS_CASHBACK_PERCENTAGE));
  adminFeePercentage.writeBigUInt64LE(BigInt(ADMIN_FEE_PERCENTAGE));
  swapFeePercentage.writeBigUInt64LE(BigInt(SWAP_FEE_PERCENTAGE));
  yosDisplayNormalizationFactor.writeBigUInt64LE(BigInt(YOS_DISPLAY_NORMALIZATION_FACTOR));
  liquidityThreshold.writeBigUInt64LE(BigInt(LIQUIDITY_THRESHOLD));
  
  // Concatenate all buffers
  return Buffer.concat([
    instructionTypeBuffer,
    lpContributionPercentage,
    yosCashbackPercentage,
    adminFeePercentage,
    swapFeePercentage,
    yosDisplayNormalizationFactor,
    liquidityThreshold
  ]);
}

async function checkBalances(wallet) {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1000000000} SOL`);
  return balance;
}

async function repairProgramState() {
  try {
    const wallet = loadWalletFromFile();
    console.log(`Wallet address: ${wallet.publicKey.toString()}`);
    await checkBalances(wallet);
    
    // Find program state address
    const programStateAddress = findProgramStateAddress();
    console.log(`Program state address: ${programStateAddress.toString()}`);
    
    // Find program authority
    const programAuthority = findProgramAuthority();
    console.log(`Program authority: ${programAuthority.toString()}`);
    
    // Check current program state
    console.log(`Checking current program state...`);
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    if (accountInfo) {
      console.log(`Program state exists. Size: ${accountInfo.data.length} bytes`);
      console.log(`Owner: ${accountInfo.owner.toString()}`);
      
      // Proceeding with repair
      console.log(`\nPreparing repair state transaction...`);
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add compute budget instruction to increase compute units
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 600000 // Increase compute budget even more
        })
      );
      
      // Create instruction data for state repair
      const instructionData = encodeRepairStateInstruction();
      console.log(`Instruction data length: ${instructionData.length} bytes`);
      
      // Create the repair instruction
      const repairInstruction = new TransactionInstruction({
        programId: MULTI_HUB_SWAP_PROGRAM_ID,
        keys: [
          // Program accounts
          { pubkey: programStateAddress, isSigner: false, isWritable: true },
          { pubkey: programAuthority, isSigner: false, isWritable: false },
          
          // Admin account
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          
          // System program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          
          // Token accounts and mints
          { pubkey: SOL_TOKEN_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: YOT_TOKEN, isSigner: false, isWritable: false },
          { pubkey: YOT_TOKEN_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: YOS_TOKEN, isSigner: false, isWritable: false },
          { pubkey: YOS_TOKEN_ACCOUNT, isSigner: false, isWritable: true },
          
          // Pool authority
          { pubkey: POOL_AUTHORITY, isSigner: false, isWritable: false },
        ],
        data: instructionData
      });
      
      // Add the instruction to the transaction
      transaction.add(repairInstruction);
      
      // Get a recent blockhash with extended validity
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Send the transaction with progressive retry logic
      console.log(`Signing and sending transaction...`);
      
      const sendWithOptions = async (options) => {
        try {
          const signature = await sendAndConfirmTransaction(
            connection, 
            transaction, 
            [wallet], 
            options
          );
          return signature;
        } catch (error) {
          console.log(`Transaction attempt failed:`, error);
          return null;
        }
      };
      
      // Try multiple strategies with increasing aggressiveness
      let signature = await sendWithOptions({
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        commitment: 'confirmed',
        maxRetries: 3
      });
      
      if (!signature) {
        console.log(`\nRetrying with skipPreflight=true...`);
        signature = await sendWithOptions({
          skipPreflight: true,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed',
          maxRetries: 5
        });
      }
      
      if (!signature) {
        console.log(`\nFinal attempt with fresh blockhash...`);
        // Get fresh blockhash
        const { blockhash: newBlockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = newBlockhash;
        
        signature = await sendWithOptions({
          skipPreflight: true,
          preflightCommitment: 'processed',
          commitment: 'processed',
          maxRetries: 10
        });
      }
      
      if (signature) {
        console.log(`Transaction successful! Signature: ${signature}`);
        console.log(`Transaction explorer link: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        
        // Verify the program state was repaired
        console.log(`\nVerifying program state after repair...`);
        const newAccountInfo = await connection.getAccountInfo(programStateAddress);
        
        if (newAccountInfo) {
          console.log(`Program state exists. Size: ${newAccountInfo.data.length} bytes`);
          
          if (newAccountInfo.data.length >= 136) {
            console.log(`SUCCESS: Program state has correct data length (≥136 bytes)`);
          } else {
            console.log(`WARNING: Program state data still too short: ${newAccountInfo.data.length} bytes`);
          }
        } else {
          console.log(`ERROR: Program state does not exist after repair!`);
        }
      } else {
        console.log(`All transaction attempts failed. Consider checking the program logs for more details.`);
      }
    } else {
      console.log(`ERROR: Program state does not exist! You need to initialize it first.`);
    }
  } catch (error) {
    console.error('Error in repairProgramState:', error);
  }
}

// Execute the script
repairProgramState()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });