import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

// Read config from app.config.json
const config = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));

// Extract values from config
const RPC_URL = config.solana.rpcUrl;
const YOT_TOKEN_ADDRESS = config.solana.tokens.yot.address;
const YOS_TOKEN_ADDRESS = config.solana.tokens.yos.address;
const POOL_AUTHORITY = config.solana.pool.authority;
const MULTI_HUB_SWAP_PROGRAM_ID = config.solana.multiHubSwap.programId;

// This should be the same algorithm as in the client code
function findLiquidityContributionAddress(userPubkey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liq"), userPubkey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

async function main() {
  try {
    console.log("\n======== POOL AUTHORITY VERIFICATION ========\n");
    console.log("Configuration:");
    console.log("- RPC URL:", RPC_URL);
    console.log("- YOT Token:", YOT_TOKEN_ADDRESS);
    console.log("- YOS Token:", YOS_TOKEN_ADDRESS);
    console.log("- Pool Authority:", POOL_AUTHORITY);
    console.log("- Multi-Hub Swap Program:", MULTI_HUB_SWAP_PROGRAM_ID);
    
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Convert addresses to PublicKeys
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Find program state address (PDA) and authority 
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program
    );
    
    const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      program
    );

    // Get the expected token addresses
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    const poolYosAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    console.log("\nGenerated Addresses:");
    console.log("- Pool Authority:", poolAuthority.toString());
    console.log("- Pool YOT Token Account:", poolYotAccount.toString());
    console.log("- Pool YOS Token Account:", poolYosAccount.toString());
    console.log("- Program State PDA:", programStateAddress.toString());
    console.log("- Program Authority PDA:", programAuthorityAddress.toString());
    
    // Check if accounts exist
    console.log("\nVerifying accounts...");
    
    const yotInfo = await connection.getAccountInfo(poolYotAccount);
    const yosInfo = await connection.getAccountInfo(poolYosAccount);
    const programInfo = await connection.getAccountInfo(program);
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    const programAuthorityInfo = await connection.getAccountInfo(programAuthorityAddress);
    
    // Display results
    console.log("- Program exists:", !!programInfo, programInfo ? "(size: " + programInfo.data.length + " bytes)" : "");
    console.log("- Program State exists:", !!programStateInfo, programStateInfo ? "(size: " + programStateInfo.data.length + " bytes)" : "");
    console.log("- Program Authority exists:", !!programAuthorityInfo, programAuthorityInfo ? "(size: " + programAuthorityInfo.data.length + " bytes)" : "");
    console.log("- Pool YOT Account exists:", !!yotInfo, yotInfo ? "(size: " + yotInfo.data.length + " bytes)" : "");
    console.log("- Pool YOS Account exists:", !!yosInfo, yosInfo ? "(size: " + yosInfo.data.length + " bytes)" : "");
    
    if (yotInfo) {
      console.log("- Pool YOT Account owner:", yotInfo.owner.toString());
      console.log("  (Expected TOKEN_PROGRAM_ID:", TOKEN_PROGRAM_ID.toString() + ")");
    }
    
    if (yosInfo) {
      console.log("- Pool YOS Account owner:", yosInfo.owner.toString());
      console.log("  (Expected TOKEN_PROGRAM_ID:", TOKEN_PROGRAM_ID.toString() + ")");
    }
    
    // Test a user address to ensure PDA derivation works properly
    const testUserAddress = new PublicKey("AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ"); // Admin wallet address
    const [liquidityContribAddress] = findLiquidityContributionAddress(testUserAddress);
    console.log("\nUser Liquidity Contribution PDA derivation test:");
    console.log("- User:", testUserAddress.toString());
    console.log("- Generated contribution PDA:", liquidityContribAddress.toString());
    
    const contributionInfo = await connection.getAccountInfo(liquidityContribAddress);
    console.log("- Contribution account exists:", !!contributionInfo, contributionInfo ? "(size: " + contributionInfo.data.length + " bytes)" : "");
    
    console.log("\n========= VERIFICATION COMPLETE =========\n");

  } catch (error) {
    console.error("Error during verification:", error);
  }
}

main();