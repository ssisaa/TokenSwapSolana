/**
 * Token Account Diagnostic Tool for Multihub Swap
 * 
 * This script checks the exact token accounts used in the swap transaction
 * to help diagnose the "InsufficientFunds" error at instruction index 4.
 */

import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram
} from "@solana/web3.js";
import {
  getAccount,
  getMint,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { config } from "../client/src/lib/config";

// Get the current user wallet from command line or use a default admin wallet
const userPublicKey = new PublicKey(
  process.argv[2] || "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ" // Default to admin wallet if not provided
);

// Use the devnet connection for testing
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Use the active program ID from the config
const PROGRAM_ID = new PublicKey(config.programs.multiHub.v4);

// CRITICAL - Use the exact same PDA derivation as the contract
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
}

function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );
}

// Get real token addresses for the test
const [programStateAddress, stateBump] = findProgramStateAddress();
const [programAuthorityAddress, authorityBump] = findProgramAuthorityAddress();
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const YOT_MINT = new PublicKey(config.tokens.YOT);
const YOS_MINT = new PublicKey(config.tokens.YOS);

// Test with two scenarios: SOL -> YOT and YOT -> SOL
async function diagnoseSwapAccounts(fromToken: PublicKey, toToken: PublicKey) {
  const isSwapToYot = toToken.equals(YOT_MINT);
  const isSwapFromYot = fromToken.equals(YOT_MINT);
  
  console.log(`\n🔍 DIAGNOSING ${fromToken.equals(SOL_MINT) ? "SOL" : "YOT"} -> ${toToken.equals(YOT_MINT) ? "YOT" : "SOL"} SWAP\n`);

  // Get all accounts that are part of this swap transaction
  const userFromTokenAccount = !fromToken.equals(SOL_MINT) 
    ? await getAssociatedTokenAddress(fromToken, userPublicKey)
    : userPublicKey; // For SOL, the token account is the wallet itself
    
  const userToTokenAccount = !toToken.equals(SOL_MINT)
    ? await getAssociatedTokenAddress(toToken, userPublicKey)
    : userPublicKey; // For SOL, the token account is the wallet itself
    
  const programFromTokenAccount = !fromToken.equals(SOL_MINT)
    ? await getAssociatedTokenAddress(fromToken, programAuthorityAddress, true)
    : programAuthorityAddress; // For SOL, the token account is the PDA itself
    
  const programToTokenAccount = !toToken.equals(SOL_MINT)
    ? await getAssociatedTokenAddress(toToken, programAuthorityAddress, true)
    : programAuthorityAddress; // For SOL, the token account is the PDA itself
    
  const programYosTokenAccount = await getAssociatedTokenAddress(
    YOS_MINT, 
    programAuthorityAddress,
    true // allowOwnerOffCurve = true for PDA
  );
  
  const userYosTokenAccount = await getAssociatedTokenAddress(
    YOS_MINT,
    userPublicKey
  );
  
  // Now let's check each account 
  
  // 1. User accounts
  console.log("==== USER ACCOUNTS ====");
  await checkAccount("userTokenFrom", userFromTokenAccount, fromToken, userPublicKey);
  await checkAccount("userTokenTo", userToTokenAccount, toToken, userPublicKey);
  await checkAccount("userYosAccount", userYosTokenAccount, YOS_MINT, userPublicKey);
  
  // 2. Program accounts
  console.log("\n==== PROGRAM ACCOUNTS ====");
  await checkAccount("programTokenFrom", programFromTokenAccount, fromToken, programAuthorityAddress);
  await checkAccount("programTokenTo", programToTokenAccount, toToken, programAuthorityAddress);
  await checkAccount("programYosAccount", programYosTokenAccount, YOS_MINT, programAuthorityAddress);
  
  // 3. PDAs and Mint info
  console.log("\n==== PDA ACCOUNTS ====");
  console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`Program State Address: ${programStateAddress.toBase58()} (bump: ${stateBump})`);
  console.log(`Program Authority Address: ${programAuthorityAddress.toBase58()} (bump: ${authorityBump})`);
  
  // 4. Check SOL balances
  console.log("\n==== SOL BALANCES ====");
  const authorityBalance = await connection.getBalance(programAuthorityAddress);
  console.log(`Program Authority SOL: ${authorityBalance / LAMPORTS_PER_SOL} SOL (${authorityBalance} lamports)`);
  
  const userBalance = await connection.getBalance(userPublicKey);
  console.log(`User wallet SOL: ${userBalance / LAMPORTS_PER_SOL} SOL (${userBalance} lamports)`);
  
  // 5. Check token mints
  console.log("\n==== TOKEN MINT INFO ====");
  await getMintInfo("YOT_MINT", YOT_MINT);
  await getMintInfo("YOS_MINT", YOS_MINT);
  
  // 6. Check if accounts exist
  console.log("\n==== CRITICAL CHECK ====");
  if (authorityBalance < 5000000) {
    console.log("❌ CRITICAL: Program Authority has insufficient SOL!");
    console.log(`   Current balance: ${authorityBalance / LAMPORTS_PER_SOL} SOL`);
    console.log("   This is the most likely cause of 'InsufficientFunds' error at index 4");
    console.log("   Recommendation: Ensure at least 0.01 SOL is sent to the Authority before operations");
  } else {
    console.log("✅ Program Authority has sufficient SOL balance");
  }
  
  // Provide recommendation based on diagnosis
  console.log("\n==== RECOMMENDATIONS ====");
  console.log("1. Transfer more SOL (0.05) to the Program Authority in the transaction");
  console.log("2. Ensure that all token accounts are writable in the transaction");
  console.log("3. Make sure Rent Sysvar and SystemProgram are included in account list");
  console.log("4. Use exact same account order as required by the contract");
}

async function checkAccount(label: string, account: PublicKey, mint: PublicKey, owner: PublicKey) {
  try {
    console.log(`\n--- ${label} ---`);
    console.log(`Address: ${account.toBase58()}`);
    console.log(`Expected mint: ${mint.toBase58()}`);
    console.log(`Expected owner: ${owner.toBase58()}`);
    
    // Native SOL doesn't have a token account
    if (mint.equals(SOL_MINT)) {
      const balance = await connection.getBalance(account);
      console.log(`SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`);
      console.log(`Account exists: Yes (Native SOL)`);
      return;
    }
    
    // Check if the token account exists
    try {
      const accountInfo = await getAccount(connection, account);
      const mintInfo = await getMint(connection, mint);
      
      // Validate that mint matches
      if (!accountInfo.mint.equals(mint)) {
        console.log(`⚠️ MISMATCH: Account mint is ${accountInfo.mint.toBase58()}`);
      }
      
      // Validate that owner matches
      if (!accountInfo.owner.equals(owner)) {
        console.log(`⚠️ MISMATCH: Account owner is ${accountInfo.owner.toBase58()}`);
      }
      
      const balance = Number(accountInfo.amount);
      const decimals = mintInfo.decimals;
      console.log(`Token Balance: ${balance / (10 ** decimals)} (${balance} raw)`);
      console.log(`Account exists: Yes`);
      
    } catch (e) {
      if (e.message.includes("could not find account")) {
        console.log(`Token Balance: 0 (account not found)`);
        console.log(`Account exists: No - will be created during transaction`);
      } else {
        console.log(`Error: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`Error checking ${label}: ${e.message}`);
  }
}

async function getMintInfo(label: string, mint: PublicKey) {
  try {
    console.log(`\n--- ${label} ---`);
    console.log(`Address: ${mint.toBase58()}`);
    
    try {
      const mintInfo = await getMint(connection, mint);
      console.log(`Decimals: ${mintInfo.decimals}`);
      console.log(`Supply: ${Number(mintInfo.supply) / (10 ** mintInfo.decimals)}`);
      console.log(`Mint Authority: ${mintInfo.mintAuthority?.toBase58() || 'None'}`);
      console.log(`Freeze Authority: ${mintInfo.freezeAuthority?.toBase58() || 'None'}`);
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  } catch (e) {
    console.error(`Error checking mint ${label}: ${e.message}`);
  }
}

async function runDiagnostics() {
  console.log("🔍 MULTIHUB SWAP ACCOUNT DIAGNOSTICS\n");
  console.log("User wallet:", userPublicKey.toBase58());
  
  // Check both swap directions
  await diagnoseSwapAccounts(SOL_MINT, YOT_MINT);  // SOL -> YOT
  await diagnoseSwapAccounts(YOT_MINT, SOL_MINT);  // YOT -> SOL
  
  console.log("\n✅ Diagnostics complete!");
}

runDiagnostics().catch(console.error);