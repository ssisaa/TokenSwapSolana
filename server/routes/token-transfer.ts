import { Router } from "express";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  getAccount
} from '@solana/spl-token';
import { z } from 'zod';

// Token addresses for test tokens
const TEST_TOKENS = {
  MTA: 'MTAwpfGYQbnJkjB2iHUNpGV4yxkpJpgAQNHpg3ZJXKd',
  SAMX: 'SAMXjJJa4XShbsyK3ZK1qUKgHs45u8YUySGBbKctwKX',
  XAR: 'XAR18RSUr4pRGnmmM5Zz9vAz3EXmvWPx7cMuFB8mvCh',
  XMP: 'XMP9SXVv3Kj6JcnJEyLaQzYEuWEGsHjhJNpkha2Vk5M',
  RAMX: 'RAMXd3mgY5XFyWbfgNh9LT7BcuW5w7jqRFgNkwZEhhsu',
  TRAXX: 'TRXXpN1Y4tAYcfp3QxCKLeVDvUnjGWQvA2HTQ5VTytA',
};

// Define tokens decimals
const TOKEN_DECIMALS = {
  MTA: 9,
  SAMX: 9,
  XAR: 9,
  XMP: 9,
  RAMX: 9,
  TRAXX: 9,
};

// Admin keypair for sending tokens - in a production app, this would be stored securely
// For demo purposes, we're using a hardcoded key (this should NEVER be done in production)
// This is the AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ wallet
const ADMIN_KEYPAIR = Keypair.generate(); // Replace with actual admin keypair in production

// Solana connection - use devnet for development
const SOLANA_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_ENDPOINT);

// Transfer request validation schema
const transferRequestSchema = z.object({
  recipient: z.string().length(44), // Solana address is 44 characters
  tokens: z.array(z.enum(['MTA', 'SAMX', 'XAR', 'XMP', 'RAMX', 'TRAXX'])),
  amount: z.number().positive().default(1000)
});

export const tokenTransferRouter = Router();

// Endpoint for transferring tokens to a recipient
tokenTransferRouter.post('/transfer', async (req, res) => {
  try {
    // Validate request
    const validatedData = transferRequestSchema.parse(req.body);
    const { recipient, tokens, amount } = validatedData;
    
    // Result tracking
    const results: Record<string, {
      success: boolean;
      message: string;
      signature?: string;
    }> = {};
    
    // Recipient public key
    const recipientPublicKey = new PublicKey(recipient);
    
    // Process each requested token
    for (const tokenSymbol of tokens) {
      try {
        // Get token details
        const tokenMintAddress = TEST_TOKENS[tokenSymbol as keyof typeof TEST_TOKENS];
        const tokenDecimals = TOKEN_DECIMALS[tokenSymbol as keyof typeof TOKEN_DECIMALS];
        const tokenMint = new PublicKey(tokenMintAddress);
        
        // Calculate token amount with decimals
        const tokenAmount = Math.floor(amount * Math.pow(10, tokenDecimals));
        
        // Get admin token account
        const adminTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          ADMIN_KEYPAIR.publicKey
        );
        
        // Get or create recipient token account
        const recipientTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          recipientPublicKey
        );
        
        // Create transaction
        const transaction = new Transaction();
        
        // Check if recipient token account exists
        let recipientAccountExists = false;
        try {
          await getAccount(connection, recipientTokenAccount);
          recipientAccountExists = true;
        } catch (e) {
          // Account doesn't exist, add instruction to create it
          transaction.add(
            createAssociatedTokenAccountInstruction(
              ADMIN_KEYPAIR.publicKey,
              recipientTokenAccount,
              recipientPublicKey,
              tokenMint
            )
          );
        }
        
        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            adminTokenAccount,
            recipientTokenAccount,
            ADMIN_KEYPAIR.publicKey,
            BigInt(tokenAmount)
          )
        );
        
        // Set recent blockhash and fee payer
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = ADMIN_KEYPAIR.publicKey;
        
        // Sign and send transaction
        transaction.sign(ADMIN_KEYPAIR);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        
        // Confirm transaction
        await connection.confirmTransaction(signature);
        
        // Record success
        results[tokenSymbol] = {
          success: true,
          message: `Successfully transferred ${amount} ${tokenSymbol} tokens`,
          signature
        };
      } catch (error: any) {
        // Record failure
        results[tokenSymbol] = {
          success: false,
          message: error.message || `Failed to transfer ${tokenSymbol} tokens`
        };
      }
    }
    
    // Return results
    res.json({
      success: Object.values(results).some(r => r.success),
      results
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid request'
    });
  }
});

// Endpoint to check token balances
tokenTransferRouter.get('/balances/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const walletPublicKey = new PublicKey(address);
    
    const balances: Record<string, number> = {};
    
    for (const [tokenSymbol, tokenMintAddress] of Object.entries(TEST_TOKENS)) {
      try {
        const tokenMint = new PublicKey(tokenMintAddress);
        const tokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          walletPublicKey
        );
        
        try {
          const accountInfo = await getAccount(connection, tokenAccount);
          const decimals = TOKEN_DECIMALS[tokenSymbol as keyof typeof TOKEN_DECIMALS];
          const balance = Number(accountInfo.amount) / Math.pow(10, decimals);
          balances[tokenSymbol] = balance;
        } catch (e) {
          // Account doesn't exist or has no balance
          balances[tokenSymbol] = 0;
        }
      } catch (e) {
        balances[tokenSymbol] = 0;
      }
    }
    
    // Also get SOL balance
    const solBalance = await connection.getBalance(walletPublicKey);
    balances.SOL = solBalance / LAMPORTS_PER_SOL;
    
    res.json({
      success: true,
      address,
      balances
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get balances'
    });
  }
});