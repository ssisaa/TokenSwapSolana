/**
 * Script to find all accounts owned by the multi-hub swap program
 */
const { Connection, PublicKey } = require('@solana/web3.js');

// Program ID
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  console.log(`Finding accounts owned by program: ${PROGRAM_ID.toBase58()}`);
  
  try {
    // Find all accounts owned by the program
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    
    if (accounts.length === 0) {
      console.log("No accounts found for this program.");
      return;
    }
    
    console.log(`Found ${accounts.length} accounts:`);
    
    // Examine each account
    for (const { pubkey, account } of accounts) {
      console.log(`\nAccount: ${pubkey.toBase58()}`);
      console.log(`Data length: ${account.data.length} bytes`);
      console.log(`Executable: ${account.executable}`);
      console.log(`Rent epoch: ${account.rentEpoch}`);
      console.log(`Lamports: ${account.lamports}`);
      
      // If this might be the program state based on data size, show more details
      if (account.data.length >= 32) {
        const data = account.data;
        
        // Try to display data as text, limiting the length
        console.log("First 64 bytes of data as hex:");
        console.log(Buffer.from(data).slice(0, 64).toString('hex'));
        
        // Try to extract Pubkeys from the first 32 bytes (potential admin key)
        try {
          const possibleKey = new PublicKey(Buffer.from(data.slice(0, 32)));
          console.log(`Possible key in first 32 bytes: ${possibleKey.toBase58()}`);
        } catch (e) {
          console.log("First 32 bytes are not a valid Pubkey");
        }
        
        // If there's more data, try the next 32 bytes (potential token mint)
        if (data.length >= 64) {
          try {
            const possibleKey2 = new PublicKey(Buffer.from(data.slice(32, 64)));
            console.log(`Possible key in next 32 bytes: ${possibleKey2.toBase58()}`);
          } catch (e) {
            console.log("Next 32 bytes are not a valid Pubkey");
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching program accounts:", error);
  }
}

main().then(() => {
  console.log("\nAccount search completed");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});