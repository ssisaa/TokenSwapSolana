import { Commitment, Connection, ConnectionConfig } from '@solana/web3.js';

// Multiple RPC endpoints for fallback
const RPC_ENDPOINTS = [
  'https://api.devnet.solana.com',
  'https://devnet.genesysgo.net',
  'https://devnet.solana.rpcpool.com',
  'https://api.testnet.solana.com' // Could fallback to testnet in extreme cases
];

// Different commitment levels to try
const COMMITMENT_LEVELS: Commitment[] = ['confirmed', 'processed'];

/**
 * Manages Solana RPC connections with fallback and retry mechanisms
 */
class ConnectionManager {
  private connections: Connection[] = [];
  private lastSuccessfulConnectionIndex = 0;
  private lastSuccessfulCommitmentIndex = 0;

  constructor() {
    // Initialize connections for all endpoints
    this.initializeConnections();
  }

  private initializeConnections() {
    // Create a connection for each endpoint
    RPC_ENDPOINTS.forEach(endpoint => {
      // For each endpoint, create connections with different commitment levels
      COMMITMENT_LEVELS.forEach(commitment => {
        const config: ConnectionConfig = {
          commitment,
          confirmTransactionInitialTimeout: 60000, // 60 seconds
          disableRetryOnRateLimit: false
        };
        this.connections.push(new Connection(endpoint, config));
      });
    });
  }

  /**
   * Gets a connection with automatic fallback and retry logic
   */
  public getConnection(): Connection {
    // Start with the last successful connection
    return this.connections[this.lastSuccessfulConnectionIndex];
  }

  /**
   * Execute an RPC request with automatic fallback and retry
   * @param operation Function that performs the RPC request
   * @param maxRetries Maximum number of retry attempts
   * @param initialDelayMs Initial delay between retries in milliseconds
   */
  public async executeWithFallback<T>(
    operation: (connection: Connection) => Promise<T>,
    maxRetries = 5,
    initialDelayMs = 250
  ): Promise<T> {
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      for (let i = 0; i < this.connections.length; i++) {
        const connectionIndex = (this.lastSuccessfulConnectionIndex + i) % this.connections.length;
        const connection = this.connections[connectionIndex];

        try {
          // Attempt operation with current connection
          const result = await operation(connection);
          
          // If successful, update the last successful connection index
          this.lastSuccessfulConnectionIndex = connectionIndex;
          return result;
        } catch (error: any) {
          // Store the error but continue trying with other connections
          lastError = error;
          console.warn(`Connection attempt ${retryCount} failed with endpoint ${connectionIndex}: ${error.message}`);
          
          // If it's not a network error, rethrow immediately
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      // If we've tried all connections and still failed, wait before retrying
      retryCount++;
      if (retryCount <= maxRetries) {
        // Exponential backoff
        const delayMs = initialDelayMs * Math.pow(2, retryCount - 1);
        console.log(`All connections failed, retrying in ${delayMs}ms (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // If we've exhausted all retries, throw the last error
    console.error(`All retry attempts failed after trying ${maxRetries} times`);
    throw lastError || new Error('Connection failed after multiple attempts');
  }
}

/**
 * Determines if an error is network-related and should trigger a retry
 */
function isNetworkError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  
  return (
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('socket') ||
    errorMessage.includes('structerror') ||
    errorMessage.includes('expected the value')
  );
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();

// Example usage:
// const connection = connectionManager.getConnection();
// const result = await connectionManager.executeWithFallback(
//   (conn) => conn.getBalance(publicKey)
// );