/**
 * Test the simplified SOL to YOT swap
 * 
 * This script executes a direct on-chain SOL to YOT swap with minimal client-side code.
 * It demonstrates the complete swap flow with proper account setup and instruction creation.
 */

const { 
  Keypair, 
  Connection, 
  PublicKey, 
  clusterApiUrl, 
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getAccount
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Constants 
const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu'; // Will be updated by deploy script
const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const SOL_POOL_WALLET = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const YOT_POOL_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
const YOS_POOL_TOKEN_ACCOUNT = '7GnphdpgcV5Z8swNAFB8QkMdo43TPHa4SmdtUw1ApMxz';
const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// Connect to Solana devnet
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Load wallet from the keypair file
function loadWalletFromFile() {
  const keypairFile = path.resolve(process.cwd(), '.keypair-test.json');
  if (!fs.existsSync(keypairFile)) {
    console.error('Keypair file not found. Please create .keypair-test.json');
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairFile, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Find program state PDA
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

// Find program authority PDA
function findProgramAuthorityAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

// Create instruction data for SOL to YOT swap
function createSwapSolToYotInstructionData(solAmount, minYotAmount) {
  const buffer = Buffer.alloc(1 + 8); // 1 + 8 bytes
  
  // Instruction index (1 for SwapSolToYot)
  buffer.writeUInt8(1, 0);
  
  // SOL amount (lamports)
  buffer.writeBigUInt64LE(BigInt(solAmount), 1);
  
  // Min YOT amount (slippage protection)
  const minYotBuffer = Buffer.alloc(8);
  minYotBuffer.writeBigUInt64LE(BigInt(minYotAmount), 0);
  
  // Combine the buffers
  return Buffer.concat([buffer, minYotBuffer]);
}

// Execute a SOL to YOT swap
async function executeSolToYotSwap(solAmount = 0.01) {
  try {
    console.log(`\nExecuting simplified SOL to YOT swap: ${solAmount} SOL`);
    
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Check wallet SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    if (solBalance < solAmount * LAMPORTS_PER_SOL) {
      console.error(`Insufficient SOL balance. Need at least ${solAmount} SOL.`);
      return;
    }
    
    // Get program PDAs
    const [programStatePda] = findProgramStateAddress();
    const [programAuthorityPda] = findProgramAuthorityAddress();
    
    console.log('Program PDAs:');
    console.log(`Program State PDA: ${programStatePda.toString()}`);
    console.log(`Program Authority PDA: ${programAuthorityPda.toString()}`);
    
    // Get or create token accounts
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
    
    // Check if token accounts exist
    try {
      await getAccount(connection, userYotAccount);
      console.log('YOT token account exists');
    } catch (error) {
      console.log('YOT token account needs to be created');
      // In production, we would create the account here
    }
    
    try {
      await getAccount(connection, userYosAccount);
      console.log('YOS token account exists');
    } catch (error) {
      console.log('YOS token account needs to be created');
      // In production, we would create the account here
    }
    
    // Get common wallet YOT account
    const commonWalletYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      new PublicKey(COMMON_WALLET_ADDRESS)
    );
    
    console.log(`Common wallet YOT account: ${commonWalletYotAccount.toString()}`);
    
    // Convert SOL amount to lamports
    const lamports = solAmount * LAMPORTS_PER_SOL;
    
    // Minimum YOT amount (with 5% slippage)
    const minYotAmount = 1; // For testing we accept any amount
    
    // Create the swap instruction data
    const instructionData = createSwapSolToYotInstructionData(lamports, minYotAmount);
    
    // Create swap instruction
    const swapInstruction = new TransactionInstruction({
      programId: new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID),
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStatePda, isSigner: false, isWritable: false },
        { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(SOL_POOL_WALLET), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOT_POOL_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // System program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: commonWalletYotAccount, isSigner: false, isWritable: true },
      ],
      data: instructionData,
    });
    
    // Create transaction
    const transaction = new Transaction().add(swapInstruction);
    transaction.feePayer = wallet.publicKey;
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    console.log('Sending SOL to YOT swap transaction...');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('Swap transaction completed successfully!');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Check balances after swap
    await checkBalancesAfterSwap(wallet.publicKey);
    
  } catch (error) {
    console.error('Error executing simplified swap:', error);
  }
}

// Check balances after swap
async function checkBalancesAfterSwap(walletPubkey) {
  try {
    console.log('\nChecking balances after swap:');
    
    // Check SOL balance
    const solBalance = await connection.getBalance(walletPubkey);
    console.log(`Wallet SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check YOT balance
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      walletPubkey
    );
    
    try {
      const yotAccount = await getAccount(connection, userYotAccount);
      console.log(`Wallet YOT balance: ${Number(yotAccount.amount)} YOT`);
    } catch (error) {
      console.log('Could not fetch YOT balance');
    }
    
    // Check YOS balance
    const userYosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_MINT),
      walletPubkey
    );
    
    try {
      const yosAccount = await getAccount(connection, userYosAccount);
      console.log(`Wallet YOS balance: ${Number(yosAccount.amount)} YOS`);
    } catch (error) {
      console.log('Could not fetch YOS balance');
    }
    
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

// Execute the swap with 0.01 SOL
executeSolToYotSwap(0.01);