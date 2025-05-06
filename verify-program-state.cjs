/**
 * Script to read the current program state and verify who is the admin
 */
const { 
  Connection, 
  PublicKey
} = require('@solana/web3.js');

// Program ID and expected wallets
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');
const USER_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
const PROGRAM_ADMIN_WALLET = new PublicKey('5rQzEXhDTYdyDftPmu4DiaLpZz4GePd2XumXYPHBSj6T');

// Find program state address (PDA)
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
}

// Read and parse program state account data
async function readProgramState() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Get program state PDA
  const [programStatePDA, bump] = findProgramStateAddress();
  console.log('Program State PDA:', programStatePDA.toBase58(), 'with bump:', bump);
  
  // Fetch the account data
  try {
    const accountInfo = await connection.getAccountInfo(programStatePDA);
    if (!accountInfo) {
      console.log('Program state account not found!');
      return;
    }
    
    console.log('Program state account found with size:', accountInfo.data.length, 'bytes');
    
    // Parse the admin wallet (first 32 bytes)
    const adminWallet = new PublicKey(accountInfo.data.slice(0, 32));
    console.log('Current Admin Wallet:', adminWallet.toBase58());
    
    // Check if it matches the expected wallets
    if (adminWallet.equals(USER_ADMIN_WALLET)) {
      console.log('✅ Admin wallet is set to USER_ADMIN_WALLET');
    } else if (adminWallet.equals(PROGRAM_ADMIN_WALLET)) {
      console.log('⚠️ Admin wallet is still set to PROGRAM_ADMIN_WALLET');
    } else {
      console.log('❌ Admin wallet is set to an unknown address');
    }
    
    // Parse YOT mint (next 32 bytes)
    const yotMint = new PublicKey(accountInfo.data.slice(32, 64));
    console.log('YOT Mint:', yotMint.toBase58());
    
    // Parse YOS mint (next 32 bytes)
    const yosMint = new PublicKey(accountInfo.data.slice(64, 96));
    console.log('YOS Mint:', yosMint.toBase58());
    
    // Parse rates (next 5 * 8 bytes)
    if (accountInfo.data.length >= 136) {
      const lpContributionRate = accountInfo.data.readBigUInt64LE(96);
      const adminFeeRate = accountInfo.data.readBigUInt64LE(104);
      const yosCashbackRate = accountInfo.data.readBigUInt64LE(112);
      const swapFeeRate = accountInfo.data.readBigUInt64LE(120);
      const referralRate = accountInfo.data.readBigUInt64LE(128);
      
      console.log('LP Contribution Rate:', lpContributionRate.toString());
      console.log('Admin Fee Rate:', adminFeeRate.toString());
      console.log('YOS Cashback Rate:', yosCashbackRate.toString());
      console.log('Swap Fee Rate:', swapFeeRate.toString());
      console.log('Referral Rate:', referralRate.toString());
    } else {
      console.log('Program state data is too short to include rates');
    }
  } catch (error) {
    console.error('Failed to read program state:', error);
  }
}

// Main function
async function main() {
  try {
    await readProgramState();
  } catch (error) {
    console.error('Error:', error);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});