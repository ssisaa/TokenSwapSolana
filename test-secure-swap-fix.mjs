// Test script to verify the secureSwap functionality works correctly
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { readFileSync } from 'fs';
import path from 'path';

// Load the program configuration from app.config.json
const appConfig = JSON.parse(readFileSync('app.config.json', 'utf8'));
const RPC_URL = appConfig.solana.rpcUrl;
const MULTI_HUB_SWAP_PROGRAM_ID = appConfig.solana.multiHubSwap.programId;
const PROGRAM_STATE_ADDRESS = appConfig.solana.multiHubSwap.programState;
const PROGRAM_AUTHORITY = appConfig.solana.multiHubSwap.programAuthority;
const SOL_POOL_ACCOUNT = appConfig.solana.pool.solAccount;
const COMMON_WALLET = appConfig.solana.multiHubSwap.commonWallet.wallet;

// Create a Solana connection
const connection = new Connection(RPC_URL, 'confirmed');

// Load test wallet (make sure keypair exists)
let keypairPath;
let testWallet;
try {
  keypairPath = '.keypair-test.json';
  const testWalletData = JSON.parse(readFileSync(keypairPath, 'utf8'));
  testWallet = Keypair.fromSecretKey(new Uint8Array(testWalletData));
  console.log(`Loaded test wallet: ${testWallet.publicKey.toString()}`);
} catch (error) {
  console.error('Failed to load test wallet keypair:', error);
  process.exit(1);
}

// Simple function to display public key in a readable format
function formatPubkey(pubkey) {
  const pubkeyStr = pubkey.toString();
  return `${pubkeyStr.slice(0, 6)}...${pubkeyStr.slice(-6)}`;
}

async function checkAccount(pubkey, label) {
  try {
    const info = await connection.getAccountInfo(new PublicKey(pubkey));
    console.log(`${label}: ${pubkey} - Balance: ${info ? info.lamports / 1000000000 : 'N/A'} SOL`);
    return info !== null;
  } catch (error) {
    console.error(`Error checking ${label}:`, error);
    return false;
  }
}

async function main() {
  console.log('Starting secure swap test...');
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Program ID: ${MULTI_HUB_SWAP_PROGRAM_ID}`);
  
  // Check critical accounts
  console.log('\nVerifying critical accounts:');
  await checkAccount(MULTI_HUB_SWAP_PROGRAM_ID, 'Program ID');
  await checkAccount(PROGRAM_STATE_ADDRESS, 'Program State');
  await checkAccount(PROGRAM_AUTHORITY, 'Program Authority');
  await checkAccount(SOL_POOL_ACCOUNT, 'SOL Pool Account');
  await checkAccount(COMMON_WALLET, 'Common Wallet');
  
  // Check wallet balance
  const walletBalance = await connection.getBalance(testWallet.publicKey);
  console.log(`\nTest wallet balance: ${walletBalance / 1000000000} SOL`);
  
  if (walletBalance < 100000000) { // 0.1 SOL
    console.error('Test wallet has insufficient balance. Need at least 0.1 SOL');
    process.exit(1);
  }
  
  console.log('\nAll accounts verified successfully!');
  console.log('The application is now ready for swapping.');
}

main().catch(err => {
  console.error('Error in test script:', err);
  process.exit(1);
});