const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction, 
  LAMPORTS_PER_SOL, 
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress 
} = require('@solana/spl-token');
const fs = require('fs');

// Constants
const PROGRAM_ID = 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE';
const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const SOL_POOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const YOT_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGzyNVnte48SQRop';

// Load wallet from file
function loadWalletFromFile() {
  const keypairData = JSON.parse(fs.readFileSync('test-wallet.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Check balances
async function checkBalances(wallet, connection) {
  console.log('Checking balances...');
  
  const solBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
  console.log(`SOL Balance: ${solBalance} SOL`);
  
  try {
    const yotTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      wallet.publicKey
    );
    
    const yotBalance = await connection.getTokenAccountBalance(yotTokenAccount);
    console.log(`YOT Balance: ${yotBalance.value.uiAmount} YOT`);
  } catch (error) {
    console.log('No YOT token account found for this wallet');
  }
  
  try {
    const yosTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_MINT),
      wallet.publicKey
    );
    
    const yosBalance = await connection.getTokenAccountBalance(yosTokenAccount);
    console.log(`YOS Balance: ${yosBalance.value.uiAmount} YOS`);
  } catch (error) {
    console.log('No YOS token account found for this wallet');
  }
}

// Check pool balances
async function checkPoolBalances(connection) {
  console.log('Checking pool balances...');
  
  const solPoolBalance = await connection.getBalance(new PublicKey(SOL_POOL_ACCOUNT)) / LAMPORTS_PER_SOL;
  console.log(`SOL Pool Balance: ${solPoolBalance} SOL`);
  
  try {
    const yotPoolBalance = await connection.getTokenAccountBalance(new PublicKey(YOT_TOKEN_ACCOUNT));
    console.log(`YOT Pool Balance: ${yotPoolBalance.value.uiAmount} YOT`);
  } catch (error) {
    console.log('Error getting YOT pool balance:', error.message);
  }
}

// Find program state address
function findProgramStateAddress(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

// Find program authority
function findProgramAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

// Find liquidity contribution account
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Function to create a SOL to YOT swap instruction
function createSolToYotSwapInstruction(
  userWallet,
  amountInLamports,
  minAmountOutTokens,
  programId,
  programStateAddress,
  programAuthority,
  solPoolAccount,
  yotPoolAccount,
  userYotAccount,
  liquidityContributionAccount,
  yosMint,
  userYosAccount,
) {
  // Instruction data: [7, amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL to YOT Swap instruction (index 7)
  
  // Convert numbers to little-endian 64-bit values
  const amountInBuffer = Buffer.alloc(8);
  amountInBuffer.writeBigUInt64LE(BigInt(amountInLamports), 0);
  amountInBuffer.copy(data, 1);
  
  const minAmountOutBuffer = Buffer.alloc(8);
  minAmountOutBuffer.writeBigUInt64LE(BigInt(minAmountOutTokens), 0);
  minAmountOutBuffer.copy(data, 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: yosMint, isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys: accounts,
    data,
  });
}

// Main test function for SOL to YOT swap
async function testCompleteSwap() {
  try {
    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log('Using wallet:', wallet.publicKey.toString());
    
    // Check balances before swap
    console.log('\n--- BALANCES BEFORE SWAP ---');
    await checkBalances(wallet, connection);
    await checkPoolBalances(connection);
    
    // Define swap parameters
    const amountInSol = 0.05; // SOL to swap
    const amountInLamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);
    
    // Calculate expected output based on pool balances
    const solPoolAccount = new PublicKey(SOL_POOL_ACCOUNT);
    const yotPoolAccount = new PublicKey(YOT_TOKEN_ACCOUNT);
    
    const solPoolBalance = await connection.getBalance(solPoolAccount);
    const yotPoolInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotPoolInfo.value.amount);
    
    // Calculate expected output
    const solBalanceBefore = solPoolBalance;
    const expectedOutput = Math.floor((amountInLamports * yotPoolBalance) / solBalanceBefore);
    
    // Apply 1% slippage tolerance for minimum amount out
    const minAmountOut = Math.floor(expectedOutput * 0.99);
    
    console.log(`\nSwap parameters:`);
    console.log(`- Amount in: ${amountInSol} SOL (${amountInLamports} lamports)`);
    console.log(`- Expected output: ${expectedOutput} YOT tokens`);
    console.log(`- Minimum output (with slippage): ${minAmountOut} YOT tokens`);
    
    // Get necessary addresses
    const programId = new PublicKey(PROGRAM_ID);
    const yosMint = new PublicKey(YOS_MINT);
    
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      wallet.publicKey
    );
    
    const userYosAccount = await getAssociatedTokenAddress(
      yosMint,
      wallet.publicKey
    );
    
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    const [liquidityContributionAccount] = findLiquidityContributionAddress(
      wallet.publicKey,
      programId
    );
    
    console.log('\nAccount addresses:');
    console.log(`- Program ID: ${programId.toString()}`);
    console.log(`- Program State: ${programStateAddress.toString()}`);
    console.log(`- Program Authority: ${programAuthority.toString()}`);
    console.log(`- Liquidity Contribution: ${liquidityContributionAccount.toString()}`);
    console.log(`- User YOT Account: ${userYotAccount.toString()}`);
    console.log(`- User YOS Account: ${userYosAccount.toString()}`);
    
    // Create the swap instruction
    const swapInstruction = createSolToYotSwapInstruction(
      wallet.publicKey,
      amountInLamports,
      minAmountOut,
      programId,
      programStateAddress,
      programAuthority,
      solPoolAccount,
      yotPoolAccount,
      userYotAccount,
      liquidityContributionAccount,
      yosMint,
      userYosAccount
    );
    
    // Create and sign the transaction
    const transaction = new Transaction();
    transaction.add(swapInstruction);
    
    console.log('\nSending swap transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log(`Transaction successful! Signature: ${signature}`);
    
    // Check balances after swap
    console.log('\n--- BALANCES AFTER SWAP ---');
    await checkBalances(wallet, connection);
    await checkPoolBalances(connection);
    
  } catch (error) {
    console.error('Error during swap test:', error);
  }
}

// Run the test
testCompleteSwap();