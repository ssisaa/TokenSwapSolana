/**
 * Solana Connection Manager
 * Provides a centralized connection management system to avoid creating too many connections
 * and reduces RPC rate limits by properly recycling connections.
 */

import { Connection, Commitment, ConnectionConfig } from '@solana/web3.js';
import { LRUCache } from './lruCache';

// Available RPC endpoints with failover support
const RPC_ENDPOINTS = [
  'https://api.devnet.solana.com',
  'https://rpc-devnet.helius.xyz/?api-key=15319bf6-5525-43d0-8cdc-17f54a2c452a',
  'https://rpc.ankr.com/solana_devnet'
];

// Default connection config
const DEFAULT_CONFIG: ConnectionConfig = {
  commitment: 'confirmed' as Commitment,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false
};

class SolanaConnectionManager {
  private static instance: SolanaConnectionManager;
  private mainConnection: Connection | null = null;
  private endpoints: string[] = [...RPC_ENDPOINTS];
  private currentEndpointIndex = 0;
  private lastConnectionTime = 0;
  private requestsCount = 0;
  private errorCount = 0;
  
  // Cache for frequently accessed data
  private accountInfoCache = new LRUCache<string, any>(100, 10000); // 10 second TTL
  private balanceCache = new LRUCache<string, number>(100, 30000);  // 30 second TTL
  private programAccountsCache = new LRUCache<string, any[]>(50, 60000); // 60 second TTL
  
  private constructor() {
    // Private constructor to enforce singleton
    this.createMainConnection();
    
    // Monitor connection health periodically
    setInterval(() => this.checkConnectionHealth(), 60000); // Every minute
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): SolanaConnectionManager {
    if (!SolanaConnectionManager.instance) {
      SolanaConnectionManager.instance = new SolanaConnectionManager();
    }
    return SolanaConnectionManager.instance;
  }
  
  /**
   * Get the current Solana connection
   * @param forceNew Force creating a new connection (use sparingly)
   * @returns A Solana Connection instance
   */
  public getConnection(forceNew = false): Connection {
    // If we need a new connection or don't have one yet
    if (forceNew || !this.mainConnection) {
      this.createMainConnection();
    }
    
    return this.mainConnection!;
  }
  
  /**
   * Create the main connection with the current endpoint
   */
  private createMainConnection(): void {
    // If we're creating connections too frequently, slow down
    const now = Date.now();
    if (now - this.lastConnectionTime < 5000) { // Don't create more than 1 connection per 5 seconds
      console.warn('Creating connections too frequently - using existing connection');
      return;
    }
    
    // Choose the current endpoint
    const endpoint = this.endpoints[this.currentEndpointIndex];
    
    // Create a new connection with the chosen endpoint
    try {
      this.mainConnection = new Connection(endpoint, DEFAULT_CONFIG);
      this.lastConnectionTime = now;
      console.log(`Created new Solana connection to ${endpoint}`);
    } catch (error) {
      console.error(`Failed to create connection to ${endpoint}:`, error);
      // Try the next endpoint on failure
      this.rotateEndpoint();
      // Retry with next endpoint
      setTimeout(() => this.createMainConnection(), 1000);
    }
  }
  
  /**
   * Rotate to the next RPC endpoint
   */
  private rotateEndpoint(): void {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
  }
  
  /**
   * Check if the current connection is healthy
   */
  private async checkConnectionHealth(): Promise<void> {
    if (!this.mainConnection) {
      this.createMainConnection();
      return;
    }
    
    try {
      // Simple health check
      const health = await this.mainConnection.getHealth();
      // Reset error count on success
      this.errorCount = 0;
    } catch (error) {
      console.warn('Connection health check failed:', error);
      this.errorCount++;
      
      // If we've had multiple errors, rotate the endpoint
      if (this.errorCount >= 3) {
        console.log('Too many connection errors, rotating endpoint');
        this.rotateEndpoint();
        this.createMainConnection();
        this.errorCount = 0;
      }
    }
  }
  
  /**
   * Get account info with caching to reduce RPC calls
   * @param address The account public key as a string
   * @param commitment Optional commitment level
   * @returns The account info or null
   */
  public async getAccountInfo(address: string, commitment?: Commitment): Promise<any> {
    // Try to get from cache first
    const cacheKey = `account_${address}_${commitment || 'confirmed'}`;
    const cachedInfo = this.accountInfoCache.get(cacheKey);
    
    if (cachedInfo) {
      return cachedInfo;
    }
    
    // If not in cache, fetch from network
    try {
      const connection = this.getConnection();
      const accountInfo = await connection.getAccountInfo(
        address, 
        commitment || DEFAULT_CONFIG.commitment
      );
      
      // Cache the result
      if (accountInfo) {
        this.accountInfoCache.set(cacheKey, accountInfo);
      }
      
      return accountInfo;
    } catch (error) {
      console.error(`Error fetching account info for ${address}:`, error);
      throw error;
    }
  }
  
  /**
   * Get token account balance with caching
   * @param address The token account address
   * @returns The balance as a number
   */
  public async getTokenAccountBalance(address: string): Promise<number> {
    const cacheKey = `balance_${address}`;
    const cachedBalance = this.balanceCache.get(cacheKey);
    
    if (cachedBalance !== undefined) {
      return cachedBalance;
    }
    
    try {
      const connection = this.getConnection();
      const balanceResponse = await connection.getTokenAccountBalance(address);
      const balance = balanceResponse?.value?.uiAmount || 0;
      
      // Cache the result
      this.balanceCache.set(cacheKey, balance);
      
      return balance;
    } catch (error) {
      console.error(`Error fetching token balance for ${address}:`, error);
      return 0;
    }
  }
  
  /**
   * Get SOL balance with caching
   * @param address The account address
   * @returns The balance in SOL
   */
  public async getBalance(address: string): Promise<number> {
    const cacheKey = `sol_${address}`;
    const cachedBalance = this.balanceCache.get(cacheKey);
    
    if (cachedBalance !== undefined) {
      return cachedBalance;
    }
    
    try {
      const connection = this.getConnection();
      const lamports = await connection.getBalance(address);
      const solBalance = lamports / 1_000_000_000; // Convert lamports to SOL
      
      // Cache the result
      this.balanceCache.set(cacheKey, solBalance);
      
      return solBalance;
    } catch (error) {
      console.error(`Error fetching SOL balance for ${address}:`, error);
      return 0;
    }
  }
  
  /**
   * Get program accounts with caching and pagination to avoid rate limits
   * @param programId The program ID
   * @param filters Optional filters
   * @returns Array of program accounts
   */
  public async getProgramAccounts(programId: string, filters?: any): Promise<any[]> {
    // Generate cache key based on program ID and filters
    const filterKey = filters ? JSON.stringify(filters) : 'default';
    const cacheKey = `program_${programId}_${filterKey}`;
    
    // Check cache
    const cachedAccounts = this.programAccountsCache.get(cacheKey);
    if (cachedAccounts) {
      return cachedAccounts;
    }
    
    try {
      const connection = this.getConnection();
      const accounts = await connection.getProgramAccounts(
        programId,
        filters
      );
      
      // Cache the results
      this.programAccountsCache.set(cacheKey, accounts);
      
      return accounts;
    } catch (error) {
      console.error(`Error fetching program accounts for ${programId}:`, error);
      return [];
    }
  }
  
  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    this.accountInfoCache.clear();
    this.balanceCache.clear();
    this.programAccountsCache.clear();
  }
}

// Export the singleton instance
export const solanaConnection = SolanaConnectionManager.getInstance();

// Export a helper function to get a connection
export function getConnection(): Connection {
  return solanaConnection.getConnection();
}