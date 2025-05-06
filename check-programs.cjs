/**
 * Script to check deployed programs on Solana
 */
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const rpcUrl = appConfig.solana.rpcUrl;
const connection = new Connection(rpcUrl, 'confirmed');

// Check program keypair
const secretKeyString = fs.readFileSync('./program-keypair.json', 'utf8');
const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
const keypair = Keypair.fromSecretKey(secretKey);
console.log('Program Keypair Public Key:', keypair.publicKey.toBase58());

// Check the programs
const programIds = [
  // New program ID from config
  new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP'),
  // Program ID from existing keypair
  new PublicKey('5rQzEXhDTYdyDftPmu4DiaLpZz4GePd2XumXYPHBSj6T'),
  // Old program ID from config
  new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s')
];

async function checkPrograms() {
  console.log('\nChecking programs on chain...');
  
  for (const id of programIds) {
    try {
      const info = await connection.getAccountInfo(id);
      if (info) {
        console.log(`Program ${id.toBase58()} exists:`, { 
          size: info.data.length,
          executable: info.executable,
          owner: info.owner.toBase58()
        });
      } else {
        console.log(`Program ${id.toBase58()} does not exist on chain`);
      }
    } catch(e) {
      console.log(`Error checking ${id.toBase58()}:`, e);
    }
  }
}

checkPrograms();