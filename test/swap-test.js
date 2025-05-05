// Test script for Pool Authority implementation
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Configuration from app.config.json
const RPC_URL = 'https://api.devnet.solana.com';
const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';

async function main() {
  try {
    console.log("Starting pool authority token account verification test");
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Convert addresses to PublicKeys
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    
    // Get the associated token addresses
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    const poolYosAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    console.log("Pool Authority:", poolAuthority.toString());
    console.log("Pool YOT Account:", poolYotAccount.toString());
    console.log("Pool YOS Account:", poolYosAccount.toString());
    
    // Check if accounts exist
    const yotInfo = await connection.getAccountInfo(poolYotAccount);
    const yosInfo = await connection.getAccountInfo(poolYosAccount);
    
    console.log("Pool YOT Account exists:", !!yotInfo);
    console.log("Pool YOS Account exists:", !!yosInfo);
    
    if (yotInfo) {
      console.log("YOT Account data length:", yotInfo.data.length);
    }
    
    if (yosInfo) {
      console.log("YOS Account data length:", yosInfo.data.length);
    }
    
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();