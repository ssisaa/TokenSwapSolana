/**
 * Script to find all PDAs associated with the multi-hub swap program
 */
const { Connection, PublicKey } = require('@solana/web3.js');

// Program ID
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');

// Various seed combinations to check
const seedCombinations = [
  ['state'],
  ['authority'],
  ['admin'],
  ['config'],
  ['program_state'],
  ['program'],
  ['state', 'v1'],
  ['state', 'v2'],
];

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  console.log(`Finding PDAs for program: ${PROGRAM_ID.toBase58()}`);
  
  // Check each seed combination
  for (const seeds of seedCombinations) {
    // Convert string seeds to Buffer
    const bufferSeeds = seeds.map(seed => Buffer.from(seed));
    
    // Find PDA
    const [pda, bump] = PublicKey.findProgramAddressSync(
      bufferSeeds,
      PROGRAM_ID
    );
    
    console.log(`\nPDA for seeds [${seeds.join(', ')}]:`);
    console.log(`- Address: ${pda.toBase58()}`);
    console.log(`- Bump: ${bump}`);
    
    // Check if this PDA exists on-chain
    try {
      const accountInfo = await connection.getAccountInfo(pda);
      if (accountInfo) {
        console.log(`✓ Account exists with size: ${accountInfo.data.length} bytes`);
        console.log(`✓ Owner: ${accountInfo.owner.toBase58()}`);
        
        // Check if owner matches program
        if (accountInfo.owner.equals(PROGRAM_ID)) {
          console.log(`✓ This account is owned by our program!`);
          
          // If this might be the program state, print the first few bytes
          if (accountInfo.data.length > 64) {
            console.log(`First 64 bytes of data: `);
            console.log(Buffer.from(accountInfo.data).slice(0, 64));
          }
        }
      } else {
        console.log(`✗ No account exists at this address`);
      }
    } catch (error) {
      console.error(`Error checking account: ${error.message}`);
    }
  }
}

main().then(() => {
  console.log("PDA search completed");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});