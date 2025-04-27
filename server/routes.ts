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

  // Staking API Routes
  app.get('/api/staking/info', async (req, res) => {
    try {
      const { wallet } = req.query;
      
      if (!wallet || typeof wallet !== 'string') {
        return res.status(400).json({ message: 'Wallet address is required' });
      }
      
      // Security: Validate wallet address format (basic check)
      if (wallet.length < 32 || wallet.length > 44) {
        return res.status(400).json({
          message: 'Invalid wallet address format',
          error: 'Please provide a valid wallet address'
        });
      }
      
      // Security: Sanitize the wallet address input
      const sanitizedWallet = wallet.trim();
      
      try {
        // Get staking data from database with security measures
        const stakingData = await storage.getStakingData(sanitizedWallet);
        
        if (!stakingData) {
          return res.json({
            stakedAmount: 0,
            rewardsEarned: 0,
            startTimestamp: null,
            harvestedRewards: 0
          });
        }
        
        // Security: Only return necessary data (avoid information leakage)
        const safeResponse = {
          stakedAmount: stakingData.stakedAmount || 0,
          rewardsEarned: stakingData.rewardsEarned || 0,
          startTimestamp: stakingData.startTimestamp || null,
          harvestedRewards: stakingData.harvestedRewards || 0,
          // Include only the admin settings needed for calculations
          currentSettings: stakingData.currentSettings ? {
            stakeRatePerSecond: stakingData.currentSettings.stakeRatePerSecond,
            harvestThreshold: stakingData.currentSettings.harvestThreshold
          } : null
        };
        
        res.json(safeResponse);
      } catch (dbError) {
        console.error('Database error fetching staking data:', dbError);
        // Security: Don't expose internal error details to client
        return res.status(500).json({
          message: 'Unable to retrieve staking information',
          error: 'Please try again later'
        });
      }
    } catch (error) {
      console.error('Error fetching staking info:', error);
      // Security: Return generic error message
      res.status(500).json({
        message: 'Failed to fetch staking information',
        error: 'An unexpected error occurred'
      });
    }
  });
  
  app.post('/api/staking/stake', async (req, res) => {
    try {
      const { walletAddress, stakedAmount, startTimestamp } = req.body;
      
      if (!walletAddress || !stakedAmount || !startTimestamp) {
        return res.status(400).json({ message: 'Missing required staking data' });
      }
      
      // Ensure timestamp is a number
      const timestamp = typeof startTimestamp === 'number' 
        ? startTimestamp 
        : new Date(startTimestamp).getTime();
      
      // Validate and sanitize inputs
      const sanitizedWalletAddress = walletAddress.trim();
      const sanitizedAmount = parseFloat(stakedAmount.toString());
      
      if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      
      // Save staking data to database with proper formatting
      await storage.saveStakingData({
        walletAddress: sanitizedWalletAddress,
        stakedAmount: sanitizedAmount,
        startTimestamp: timestamp
      });
      
      res.json({ success: true, message: 'Staking data saved successfully' });
    } catch (error) {
      console.error('Error saving staking data:', error);
      res.status(500).json({
        message: 'Failed to save staking data',
        error: 'An error occurred while processing your request' // Generic error for security
      });
    }
  });
  
  app.post('/api/staking/unstake', async (req, res) => {
    try {
      const { wallet } = req.query;
      
      if (!wallet || typeof wallet !== 'string') {
        return res.status(400).json({ message: 'Wallet address is required' });
      }
      
      // Security: Validate wallet address format
      if (wallet.length < 32 || wallet.length > 44) {
        return res.status(400).json({
          message: 'Invalid wallet address format',
          error: 'Please provide a valid wallet address'
        });
      }
      
      // Security: Sanitize the wallet address input
      const sanitizedWallet = wallet.trim();
      
      try {
        // Security: Verify wallet exists before allowing unstake
        const stakingData = await storage.getStakingData(sanitizedWallet);
        if (!stakingData || stakingData.stakedAmount <= 0) {
          return res.status(400).json({
            message: 'No staked tokens found',
            error: 'You do not have any tokens staked from this wallet'
          });
        }
        
        // Remove staking data from database
        await storage.removeStakingData(sanitizedWallet);
        
        res.json({ 
          success: true, 
          message: 'Successfully unstaked',
          // Provide some data to confirm what was unstaked
          unstaked: {
            amount: stakingData.stakedAmount,
            wallet: sanitizedWallet.substring(0, 6) + '...' + sanitizedWallet.substring(sanitizedWallet.length - 4) // Show partial wallet for security
          }
        });
      } catch (dbError) {
        console.error('Database error during unstaking:', dbError);
        // Security: Don't expose internal error details to client
        return res.status(500).json({
          message: 'Unable to process unstaking request',
          error: 'Please try again later'
        });
      }
    } catch (error) {
      console.error('Error unstaking:', error);
      // Security: Return generic error message
      res.status(500).json({
        message: 'Failed to unstake',
        error: 'An unexpected error occurred'
      });
    }
  });
  
  app.post('/api/staking/harvest', async (req, res) => {
    try {
      const { wallet } = req.query;
      
      if (!wallet || typeof wallet !== 'string') {
        return res.status(400).json({ message: 'Wallet address is required' });
      }
      
      // Security: Validate wallet address format
      if (wallet.length < 32 || wallet.length > 44) {
        return res.status(400).json({
          message: 'Invalid wallet address format',
          error: 'Please provide a valid wallet address'
        });
      }
      
      // Security: Sanitize the wallet address input
      const sanitizedWallet = wallet.trim();
      
      try {
        // Security: Verify wallet exists and has rewards before harvesting
        const stakingData = await storage.getStakingData(sanitizedWallet);
        if (!stakingData || stakingData.stakedAmount <= 0) {
          return res.status(400).json({
            message: 'No staked tokens found',
            error: 'You do not have any tokens staked from this wallet'
          });
        }
        
        // Get admin settings for harvest threshold check
        const adminSettings = await storage.getAdminSettings();
        const harvestThreshold = adminSettings?.harvestThreshold 
          ? parseFloat(adminSettings.harvestThreshold.toString()) 
          : 100;
        
        // Check if rewards are above threshold
        if (stakingData.rewardsEarned < harvestThreshold) {
          return res.status(400).json({
            message: 'Below harvest threshold',
            error: `You need at least ${harvestThreshold} YOS tokens to harvest. You currently have ${stakingData.rewardsEarned} YOS.`
          });
        }
        
        // Update harvest data in database
        await storage.harvestRewards(sanitizedWallet);
        
        res.json({ 
          success: true, 
          message: 'Successfully harvested rewards',
          // Provide some data to confirm what was harvested
          harvested: {
            amount: stakingData.rewardsEarned,
            wallet: sanitizedWallet.substring(0, 6) + '...' + sanitizedWallet.substring(sanitizedWallet.length - 4) // Show partial wallet for security
          }
        });
      } catch (dbError) {
        console.error('Database error during harvesting:', dbError);
        // Security: Don't expose internal error details to client
        return res.status(500).json({
          message: 'Unable to process harvesting request',
          error: 'Please try again later'
        });
      }
    } catch (error) {
      console.error('Error harvesting rewards:', error);
      // Security: Return generic error message
      res.status(500).json({
        message: 'Failed to harvest rewards',
        error: 'An unexpected error occurred'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
