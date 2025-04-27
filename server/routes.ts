import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  Connection, 
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  getMint, 
  getAccount, 
  getAssociatedTokenAddress
} from "@solana/spl-token";

// Constants
const CLUSTER = 'devnet';
const ENDPOINT = clusterApiUrl(CLUSTER);
const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

// Create a connection to the Solana cluster
const connection = new Connection(ENDPOINT, 'confirmed');

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  const { isAuthenticated } = setupAuth(app);
  // API route to get token information
  app.get('/api/token/:address', async (req, res) => {
    try {
      const { address } = req.params;
      
      // Validate the address
      let publicKey;
      try {
        publicKey = new PublicKey(address);
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid token address' 
        });
      }
      
      // Get the token mint info
      const mintInfo = await getMint(connection, publicKey);
      
      res.json({
        address,
        decimals: mintInfo.decimals,
        supply: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals),
        mintAuthority: mintInfo.mintAuthority?.toBase58() || null,
        freezeAuthority: mintInfo.freezeAuthority?.toBase58() || null,
      });
    } catch (error) {
      console.error('Error fetching token info:', error);
      res.status(500).json({ 
        message: 'Failed to fetch token information',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // API route to get pool information
  app.get('/api/pool', async (req, res) => {
    try {
      // Get SOL balance of the pool
      const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
      const solBalance = await connection.getBalance(poolSolAccount);
      
      // Get YOT balance of the pool
      const poolAuthority = new PublicKey(POOL_AUTHORITY);
      const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
      
      const yotTokenAccount = await getAssociatedTokenAddress(
        yotTokenMint,
        poolAuthority
      );
      
      let yotBalance = 0;
      
      try {
        const tokenAccountInfo = await getAccount(connection, yotTokenAccount);
        const mintInfo = await getMint(connection, yotTokenMint);
        yotBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      } catch (error) {
        console.error('Error getting YOT balance:', error);
      }
      
      res.json({
        authority: POOL_AUTHORITY,
        solAccount: POOL_SOL_ACCOUNT,
        solBalance: solBalance / LAMPORTS_PER_SOL,
        yotBalance
      });
    } catch (error) {
      console.error('Error fetching pool info:', error);
      res.status(500).json({ 
        message: 'Failed to fetch pool information',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // API route to get recent transactions
  app.get('/api/transactions/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const { limit = '10' } = req.query;
      
      // Validate the address
      let publicKey;
      try {
        publicKey = new PublicKey(address);
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid address' 
        });
      }
      
      // Get recent transactions
      const transactions = await connection.getSignaturesForAddress(
        publicKey, 
        { limit: parseInt(limit as string) }
      );
      
      // Get details for each transaction
      const transactionDetails = await Promise.all(
        transactions.map(async (tx) => {
          try {
            const txDetails = await connection.getTransaction(tx.signature, {
              maxSupportedTransactionVersion: 0,
            });
            
            // Try to determine if this was a swap transaction
            let isSwap = false;
            let fromToken = '';
            let toToken = '';
            let fromAmount = 0;
            let toAmount = 0;
            let fee = 0;
            
            if (txDetails) {
              // Check if transaction involved the pool SOL account
              const poolSolAccountStr = POOL_SOL_ACCOUNT;
              const accountKeys = txDetails.transaction.message.accountKeys.map(key => 
                key.toBase58()
              );
              
              isSwap = accountKeys.includes(poolSolAccountStr);
              
              if (isSwap) {
                // Further analyze to determine swap details
                const hasYotTransfer = txDetails.meta?.logMessages?.some(
                  log => log.includes('Transfer') && log.includes(YOT_TOKEN_ADDRESS)
                );
                
                if (hasYotTransfer) {
                  // SOL -> YOT or YOT -> SOL
                  fromToken = accountKeys.indexOf(poolSolAccountStr) < accountKeys.indexOf(address) 
                    ? 'YOT' : 'SOL';
                  toToken = fromToken === 'SOL' ? 'YOT' : 'SOL';
                  
                  // Simplified fee calculation
                  fee = 0.000005; // A placeholder
                }
              }
            }
            
            return {
              signature: tx.signature,
              timestamp: tx.blockTime || 0,
              status: tx.confirmationStatus,
              isSwap,
              fromToken,
              toToken,
              fromAmount,
              toAmount,
              fee
            };
          } catch (error) {
            console.error(`Error fetching transaction ${tx.signature}:`, error);
            return null;
          }
        })
      );
      
      res.json(transactionDetails.filter(Boolean));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ 
        message: 'Failed to fetch transactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // API route to get wallet balances
  app.get('/api/balances/:address', async (req, res) => {
    try {
      const { address } = req.params;
      
      // Validate the address
      let publicKey;
      try {
        publicKey = new PublicKey(address);
      } catch (error) {
        return res.status(400).json({ 
          message: 'Invalid wallet address' 
        });
      }
      
      // Get SOL balance
      const solBalance = await connection.getBalance(publicKey);
      
      // Get YOT balance
      const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const yotTokenAccount = await getAssociatedTokenAddress(
        yotTokenMint,
        publicKey
      );
      
      let yotBalance = 0;
      try {
        const tokenAccountInfo = await getAccount(connection, yotTokenAccount);
        const mintInfo = await getMint(connection, yotTokenMint);
        yotBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      } catch (error) {
        // If the account doesn't exist, balance is 0
      }
      
      // Get YOS balance
      const yosTokenMint = new PublicKey(YOS_TOKEN_ADDRESS);
      const yosTokenAccount = await getAssociatedTokenAddress(
        yosTokenMint,
        publicKey
      );
      
      let yosBalance = 0;
      try {
        const tokenAccountInfo = await getAccount(connection, yosTokenAccount);
        const mintInfo = await getMint(connection, yosTokenMint);
        yosBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      } catch (error) {
        // If the account doesn't exist, balance is 0
      }
      
      // Calculate SOL USD value (mock for now)
      const solPrice = 100; // Mock SOL price in USD
      const solUsdValue = (solBalance / LAMPORTS_PER_SOL) * solPrice;
      
      res.json({
        sol: solBalance / LAMPORTS_PER_SOL,
        solUsd: solUsdValue,
        yot: yotBalance,
        yos: yosBalance
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
      res.status(500).json({ 
        message: 'Failed to fetch wallet balances',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
