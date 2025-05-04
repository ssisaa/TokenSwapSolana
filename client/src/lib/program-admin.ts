import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";
import { MULTI_HUB_SWAP_PROGRAM_ID, SOLANA_CLUSTER, YOT_MINT, YOS_MINT } from "./constants";
import { connection } from "./solana";

/**
 * Find program authority PDA address
 * @returns [authority, bump]
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find program state PDA address
 * @returns [state, bump]
 */
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Get token balance for an account
 * @param tokenAccount The token account address
 * @returns Balance as a number with decimals
 */
export async function getTokenBalance(tokenAccount: PublicKey): Promise<number> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);

    if (!accountInfo) {
      console.log(`Token account ${tokenAccount.toString()} does not exist`);
      return 0;
    }

    // Parse token account data to get balance
    // Token account data layout: 
    // - 32 bytes: mint
    // - 32 bytes: owner
    // - 8 bytes: amount
    // - remaining: other data
    const data = accountInfo.data;
    const balance = data.slice(64, 72); // 8 bytes for amount
    
    // Convert to number (handle BigInt for large balances)
    // Manually iterate through buffer to avoid downlevelIteration flag issues
    let hexString = '0x';
    for (let i = balance.length - 1; i >= 0; i--) {
      hexString += balance[i].toString(16).padStart(2, '0');
    }
    const amount = Number(BigInt(hexString));
    
    // For simplicity, assuming 9 decimals for YOT/YOS
    const DECIMALS = 9;
    return amount / Math.pow(10, DECIMALS);
  } catch (error) {
    console.error("Error getting token balance:", error);
    // Return 0 as a fallback if there's a connection issue
    return 0;
  }
}

/**
 * Fund program token account with specified amount
 * @param wallet Connected wallet
 * @param mintAddress Token mint address
 * @param amount Amount to transfer (in tokens, not raw amount)
 * @returns Transaction signature
 */
export async function fundProgramTokenAccount(
  wallet: any,
  mintAddress: PublicKey,
  amount: number,
): Promise<string> {
  try {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Find program authority
    const [programAuthority] = findProgramAuthorityAddress();
    console.log("Program authority:", programAuthority.toString());

    // Convert amount to raw amount (assuming 9 decimals for YOT/YOS)
    const DECIMALS = 9;
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));
    console.log(`Funding ${amount} tokens (${rawAmount} raw amount)`);

    // Get token accounts
    // Use the imported connection
    
    // Source: Admin's associated token account
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      wallet.publicKey,
      false // allowOwnerOffCurve = false for normal wallets
    );
    
    // Destination: Program authority's associated token account
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      programAuthority,
      true // allowOwnerOffCurve = true for PDAs
    );
    
    console.log("Source:", sourceTokenAccount.toString());
    console.log("Destination:", destinationTokenAccount.toString());

    // Check if token account exists
    const accountInfo = await connection.getAccountInfo(destinationTokenAccount);
    
    if (!accountInfo) {
      throw new Error(
        `Program token account does not exist. Please run create-program-token-accounts script first.`
      );
    }

    // Create transfer instruction
    const transferIx = createTransferInstruction(
      sourceTokenAccount,
      destinationTokenAccount,
      wallet.publicKey,
      rawAmount
    );

    // Build and send transaction
    const transaction = new Transaction().add(transferIx);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    // Sign and send transaction
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature);
    
    console.log("Transfer successful:", signature);
    return signature;
  } catch (error) {
    console.error("Error funding program token account:", error);
    throw error;
  }
}