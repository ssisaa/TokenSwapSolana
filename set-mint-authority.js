/**
 * Script to set the YOS Token mint authority to the program's PDA
 * 
 * This script must be run by the wallet that has the current mint authority
 * for the YOS token (CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9)
 * 
 * Usage:
 * 1. Install dependencies:
 *    npm install @solana/web3.js @solana/spl-token
 * 
 * 2. Save the mint authority wallet's private key to a file (securely)
 *    The format should be a JSON array representing the private key bytes
 * 
 * 3. Run the script:
 *    node set-mint-authority.js <path-to-private-key-file>
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');

const { 
  TOKEN_PROGRAM_ID, 
  createSetAuthorityInstruction, 
  AuthorityType 
} = require('@solana/spl-token');

const fs = require('fs');

// Configuration - DO NOT CHANGE these values
const YOS_TOKEN_MINT = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');
const PROGRAM_ID = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
const EXPECTED_AUTHORITY = new PublicKey('CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9');

async function main() {
  // Get private key file path from command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: node set-mint-authority.js <path-to-private-key-file>');
    process.exit(1);
  }

  const privateKeyPath = args[0];
  
  // Load the mint authority keypair from file
  let mintAuthority;
  try {
    const privateKeyData = fs.readFileSync(privateKeyPath, 'utf8');
    const privateKeyUint8 = Uint8Array.from(JSON.parse(privateKeyData));
    mintAuthority = Keypair.fromSecretKey(privateKeyUint8);
  } catch (error) {
    console.error('Failed to load private key:', error.message);
    process.exit(1);
  }

  // Verify the loaded keypair matches the expected authority
  if (mintAuthority.publicKey.toBase58() !== EXPECTED_AUTHORITY.toBase58()) {
    console.error(`ERROR: The loaded wallet (${mintAuthority.publicKey.toBase58()}) does not match the expected mint authority (${EXPECTED_AUTHORITY.toBase58()})`);
    process.exit(1);
  }

  console.log(`Successfully loaded keypair for ${mintAuthority.publicKey.toBase58()}`);
  console.log('This matches the expected mint authority.');

  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Derive the program authority PDA
  const [programAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    PROGRAM_ID
  );
  
  console.log(`Program authority PDA: ${programAuthority.toBase58()} (bump: ${bump})`);

  try {
    // Create the set authority instruction
    const instruction = createSetAuthorityInstruction(
      YOS_TOKEN_MINT,
      mintAuthority.publicKey,
      AuthorityType.MintTokens,
      programAuthority,
      [],
      TOKEN_PROGRAM_ID
    );
    
    // Create and send the transaction
    const transaction = new Transaction().add(instruction);
    
    console.log('Sending transaction to set mint authority...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [mintAuthority],
      { commitment: 'confirmed' }
    );
    
    console.log('✓ SUCCESS! Transaction sent successfully');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`\nThe mint authority for YOS token (${YOS_TOKEN_MINT.toBase58()}) has been successfully set to:`);
    console.log(`Program authority PDA: ${programAuthority.toBase58()}`);
  } catch (error) {
    console.error('Failed to set mint authority:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});