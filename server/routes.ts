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
import { WebSocketServer, WebSocket } from 'ws';
import { LRUCache } from "../client/src/lib/lruCache";

// Load configuration from app.config.json
import fs from 'fs';
import path from 'path';

// Load configuration from app.config.json in the project root
const appConfigPath = path.join(process.cwd(), 'app.config.json');
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));

// Constants from central configuration
const CLUSTER = appConfig.network;
const RPC_ENDPOINTS = [
  clusterApiUrl(CLUSTER),
  'https://rpc-devnet.helius.xyz/?api-key=15319bf6-5525-43d0-8cdc-17f54a2c452a',
  'https://rpc.ankr.com/solana_devnet'
];
const YOT_TOKEN_ADDRESS = appConfig.tokens.YOT;
const YOS_TOKEN_ADDRESS = appConfig.tokens.YOS;
const POOL_AUTHORITY = appConfig.accounts.poolAuthority;
const POOL_SOL_ACCOUNT = appConfig.accounts.poolSol;

// Connection manager for Solana RPC
class SolanaConnectionManager {
  private static instance: SolanaConnectionManager;
  private connections: Connection[] = [];
  private currentIndex = 0;
  private requestCount = 0;
  private cache = {
    poolData: new LRUCache<string, any>(10, 30000), // 30 seconds
    accountInfo: new LRUCache<string, any>(100, 10000), // 10 seconds
    tokenAccounts: new LRUCache<string, any>(100, 15000) // 15 seconds
  };
  
  private constructor() {
    // Initialize connections to all endpoints
    RPC_ENDPOINTS.forEach(endpoint => {
      this.connections.push(new Connection(endpoint, 'confirmed'));
    });
    
    // Set up periodic cache cleanup
    setInterval(() => {
      this.cache.poolData.cleanup();
      this.cache.accountInfo.cleanup();
      this.cache.tokenAccounts.cleanup();
    }, 60000); // Every minute
  }
  
  public static getInstance(): SolanaConnectionManager {
    if (!SolanaConnectionManager.instance) {
      SolanaConnectionManager.instance = new SolanaConnectionManager();
    }
    return SolanaConnectionManager.instance;
  }
  
  public getConnection(): Connection {
    // Basic round-robin with request counting for monitoring
    this.requestCount++;
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return this.connections[this.currentIndex];
  }
  
  public getCache(type: 'poolData' | 'accountInfo' | 'tokenAccounts'): LRUCache<string, any> {
    return this.cache[type];
  }
  
  public getRequestCount(): number {
    return this.requestCount;
  }
}

// Create a singleton connection manager
const connectionManager = SolanaConnectionManager.getInstance();

// Get a connection from the manager
const getConnection = () => connectionManager.getConnection();

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve app.config.json from project root
  app.get('/app.config.json', (req, res) => {
    res.sendFile('app.config.json', { root: '.' });
  });
  // Add HTTP fallback route for pool data with caching
  app.get('/api/pool-data', async (req, res) => {
    try {
      const cacheKey = 'pool_data';
      const poolDataCache = connectionManager.getCache('poolData');
      
      // Check if we have cached data
      const cachedData = poolDataCache.get(cacheKey);
      if (cachedData) {
        // Return cached data
        return res.json(cachedData);
      }
      
      // Get a connection from the manager
      const conn = getConnection();
      
      // Get SOL balance
      const solBalance = await conn.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
      
      // Get YOT token account
      const yotTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(YOT_TOKEN_ADDRESS),
        new PublicKey(POOL_AUTHORITY)
      );
      const yotAccount = await getAccount(conn, yotTokenAccount);
      const yotMint = await getMint(conn, new PublicKey(YOT_TOKEN_ADDRESS));
      const YOT_DECIMALS = yotMint.decimals;
      const yotBalance = Number(yotAccount.amount) / Math.pow(10, YOT_DECIMALS);
      
      // Get YOS token account
      const yosTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(YOS_TOKEN_ADDRESS),
        new PublicKey(POOL_AUTHORITY)
      );
      
      let yosBalance = 0;
      try {
        const yosAccount = await getAccount(conn, yosTokenAccount);
        const yosMint = await getMint(conn, new PublicKey(YOS_TOKEN_ADDRESS));
        const YOS_DECIMALS = yosMint.decimals;
        yosBalance = Number(yosAccount.amount) / Math.pow(10, YOS_DECIMALS);
      } catch (error) {
        console.warn('Error fetching YOS balance, using 0:', error);
      }
      
      // Calculate total value (simple estimation)
      const totalValue = solBalance * 148.35; // Assuming $148.35 per SOL
      
      // Create response data
      const poolData = {
        sol: solBalance,
        yot: yotBalance,
        yos: yosBalance,
        totalValue,
        timestamp: Date.now()
      };
      
      // Cache the data
      poolDataCache.set(cacheKey, poolData);
      
      // Return the data
      res.json(poolData);
    } catch (error) {
      console.error('Error fetching pool data:', error);
      
      // Try to return cached data if available, even if it's stale
      const poolDataCache = connectionManager.getCache('poolData');
      const cachedData = poolDataCache.get('pool_data');
      
      if (cachedData) {
        console.log('Returning stale cached data due to error');
        return res.json({
          ...cachedData,
          stale: true
        });
      }
      
      res.status(500).json({ error: 'Failed to fetch pool data' });
    }
  });
  
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
      
      // Get a connection from the manager
      const conn = getConnection();
      
      // Get the token mint info
      const mintInfo = await getMint(conn, publicKey);
      
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

  // API route to get pool information with connection pooling
  app.get('/api/pool', async (req, res) => {
    try {
      // Get connection from the manager
      const conn = getConnection();
      
      // Get SOL balance of the pool
      const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
      const solBalance = await conn.getBalance(poolSolAccount);
      
      // Get YOT balance of the pool
      const poolAuthority = new PublicKey(POOL_AUTHORITY);
      const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
      
      const yotTokenAccount = await getAssociatedTokenAddress(
        yotTokenMint,
        poolAuthority
      );
      
      let yotBalance = 0;
      
      try {
        const tokenAccountInfo = await getAccount(conn, yotTokenAccount);
        const mintInfo = await getMint(conn, yotTokenMint);
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

  // API route to get recent transactions with connection pooling
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
      
      // Get a connection from the pool
      const conn = getConnection();
      
      // Get recent transactions
      const transactions = await conn.getSignaturesForAddress(
        publicKey, 
        { limit: parseInt(limit as string) }
      );
      
      // Get details for each transaction
      const transactionDetails = await Promise.all(
        transactions.map(async (tx: any) => {
          try {
            const txDetails = await conn.getTransaction(tx.signature, {
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
              const accountKeys = txDetails.transaction.message.accountKeys.map((key: any) => 
                key.toBase58()
              );
              
              isSwap = accountKeys.includes(poolSolAccountStr);
              
              if (isSwap) {
                // Further analyze to determine swap details
                const hasYotTransfer = txDetails.meta?.logMessages?.some(
                  (log: string) => log.includes('Transfer') && log.includes(YOT_TOKEN_ADDRESS)
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

  // API route to get wallet balances with connection pooling and caching
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
      
      // Check cache first
      const cacheKey = `balances_${address}`;
      const accountCache = connectionManager.getCache('accountInfo');
      const cachedBalances = accountCache.get(cacheKey);
      
      if (cachedBalances) {
        return res.json(cachedBalances);
      }
      
      // Get a connection from the pool
      const conn = getConnection();
      
      // Get SOL balance
      const solBalance = await conn.getBalance(publicKey);
      
      // Get YOT balance
      const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const yotTokenAccount = await getAssociatedTokenAddress(
        yotTokenMint,
        publicKey
      );
      
      let yotBalance = 0;
      try {
        const tokenAccountInfo = await getAccount(conn, yotTokenAccount);
        const mintInfo = await getMint(conn, yotTokenMint);
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
        const tokenAccountInfo = await getAccount(conn, yosTokenAccount);
        const mintInfo = await getMint(conn, yotTokenMint);
        yosBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      } catch (error) {
        // If the account doesn't exist, balance is 0
      }
      
      // Calculate SOL USD value
      const solPrice = 148.35; // SOL price in USD
      const solUsdValue = (solBalance / LAMPORTS_PER_SOL) * solPrice;
      
      const balanceData = {
        sol: solBalance / LAMPORTS_PER_SOL,
        solUsd: solUsdValue,
        yot: yotBalance,
        yos: yosBalance,
        timestamp: Date.now()
      };
      
      // Cache the result
      accountCache.set(cacheKey, balanceData);
      
      res.json(balanceData);
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
      
      // Security: Validate wallet address format
      if (walletAddress.length < 32 || walletAddress.length > 44) {
        return res.status(400).json({
          message: 'Invalid wallet address format',
          error: 'Please provide a valid wallet address'
        });
      }
      
      // Security: Validate and sanitize inputs
      const sanitizedWalletAddress = walletAddress.trim();
      
      // Security: Strictly validate amount as a number
      let sanitizedAmount: number;
      try {
        sanitizedAmount = typeof stakedAmount === 'number' 
          ? stakedAmount 
          : parseFloat(stakedAmount.toString());
        
        if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
          throw new Error('Invalid amount');
        }
      } catch (err) {
        return res.status(400).json({ 
          message: 'Invalid amount provided',
          error: 'Please provide a valid number for the staked amount'
        });
      }
      
      // Security: Convert timestamp to seconds (Unix timestamp) to fit integer range
      // This converts milliseconds to seconds to work within Postgres INT limits
      let timestampInSeconds: number;
      try {
        const timestampInMs = typeof startTimestamp === 'number' 
          ? startTimestamp 
          : new Date(startTimestamp).getTime();
          
        // PostgreSQL integer limit issue workaround - store as seconds not milliseconds
        timestampInSeconds = Math.floor(timestampInMs / 1000);
        
        // Validate timestamp is reasonable (not in the future, not too far in the past)
        const now = Math.floor(Date.now() / 1000);
        const oneYearAgo = now - (365 * 24 * 60 * 60);
        
        if (timestampInSeconds > now + 60) { // Allow 1 minute ahead for clock differences
          throw new Error('Timestamp cannot be in the future');
        }
        
        if (timestampInSeconds < oneYearAgo) {
          throw new Error('Timestamp is too far in the past');
        }
      } catch (err) {
        return res.status(400).json({ 
          message: 'Invalid timestamp',
          error: 'Please provide a valid timestamp'
        });
      }
      
      try {
        // Save staking data to database with proper formatting
        await storage.saveStakingData({
          walletAddress: sanitizedWalletAddress,
          stakedAmount: sanitizedAmount,
          startTimestamp: timestampInSeconds // Now using seconds instead of milliseconds
        });
        
        res.json({ 
          success: true, 
          message: 'Staking data saved successfully',
          data: {
            wallet: sanitizedWalletAddress.substring(0, 6) + '...' + sanitizedWalletAddress.substring(sanitizedWalletAddress.length - 4), // Show partial wallet for security
            amount: sanitizedAmount,
            timestamp: new Date(timestampInSeconds * 1000).toISOString() // Convert back to ISO for display
          }
        });
      } catch (dbError) {
        console.error('Database operation failed:', dbError);
        return res.status(500).json({
          message: 'Failed to save staking data',
          error: 'An error occurred while processing your request' // Generic error for security
        });
      }
    } catch (error) {
      console.error('Error saving staking data:', error);
      res.status(500).json({
        message: 'Failed to save staking data',
        error: 'An unexpected error occurred'
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
  
  // Set up WebSocket server with proper error handling
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Add proper error handling for the server
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Don't use threshold for small packages
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10
    }
  });
  
  // Error handling at the server level
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });
  
  // Client connections map
  const clients = new Map<WebSocket, { id: string, subscriptions: string[] }>();
  
  // Connection event
  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(2, 10);
    const ip = req.socket.remoteAddress || 'unknown';
    clients.set(ws, { id: clientId, subscriptions: [] });
    
    console.log(`WebSocket client connected: ${clientId} from ${ip}`);
    
    // Send initial connection confirmation with immediate data
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      clientId,
      timestamp: Date.now()
    }));
    
    // Message handling
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle subscription requests
        if (data.type === 'subscribe') {
          const clientInfo = clients.get(ws);
          if (clientInfo && data.channel) {
            clientInfo.subscriptions.push(data.channel);
            clients.set(ws, clientInfo);
            
            // Confirm subscription
            ws.send(JSON.stringify({
              type: 'subscription',
              status: 'subscribed',
              channel: data.channel
            }));
            
            // If subscribing to pool updates, send initial data
            if (data.channel === 'pool_updates') {
              sendPoolData(ws);
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      const clientInfo = clients.get(ws);
      if (clientInfo) {
        console.log(`WebSocket client disconnected: ${clientInfo.id}`);
        clients.delete(ws);
      }
    });
  });
  
  // Set up periodic pool data updates
  let lastPoolData: any = null;
  
  async function sendPoolData(client?: WebSocket) {
    try {
      // Create local variables for token balances with fallback values
      let solBalance = 0;
      let yotBalance = 0;
      let yosBalance = 0;
      
      // Get a connection from the connection manager
      const conn = getConnection();
      
      // Step 1: Get SOL balance with retry mechanism
      try {
        const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
        solBalance = await conn.getBalance(poolSolAccount);
        console.log(`Fetched SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
      } catch (solError) {
        console.error('Error fetching SOL balance, will try one more time:', solError);
        
        // Retry once after small delay with a fresh connection
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const freshConn = getConnection();
          const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
          solBalance = await freshConn.getBalance(poolSolAccount);
          console.log(`Retry successful, fetched SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
        } catch (retryError) {
          console.error('Retry failed to fetch SOL balance:', retryError);
        }
      }
      
      // Step 2: Get YOT balance
      try {
        const poolAuthority = new PublicKey(POOL_AUTHORITY);
        const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
        
        const yotTokenAccount = await getAssociatedTokenAddress(
          yotTokenMint,
          poolAuthority
        );
        
        const tokenAccountInfo = await getAccount(conn, yotTokenAccount);
        const mintInfo = await getMint(conn, yotTokenMint);
        yotBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
        console.log(`Fetched YOT balance: ${yotBalance} YOT`);
      } catch (yotError) {
        console.error('Error getting YOT balance:', yotError);
      }
      
      // Step 3: Get YOS balance
      try {
        const poolAuthority = new PublicKey(POOL_AUTHORITY);
        const yosTokenMint = new PublicKey(YOS_TOKEN_ADDRESS);
        
        const yosTokenAccount = await getAssociatedTokenAddress(
          yosTokenMint,
          poolAuthority
        );
        
        const tokenAccountInfo = await getAccount(conn, yosTokenAccount);
        const mintInfo = await getMint(conn, yosTokenMint);
        yosBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
        console.log(`Fetched YOS balance: ${yosBalance} YOS`);
      } catch (yosError) {
        console.log('YOS token account may not exist yet or error occurred:', yosError);
      }
      
      // Calculate values for the pool
      const solPrice = 148.35; // Current SOL price in USD
      const solValue = (solBalance / LAMPORTS_PER_SOL) * solPrice;
      
      // Calculate YOT and SOL value based on AMM constant product formula
      const k = (solBalance / LAMPORTS_PER_SOL) * yotBalance; // Constant product k
      const totalValue = solValue * 2; // Both sides of the pool have equal value
      
      // Create the pool data object with all values normalized
      const poolData = {
        sol: solBalance / LAMPORTS_PER_SOL,
        yot: yotBalance,
        yos: yosBalance,
        totalValue,
        constantProduct: k,
        timestamp: Date.now()
      };
      
      // Check if data has changed before broadcasting
      if (JSON.stringify(poolData) !== JSON.stringify(lastPoolData)) {
        lastPoolData = poolData;
        
        const message = JSON.stringify({
          type: 'pool_update',
          data: poolData
        });
        
        // Send to specific client if provided, otherwise broadcast
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          // Broadcast to all subscribed clients
          // Use Array.from to avoid iteration issues with TypeScript
          Array.from(clients.entries()).forEach(([wsClient, info]) => {
            if (
              wsClient.readyState === WebSocket.OPEN && 
              info.subscriptions.includes('pool_updates')
            ) {
              wsClient.send(message);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching pool data for WebSocket:', error);
    }
  }
  
  // Poll for pool updates every 5 seconds
  setInterval(sendPoolData, 5000);
  
  return httpServer;
}
