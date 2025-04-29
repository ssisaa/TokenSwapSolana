import { PublicKey, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import { YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { connection } from '@/lib/completeSwap';

/**
 * Creates a YOS token account for the user
 * @param wallet The connected wallet
 * @returns Success status and transaction signature
 */
export async function createYosTokenAccount(wallet: any) {
  if (!wallet || !wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  try {
    // Create the ATA for YOS
    const yosTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      wallet.publicKey
    );
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(yosTokenAccount);
    
    if (accountInfo) {
      return {
        success: true,
        message: "YOS token account already exists",
        exists: true
      };
    }
    
    // Create transaction to create the ATA
    const transaction = new Transaction();
    
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        yosTokenAccount, // associatedToken
        wallet.publicKey, // owner
        new PublicKey(YOS_TOKEN_ADDRESS) // mint
      )
    );
    
    // Sign and send transaction
    transaction.feePayer = wallet.publicKey;
    let blockhashResponse = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhashResponse.blockhash;
    
    let signed = await wallet.signTransaction(transaction);
    let signature = await connection.sendRawTransaction(signed.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash: blockhashResponse.blockhash,
      lastValidBlockHeight: blockhashResponse.lastValidBlockHeight
    });
    
    return {
      success: true,
      message: "YOS token account created successfully",
      exists: false,
      signature,
      address: yosTokenAccount.toString()
    };
  } catch (error) {
    console.error('Error creating YOS token account:', error);
    throw error;
  }
}

/**
 * Transfers YOS tokens from admin to a recipient
 * @param wallet The admin wallet
 * @param recipient The recipient public key
 * @param amount Amount of YOS to send
 * @returns Success status and transaction details
 */
export async function transferYosTokensFromAdmin(wallet: any, recipient: PublicKey, amount: number) {
  if (!wallet || !wallet.publicKey) {
    throw new Error('Wallet not connected');
  }
  
  // Check if the sender is the admin
  const isAdmin = wallet.publicKey.toString() === "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ";
  
  if (!isAdmin) {
    throw new Error('Only admin can distribute initial YOS tokens');
  }
  
  try {
    // Get sender's YOS token account (admin)
    const senderTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      wallet.publicKey
    );
    
    // Get recipient's YOS token account
    const recipientTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      recipient
    );
    
    // Check if sender has enough tokens
    const senderInfo = await connection.getTokenAccountBalance(senderTokenAccount);
    const senderBalance = senderInfo.value.uiAmount || 0;
    
    if (senderBalance < amount) {
      throw new Error(`Admin doesn't have enough YOS tokens. Available: ${senderBalance}`);
    }
    
    // Check if recipient's token account exists
    const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
    
    // Create transaction
    const transaction = new Transaction();
    
    // If recipient account doesn't exist, create it
    if (!accountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          recipientTokenAccount, // associatedToken
          recipient, // owner
          new PublicKey(YOS_TOKEN_ADDRESS) // mint
        )
      );
    }
    
    // Calculate amount with decimals
    const decimalAmount = amount * 1e9; // YOS has 9 decimals
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        wallet.publicKey,
        decimalAmount
      )
    );
    
    // Sign and send transaction
    transaction.feePayer = wallet.publicKey;
    let blockhashResponse = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhashResponse.blockhash;
    
    let signed = await wallet.signTransaction(transaction);
    let signature = await connection.sendRawTransaction(signed.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash: blockhashResponse.blockhash,
      lastValidBlockHeight: blockhashResponse.lastValidBlockHeight
    });
    
    return {
      success: true,
      signature,
      amount,
      recipient: recipient.toString()
    };
  } catch (error) {
    console.error('Error distributing YOS tokens:', error);
    throw error;
  }
}