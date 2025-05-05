import { Connection, PublicKey, Transaction } from '@solana/web3.js';
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

async function main() {
  try {
    console.log("\n======== TOKEN ACCOUNT BALANCE VERIFICATION ========\n");
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Convert addresses to PublicKeys
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    
    // Get the associated token addresses
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    const poolYosAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    console.log("Pool Token Accounts:");
    console.log("- Pool YOT Account:", poolYotAccount.toString());
    console.log("- Pool YOS Account:", poolYosAccount.toString());
    
    // Get token balances
    try {
      // Fetch token account info
      const yotAccountInfo = await connection.getAccountInfo(poolYotAccount);
      const yosAccountInfo = await connection.getAccountInfo(poolYosAccount);
      
      if (yotAccountInfo && yotAccountInfo.data) {
        // Parse the account data - offset 64 is the amount (8 bytes)
        const amount = yotAccountInfo.data.readBigUInt64LE(64);
        const amountRaw = Number(amount);
        const amountUI = amountRaw / Math.pow(10, 9); // Using 9 decimals for YOT
        console.log("- Pool YOT Balance: ", amountUI.toLocaleString(), "YOT", `(${amountRaw} raw)`);
      } else {
        console.log("- Pool YOT Account not found or has no data");
      }
      
      if (yosAccountInfo && yosAccountInfo.data) {
        // Parse the account data - offset 64 is the amount (8 bytes)
        const amount = yosAccountInfo.data.readBigUInt64LE(64);
        const amountRaw = Number(amount);
        const amountUI = amountRaw / Math.pow(10, 9); // Using 9 decimals for YOS
        console.log("- Pool YOS Balance: ", amountUI.toLocaleString(), "YOS", `(${amountRaw} raw)`);
      } else {
        console.log("- Pool YOS Account not found or has no data");
      }
    } catch (error) {
      console.error("Error fetching token balances:", error);
    }
    
    console.log("\n========= VERIFICATION COMPLETE =========\n");
  } catch (error) {
    console.error("Error during verification:", error);
  }
}

main();