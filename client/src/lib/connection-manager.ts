import { 
  Commitment, 
  Connection, 
  ConnectionConfig, 
  PublicKey, 
  Transaction,
  Keypair,
  SystemProgram
} from '@solana/web3.js';
import { toast } from '@/hooks/use-toast';

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
  
  // Define class methods in the interface
  getTokenBalance!: (tokenAccount: PublicKey) => Promise<bigint>;
  
  // Add automatic refund methods
  getRefundKeypair!: () => Keypair;
  sendAndConfirmTransaction!: (connection: Connection, transaction: Transaction, signers: Keypair[] | Keypair) => Promise<string>;
  executeTransactionWithAutoRefund!: (wallet: any, transaction: Transaction, operationName: string, simulateFirst?: boolean) => Promise<string>;

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

// Add token balance getter method to ConnectionManager
ConnectionManager.prototype.getTokenBalance = async function(tokenAccount: PublicKey): Promise<bigint> {
  try {
    const { value } = await this.executeWithFallback(
      conn => conn.getTokenAccountBalance(tokenAccount)
    );
    
    return BigInt(value.amount);
  } catch (error) {
    console.error(`Error getting token balance for ${tokenAccount.toString()}:`, error);
    return BigInt(0);
  }
};

/**
 * Create a refund keypair for emergency refunds
 * This is used for emergency situations where funds need to be returned to the user
 */
// IMPORTANT: In a production app, this would be an admin-controlled key with funds
// For demo purposes, we're generating a new one each time the app loads
const REFUND_KEYPAIR = Keypair.generate();

/**
 * Get the refund keypair for automatic refunds
 */
ConnectionManager.prototype.getRefundKeypair = function(): Keypair {
  return REFUND_KEYPAIR;
};

/**
 * Send and confirm a transaction with automatic retries
 */
ConnectionManager.prototype.sendAndConfirmTransaction = async function(
  connection: Connection, 
  transaction: Transaction,
  signers: Keypair[] | Keypair
): Promise<string> {
  // Normalize signers to always be an array
  const signersArray = Array.isArray(signers) ? signers : [signers];
  return await this.executeWithFallback(async (conn) => {
    // Get a recent blockhash
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = (Array.isArray(signers) ? signers[0] : signers).publicKey;
    
    // Sign the transaction
    transaction.sign(...signersArray);
    
    // Send the signed transaction
    const signature = await conn.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });
    
    return signature;
  });
};

/**
 * Execute a transaction with balance tracking for automatic refunds
 * This function tracks SOL balances before and after transaction execution
 * and automatically refunds if the transaction fails but SOL was deducted
 */
ConnectionManager.prototype.executeTransactionWithAutoRefund = async function(
  wallet: any,
  transaction: Transaction,
  description: string = "transaction",
  simulateFirst: boolean = true
): Promise<string> {
  // Get current connection
  const connection = this.getConnection();
  
  // First, verify the program ID in each instruction
  for (const ix of transaction.instructions) {
    if (!ix.programId || ix.programId.toString() === '11111111111111111111111111111111') {
      // System program is fine
      continue;
    }
    
    // Verify this is a valid program ID
    if (ix.programId.toString().length < 32) {
      throw new Error(`Invalid program ID in transaction: ${ix.programId.toString()}`);
    }
  }
  
  // Check initial balance
  console.log(`Checking initial SOL balance before ${description}...`);
  const walletPublicKey = wallet.publicKey;
  const initialBalance = await connection.getBalance(walletPublicKey);
  console.log(`Initial balance: ${initialBalance / 1e9} SOL`);

  // Prepare transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  try {
    // Simulate if requested
    if (simulateFirst) {
      console.log(`Simulating ${description} transaction...`);
      try {
        const simulation = await connection.simulateTransaction(transaction);
        
        if (simulation.value.err) {
          console.error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        
        console.log(`Simulation successful, proceeding with actual transaction`);
      } catch (simError: any) {
        console.error(`Error during transaction simulation: ${simError.message || simError}`);
        throw new Error(`Transaction simulation error: ${simError.message || simError}`);
      }
    }
    
    // Send the transaction
    console.log(`Sending ${description} transaction...`);
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log(`Transaction sent: ${signature}`);
    
    // Wait for confirmation
    const confirmResult = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    // Check if the transaction failed
    if (confirmResult?.value?.err) {
      console.error(`Transaction confirmed with error: ${JSON.stringify(confirmResult.value.err)}`);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmResult.value.err)}`);
    }
    
    console.log(`Transaction confirmed successfully: ${signature}`);
    
    // Check final balance for reporting
    const finalBalance = await connection.getBalance(walletPublicKey);
    const balanceChange = (initialBalance - finalBalance) / 1e9;
    console.log(`Transaction fee: ~${balanceChange.toFixed(6)} SOL`);
    
    return signature;
  } catch (error: any) {
    console.error(`Transaction failed:`, error);
    
    // Check if SOL was deducted
    console.log(`Checking if SOL was deducted...`);
    const currentBalance = await connection.getBalance(walletPublicKey);
    const change = initialBalance - currentBalance;
    
    if (change > 0) {
      console.warn(`SOL was deducted (${change / 1e9} SOL) but transaction failed. Processing refund...`);
      
      try {
        // Create a new transaction to refund the SOL
        const refundTransaction = new Transaction();
        refundTransaction.add(
          SystemProgram.transfer({
            fromPubkey: REFUND_KEYPAIR.publicKey,
            toPubkey: walletPublicKey,
            lamports: change
          })
        );
        
        // Send and confirm the refund transaction
        const refundSignature = await this.sendAndConfirmTransaction(
          connection,
          refundTransaction,
          [REFUND_KEYPAIR]
        );
        
        console.log(`SOL refunded successfully: ${refundSignature}`);
        
        toast({
          title: "Transaction failed but SOL was refunded",
          description: `The ${description} failed, but ${change / 1e9} SOL was automatically refunded to your wallet.`,
          variant: "default"
        });
      } catch (refundError: any) {
        console.error(`Failed to refund SOL:`, refundError);
        
        toast({
          title: "Transaction failed",
          description: `The ${description} failed and we couldn't automatically refund your SOL. Please contact support.`,
          variant: "destructive"
        });
      }
    } else {
      console.log(`No SOL was deducted, no refund needed.`);
      
      toast({
        title: "Transaction failed",
        description: `The ${description} failed. Error: ${error.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
    
    // Rethrow the original error
    throw error;
  }
};

// Export a singleton instance
export const connectionManager = new ConnectionManager();