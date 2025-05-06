/**
 * Simplified test script for creating a liquidity contribution account
 * This script focuses specifically on the account creation part
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram
} = require('@solana/web3.js');
const fs = require('fs');

// Helper function to load wallet from file for testing
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

// Find the liquidity contribution account address for a user's wallet
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Main test function
async function testCreateLiquidityAccount() {
  // Load config from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  
  // Set up connection to Solana devnet
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  // Load test wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check wallet SOL balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  // Get program ID from config
  const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
  console.log(`Multi-Hub Swap Program ID: ${programId.toString()}`);
  
  // Find the liquidity contribution account PDA
  const [liquidityAccount, bump] = findLiquidityContributionAddress(wallet.publicKey, programId);
  console.log(`Liquidity contribution account address: ${liquidityAccount.toString()}`);
  console.log(`Bump seed: ${bump}`);
  
  // Check if account exists
  const accountInfo = await connection.getAccountInfo(liquidityAccount);
  
  if (accountInfo) {
    console.log('✅ Liquidity contribution account exists!');
    console.log(`Account data length: ${accountInfo.data.length} bytes`);
    console.log(`Account owner: ${accountInfo.owner.toString()}`);
    
    if (accountInfo.data.length > 0) {
      console.log(`First few bytes: ${Buffer.from(accountInfo.data).slice(0, 8).toString('hex')}`);
    }
    
    return;
  }
  
  console.log('❌ Liquidity contribution account does not exist, attempting to create...');
  
  // Here we'll attempt to create it using instruction #6 from the program
  // This is the CREATE_LIQUIDITY_ACCOUNT_ONLY instruction
  
  // Create a transaction with compute budget
  const transaction = new Transaction();
  
  // Add compute budget instruction
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  
  transaction.add(computeUnits);
  
  // Create a data buffer with instruction index 6
  const data = Buffer.alloc(1);
  data.writeUint8(6, 0); // Instruction #6 - CREATE_LIQUIDITY_ACCOUNT_ONLY
  
  // Create the instruction with minimal account set
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: liquidityAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data
  });
  
  transaction.add(instruction);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  // Sign and send the transaction
  console.log('Signing transaction...');
  transaction.sign(wallet);
  
  console.log('Sending transaction...');
  const signature = await connection.sendRawTransaction(transaction.serialize());
  console.log(`Transaction sent: ${signature}`);
  
  console.log('Confirming transaction...');
  try {
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
    } else {
      console.log('✅ Transaction confirmed successfully!');
      
      // Check if account was created
      const newAccountInfo = await connection.getAccountInfo(liquidityAccount);
      
      if (newAccountInfo) {
        console.log('✅ Liquidity contribution account created successfully!');
        console.log(`Account data length: ${newAccountInfo.data.length} bytes`);
        console.log(`Account owner: ${newAccountInfo.owner.toString()}`);
      } else {
        console.log('❌ Liquidity contribution account still does not exist after transaction');
      }
    }
  } catch (error) {
    console.error('Error confirming transaction:', error);
    
    // Try to get transaction info
    try {
      const txInfo = await connection.getTransaction(signature);
      if (txInfo) {
        console.log('Transaction info:', JSON.stringify(txInfo.meta, null, 2));
      }
    } catch (infoError) {
      console.error('Error getting transaction info:', infoError);
    }
  }
}

// Run the test
testCreateLiquidityAccount().catch(err => {
  console.error('Test failed:', err);
});