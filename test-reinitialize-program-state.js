/**
 * Complete program state reinitialization script
 * This script will recreate the program state with all expected fields to fix the "Program state data too short" error
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

function encodeInitializeInstruction() {
  // Create an 8-byte buffer for the instruction type (0 = Initialize)
  const instructionTypeBuffer = Buffer.alloc(8);
  instructionTypeBuffer.writeUInt8(0); // Instruction type 0 = Initialize
  
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

async function reinitializeProgram() {
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
    
    // First check if program state already exists
    console.log(`Checking current program state...`);
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    if (accountInfo) {
      console.log(`Program state exists. Size: ${accountInfo.data.length} bytes`);
      console.log(`Owner: ${accountInfo.owner.toString()}`);
      console.log(`Current data (first 32 bytes): ${Buffer.from(accountInfo.data).slice(0, 32).toString('hex')}`);
      
      // We'll continue with reinitialization anyway
      console.log(`Proceeding with reinitialization to ensure all fields are properly set...`);
    } else {
      console.log(`Program state does not exist yet. Creating it...`);
    }
    
    console.log(`\nPreparing reinitialization transaction...`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instruction to increase compute units
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000
      })
    );
    
    // Create instruction data for initialization
    const instructionData = encodeInitializeInstruction();
    console.log(`Instruction data length: ${instructionData.length} bytes`);
    console.log(`Instruction data: ${instructionData.toString('hex')}`);
    
    // Create the initialization instruction
    const initializeInstruction = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: [
        // Program accounts
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        
        // Creator account (will pay for account creation)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        
        // System program for account creation
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        
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
    transaction.add(initializeInstruction);
    
    // Get a recent blockhash for the transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Send the transaction with our improved retry and error handling logic
    console.log(`Signing and sending transaction...`);
    let signature;
    
    try {
      // First attempt with normal preflight
      signature = await sendAndConfirmTransaction(
        connection, 
        transaction, 
        [wallet], 
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed',
          maxRetries: 3
        }
      );
      console.log(`Transaction successful! Signature: ${signature}`);
    } catch (preflightError) {
      console.error(`First attempt failed (expected). Error:`, preflightError);
      console.log(`\nRetrying with skipPreflight=true...`);
      
      // Second attempt with skipPreflight=true
      try {
        signature = await sendAndConfirmTransaction(
          connection, 
          transaction, 
          [wallet], 
          {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            commitment: 'confirmed',
            maxRetries: 5
          }
        );
        console.log(`Transaction successful! Signature: ${signature}`);
      } catch (skipPreflightError) {
        console.error(`Second attempt failed. Error:`, skipPreflightError);
        
        // Let's try once more with maximum validity window
        console.log(`\nFinal attempt with maximum validity and skipPreflight...`);
        const { blockhash: newBlockhash, lastValidBlockHeight: newHeight } = 
          await connection.getLatestBlockhash();
        
        transaction.recentBlockhash = newBlockhash;
        
        signature = await sendAndConfirmTransaction(
          connection, 
          transaction, 
          [wallet], 
          {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            commitment: 'confirmed',
            maxRetries: 10
          }
        );
        console.log(`Transaction successful! Signature: ${signature}`);
      }
    }
    
    if (signature) {
      console.log(`Transaction explorer link: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
      // Verify the program state was created/updated
      console.log(`\nVerifying program state...`);
      const newAccountInfo = await connection.getAccountInfo(programStateAddress);
      
      if (newAccountInfo) {
        console.log(`Program state exists. Size: ${newAccountInfo.data.length} bytes`);
        console.log(`Owner: ${newAccountInfo.owner.toString()}`);
        console.log(`Data (first 32 bytes): ${Buffer.from(newAccountInfo.data).slice(0, 32).toString('hex')}`);
        
        if (newAccountInfo.data.length >= 136) {
          console.log(`SUCCESS: Program state has correct data length (≥136 bytes)`);
        } else {
          console.log(`WARNING: Program state data still too short: ${newAccountInfo.data.length} bytes`);
        }
      } else {
        console.log(`ERROR: Program state does not exist after initialization!`);
      }
    }
    
    console.log(`\nReinitialization process completed.`);
  } catch (error) {
    console.error('Error in reinitializeProgram:', error);
  }
}

// Execute the script
reinitializeProgram()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });