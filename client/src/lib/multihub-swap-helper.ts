/**
 * Multihub Swap Helper Functions
 * Bridge between Raydium and our MultihubSwap contract
 */

import { SwapProvider } from './multi-hub-swap';
import {
  Connection,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  TransactionInstruction
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';

// Devnet endpoint
const ENDPOINT = 'https://api.devnet.solana.com';

// Token addresses
const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';
const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Program ID of multihub swap contract
const MULTIHUB_SWAP_PROGRAM_ID = '3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps';

// Define class to implement the required methods for swap
class MultihubSwapClient implements SwapProvider {
  connection: Connection;

  constructor() {
    this.connection = new Connection(ENDPOINT);
  }

  async estimateSwap(
    fromToken: any,
    toToken: any,
    amount: number,
    slippage: number = 0.01
  ): Promise<any> {
    // This would be implemented to estimate the swap
    throw new Error("Method not implemented");
  }

  async executeSwap(
    wallet: any,
    fromToken: any,
    toToken: any,
    amount: number,
    minAmountOut: number
  ): Promise<any> {
    if (!wallet?.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Use direct import instead of dynamic import
    // We'll implement the functionality here since we can't dynamically import the class
    const multihubSwap = {
      createSwapTransaction: async (wallet: any, fromToken: any, toToken: any, amount: number, minAmountOut: number) => {
        // This is a simplified version that matches what's in multihub-contract.ts
        const { Connection, Transaction, PublicKey, SystemProgram } = await import('@solana/web3.js');
        const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = await import('@solana/spl-token');
        
        const connection = new Connection(ENDPOINT);
        
        // Program IDs
        const MULTIHUB_SWAP_PROGRAM_ID = new PublicKey('3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps');
        const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
        const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
        const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
        
        // Create a new transaction
        const transaction = new Transaction();
        
        // Convert token addresses to PublicKey objects
        const fromTokenMint = new PublicKey(fromToken.address);
        const toTokenMint = new PublicKey(toToken.address);
        
        // Get ATA for YOT, SOL is handled differently
        const fromTokenAccount = fromToken.address === SOL_TOKEN_MINT.toString() 
          ? wallet.publicKey 
          : await getAssociatedTokenAddress(fromTokenMint, wallet.publicKey);
          
        const toTokenAccount = toToken.address === SOL_TOKEN_MINT.toString()
          ? wallet.publicKey
          : await getAssociatedTokenAddress(toTokenMint, wallet.publicKey);
          
        // For YOS cashback, we also need YOS token account
        const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);
        
        // Create instruction data with proper size for the instruction and two 64-bit integers
        const instructionData = Buffer.alloc(17);
        
        // Write the instruction (1 = swap)
        instructionData.writeUInt8(1, 0);
        
        // Write the amount as a 64-bit integer (needs 8 bytes)
        const amountRaw = Math.floor(amount * Math.pow(10, fromToken.decimals));
        instructionData.writeBigUInt64LE(BigInt(amountRaw), 1);
        
        // Write the min output amount as a 64-bit integer (needs 8 bytes)
        // Offset needs to be 9 (1 byte for instruction + 8 bytes for first amount)
        const minAmountOutRaw = Math.floor(minAmountOut * Math.pow(10, toToken.decimals));
        instructionData.writeBigUInt64LE(BigInt(minAmountOutRaw), 9);
        
        // Setup account metas for the instruction
        const accountMetas = [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
          { pubkey: toTokenAccount, isSigner: false, isWritable: true },
          { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
          { pubkey: fromTokenMint, isSigner: false, isWritable: false },
          { pubkey: toTokenMint, isSigner: false, isWritable: false },
          { pubkey: YOS_TOKEN_MINT, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];
        
        // Create the swap instruction
        const swapInstruction = {
          programId: MULTIHUB_SWAP_PROGRAM_ID,
          keys: accountMetas,
          data: instructionData
        };
        
        // Add it to the transaction
        transaction.add(swapInstruction);
        
        // Return the transaction for signing
        return transaction;
      }
    };

    console.log(`Executing multi-hub swap: ${amount} ${fromToken.symbol} -> ${toToken.symbol}`);
    console.log(`This will include 20% liquidity contribution and 5% YOS cashback`);

    // Create the swap transaction using the contract
    const transaction = await multihubSwap.createSwapTransaction(
      wallet,
      fromToken,
      toToken,
      amount,
      minAmountOut
    );

    // Sign and send the transaction
    try {
      // Ensure accounts exist first (especially for token accounts)
      const { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = await import('@solana/spl-token');
      const { Connection, Transaction, PublicKey, SystemProgram } = await import('@solana/web3.js');
      
      // Check and create token accounts if needed
      const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
      const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
      const toTokenMint = new PublicKey(toToken.address);
      const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);
      const toTokenAccount = toToken.address === 'So11111111111111111111111111111111111111112' 
        ? wallet.publicKey 
        : await getAssociatedTokenAddress(toTokenMint, wallet.publicKey);
      
      // Check if YOS token account exists
      try {
        const yosAccountInfo = await this.connection.getAccountInfo(yosTokenAccount);
        if (!yosAccountInfo) {
          console.log("Creating YOS token account...");
          const createYosAtaIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            yosTokenAccount, // ata
            wallet.publicKey, // owner
            YOS_TOKEN_MINT // mint
          );
          transaction.add(createYosAtaIx);
        }
      } catch (err) {
        console.log("Creating YOS token account...");
        const createYosAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          yosTokenAccount, // ata
          wallet.publicKey, // owner
          YOS_TOKEN_MINT // mint
        );
        transaction.add(createYosAtaIx);
      }
      
      // Check if destination token account exists (if not SOL)
      if (toToken.address !== 'So11111111111111111111111111111111111111112') {
        try {
          const toAccountInfo = await this.connection.getAccountInfo(toTokenAccount);
          if (!toAccountInfo) {
            console.log(`Creating ${toToken.symbol} token account...`);
            const createToAtaIx = createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              toTokenAccount, // ata
              wallet.publicKey, // owner
              toTokenMint // mint
            );
            transaction.add(createToAtaIx);
          }
        } catch (err) {
          console.log(`Creating ${toToken.symbol} token account...`);
          const createToAtaIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            toTokenAccount, // ata
            wallet.publicKey, // owner
            toTokenMint // mint
          );
          transaction.add(createToAtaIx);
        }
      }
      
      // Set recent blockhash and fee payer
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      
      console.log("Sending transaction with token account checks...");
      const signature = await wallet.sendTransaction(transaction, this.connection);
      console.log("Transaction sent with signature:", signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return {
        signature,
        success: true,
        fromAmount: amount,
        fromToken: fromToken.symbol,
        toAmount: minAmountOut,
        toToken: toToken.symbol
      };
    } catch (error) {
      console.error("Transaction failed:", error);
      
      // More descriptive error messages
      if (error.message && error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds to complete the transaction");
      } else if (error.message && error.message.includes("already in use")) {
        throw new Error("Transaction nonce already used. Please try again.");
      } else if (error.message && error.message.includes("blockhash")) {
        throw new Error("Blockhash expired. Please try again.");
      } else {
        throw new Error(`Swap failed: ${error.message || "Unexpected wallet error"}`);
      }
    }
  }
}

/**
 * Execute a swap through the multi-hub contract
 * This function is exported for use by other modules like the Raydium integration
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: any,
  toToken: any,
  amount: number,
  minAmountOut: number
): Promise<any> {
  try {
    const multihubClient = new MultihubSwapClient();
    
    // Execute the swap
    const result = await multihubClient.executeSwap(
      wallet,
      fromToken,
      toToken,
      amount,
      minAmountOut
    );
    
    return result;
  } catch (err) {
    console.error("Error executing multi-hub swap:", err);
    throw err;
  }
}