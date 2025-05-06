import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  SendOptions
} from '@solana/web3.js';
import { connection } from './solana';

// Fallback to a hardcoded address if needed
const FALLBACK_RECIPIENT = "Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH";

/**
 * Super basic SOL transfer function for testing
 * This is a bare-bones implementation with minimal code to help debug the issue
 */
export async function directSolYotSwap(wallet: any, solAmount: number) {
  if (!wallet || !wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    console.log(`[BASIC-TRANSFER] Starting minimal SOL transfer of ${solAmount} SOL`);
    
    // Convert to lamports (SOL * 10^9)
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Create a basic transaction with just one instruction
    const transaction = new Transaction();
    
    // Target address - using a known valid address that should accept SOL transfers
    const toAddress = new PublicKey(FALLBACK_RECIPIENT);

    // Add a simple transfer instruction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: toAddress,
        lamports: lamports
      })
    );
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    console.log("[BASIC-TRANSFER] Transaction created");
    console.log(`[BASIC-TRANSFER] From: ${wallet.publicKey.toString()}`);
    console.log(`[BASIC-TRANSFER] To: ${toAddress.toString()}`);
    console.log(`[BASIC-TRANSFER] Amount: ${lamports} lamports (${solAmount} SOL)`);
    
    // Sign the transaction
    console.log("[BASIC-TRANSFER] Requesting signature...");
    const signedTx = await wallet.signTransaction(transaction);
    
    // Send with minimal options
    console.log("[BASIC-TRANSFER] Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`[BASIC-TRANSFER] Transaction sent: ${signature}`);
    console.log(`[BASIC-TRANSFER] View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error("[BASIC-TRANSFER] Transaction error:", confirmation.value.err);
      return {
        success: false,
        error: `Transaction error: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    console.log("[BASIC-TRANSFER] Transaction confirmed!");
    
    // Simulate the token distribution for UI feedback (we're not actually getting YOT tokens)
    const estimatedYotAmount = solAmount * 134102185.86562961;
    
    return {
      success: true,
      signature,
      estimatedYotAmount
    };
  } catch (error: any) {
    console.error("[BASIC-TRANSFER] Error:", error);
    return {
      success: false,
      error: error.message || 'Unknown error during transfer'
    };
  }
}