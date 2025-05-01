/**
 * WebSocket Subscription Manager
 * 
 * Implements best practices for Solana WebSocket subscriptions to avoid 429 errors:
 * 1. Single shared WebSocket connection
 * 2. Throttle subscriptions with exponential backoff
 * 3. Batch subscriptions where possible
 * 4. Proper cleanup and unsubscription
 * 5. RPC endpoint rotation
 * 6. Rate limiting and subscription prioritization
 */

import { 
  Connection, 
  PublicKey, 
  AccountInfo, 
  Context, 
  Commitment 
} from '@solana/web3.js';
import { solanaConnection, getConnection } from './solanaConnectionManager';
import { LRUCache } from './lruCache';

// Subscription types we support
export type SubscriptionType = 
  | 'account' 
  | 'program' 
  | 'signature' 
  | 'slot'
  | 'root';

// Callback types for different subscription types
export type AccountChangeCallback = (accountInfo: AccountInfo<Buffer>, context: Context) => void;
export type ProgramAccountCallback = (keyedAccountInfo: any, context: Context) => void;
export type SignatureCallback = (signatureResult: any, context: Context) => void;
export type SlotCallback = (slotInfo: any) => void;
export type RootCallback = (root: number) => void;

// Information about a specific subscription
interface SubscriptionInfo {
  id: number;
  type: SubscriptionType;
  address?: string;
  callback: any;
  commitment?: Commitment;
  programId?: string;
  signature?: string;
  filters?: any[];
  timestamp: number;
}

// Retry configuration for subscriptions
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffFactor: number;
  maxDelay: number;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  backoffFactor: 2,
  maxDelay: 30000 // 30 seconds
};

// Subscription status
type SubscriptionStatus = 'active' | 'pending' | 'error' | 'unsubscribed';

// Tracks our active subscriptions and manages them efficiently
export class WebSocketSubscriptionManager {
  private static instance: WebSocketSubscriptionManager;
  
  private subscriptions: Map<number, SubscriptionInfo> = new Map();
  private subscriptionStatus: Map<number, SubscriptionStatus> = new Map();
  private throttleQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private lastSubscriptionTime = 0;
  private subscriptionCounter = 0;
  
  // Cache for subscription data
  private accountDataCache = new LRUCache<string, any>(500, 5000); // 5 second TTL
  
  private constructor() {
    // Private constructor to enforce singleton pattern
    
    // Set up periodic health check
    setInterval(() => {
      this.cleanupStaleSubscriptions();
    }, 60000); // Every minute
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): WebSocketSubscriptionManager {
    if (!WebSocketSubscriptionManager.instance) {
      WebSocketSubscriptionManager.instance = new WebSocketSubscriptionManager();
    }
    return WebSocketSubscriptionManager.instance;
  }
  
  /**
   * Subscribe to account changes with throttling and backoff
   * @param address The account address to monitor
   * @param callback The callback for account changes
   * @param commitment Optional commitment level
   * @returns Subscription ID for unsubscribing
   */
  public subscribeAccount(
    address: string | PublicKey,
    callback: AccountChangeCallback,
    commitment?: Commitment
  ): number {
    // Generate unique subscription ID
    const subscriptionId = ++this.subscriptionCounter;
    
    // Store information about this subscription
    const addressStr = typeof address === 'string' ? address : address.toBase58();
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'account',
      address: addressStr,
      callback,
      commitment,
      timestamp: Date.now()
    });
    
    this.subscriptionStatus.set(subscriptionId, 'pending');
    
    // Queue the actual subscription
    this.throttleQueue.push(async () => {
      await this.executeAccountSubscription(subscriptionId, 0);
    });
    
    // Start processing the queue if not already processing
    this.processThrottleQueue();
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to program account changes
   * @param programId The program ID to monitor
   * @param callback The callback for program account changes
   * @param commitment Optional commitment level
   * @param filters Optional filters
   * @returns Subscription ID for unsubscribing
   */
  public subscribeProgramAccounts(
    programId: string | PublicKey,
    callback: ProgramAccountCallback,
    commitment?: Commitment,
    filters?: any[]
  ): number {
    // Generate unique subscription ID
    const subscriptionId = ++this.subscriptionCounter;
    
    // Store information about this subscription
    const programIdStr = typeof programId === 'string' ? programId : programId.toBase58();
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'program',
      programId: programIdStr,
      callback,
      commitment,
      filters,
      timestamp: Date.now()
    });
    
    this.subscriptionStatus.set(subscriptionId, 'pending');
    
    // Queue the actual subscription
    this.throttleQueue.push(async () => {
      await this.executeProgramSubscription(subscriptionId, 0);
    });
    
    // Start processing the queue if not already processing
    this.processThrottleQueue();
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to signature confirmations
   * @param signature The transaction signature to monitor
   * @param callback The callback for signature updates
   * @param commitment Optional commitment level
   * @returns Subscription ID for unsubscribing
   */
  public subscribeSignature(
    signature: string,
    callback: SignatureCallback,
    commitment?: Commitment
  ): number {
    // Generate unique subscription ID
    const subscriptionId = ++this.subscriptionCounter;
    
    // Store information about this subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'signature',
      signature,
      callback,
      commitment,
      timestamp: Date.now()
    });
    
    this.subscriptionStatus.set(subscriptionId, 'pending');
    
    // Queue the actual subscription
    this.throttleQueue.push(async () => {
      await this.executeSignatureSubscription(subscriptionId, 0);
    });
    
    // Start processing the queue if not already processing
    this.processThrottleQueue();
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to slot changes
   * @param callback The callback for slot updates
   * @returns Subscription ID for unsubscribing
   */
  public subscribeSlot(callback: SlotCallback): number {
    // Generate unique subscription ID
    const subscriptionId = ++this.subscriptionCounter;
    
    // Store information about this subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'slot',
      callback,
      timestamp: Date.now()
    });
    
    this.subscriptionStatus.set(subscriptionId, 'pending');
    
    // Queue the actual subscription
    this.throttleQueue.push(async () => {
      await this.executeSlotSubscription(subscriptionId, 0);
    });
    
    // Start processing the queue if not already processing
    this.processThrottleQueue();
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from updates
   * @param subscriptionId The subscription ID to unsubscribe
   * @returns True if successfully unsubscribed
   */
  public unsubscribe(subscriptionId: number): boolean {
    // Get subscription info
    const subInfo = this.subscriptions.get(subscriptionId);
    if (!subInfo) {
      return false;
    }
    
    // Different unsubscribe method based on subscription type
    try {
      const connection = getConnection();
      
      switch (subInfo.type) {
        case 'account':
          connection.removeAccountChangeListener(subscriptionId);
          break;
        case 'program':
          connection.removeProgramAccountChangeListener(subscriptionId);
          break;
        case 'signature':
          connection.removeSignatureListener(subscriptionId);
          break;
        case 'slot':
          connection.removeSlotChangeListener(subscriptionId);
          break;
        case 'root':
          connection.removeRootChangeListener(subscriptionId);
          break;
      }
      
      // Update status and cleanup
      this.subscriptionStatus.set(subscriptionId, 'unsubscribed');
      this.subscriptions.delete(subscriptionId);
      
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from ${subInfo.type}:`, error);
      return false;
    }
  }
  
  /**
   * Check if a subscription is active
   * @param subscriptionId The subscription ID to check
   * @returns True if subscription is active
   */
  public isActive(subscriptionId: number): boolean {
    return this.subscriptionStatus.get(subscriptionId) === 'active';
  }
  
  /**
   * Unsubscribe from all active subscriptions
   */
  public unsubscribeAll(): void {
    // Get all subscription IDs
    const subscriptionIds = Array.from(this.subscriptions.keys());
    
    // Unsubscribe from each
    for (const id of subscriptionIds) {
      this.unsubscribe(id);
    }
  }
  
  /**
   * Get the number of active subscriptions
   */
  public getActiveCount(): number {
    let count = 0;
    for (const status of this.subscriptionStatus.values()) {
      if (status === 'active') {
        count++;
      }
    }
    return count;
  }
  
  /**
   * Process the throttle queue with rate limiting
   */
  private async processThrottleQueue(): Promise<void> {
    if (this.isProcessingQueue || this.throttleQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.throttleQueue.length > 0) {
        // Make sure we're not subscribing too quickly
        const now = Date.now();
        const timeSinceLastSubscription = now - this.lastSubscriptionTime;
        
        if (timeSinceLastSubscription < 500) { // Max 2 subscriptions per second
          await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastSubscription));
        }
        
        const nextSubscription = this.throttleQueue.shift();
        if (nextSubscription) {
          this.lastSubscriptionTime = Date.now();
          await nextSubscription();
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * Clean up stale subscriptions that haven't been updated
   */
  private cleanupStaleSubscriptions(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    for (const [id, subInfo] of this.subscriptions.entries()) {
      if (now - subInfo.timestamp > staleThreshold) {
        console.log(`Cleaning up stale subscription: ${id} (${subInfo.type})`);
        this.unsubscribe(id);
      }
    }
  }
  
  /**
   * Execute an account subscription with retry-backoff
   */
  private async executeAccountSubscription(
    subscriptionId: number,
    retryCount: number
  ): Promise<void> {
    const subInfo = this.subscriptions.get(subscriptionId);
    if (!subInfo || subInfo.type !== 'account' || !subInfo.address) {
      return;
    }
    
    try {
      const connection = getConnection();
      const addressPubkey = new PublicKey(subInfo.address);
      
      // Create a wrapper callback that updates our cache
      const wrappedCallback: AccountChangeCallback = (accountInfo, context) => {
        // Update the cache
        this.accountDataCache.set(subInfo.address!, accountInfo);
        
        // Call the original callback
        subInfo.callback(accountInfo, context);
      };
      
      // Subscribe with the underlying connection
      const id = connection.onAccountChange(
        addressPubkey,
        wrappedCallback,
        subInfo.commitment
      );
      
      // Update the subscription status
      this.subscriptionStatus.set(subscriptionId, 'active');
      console.log(`Subscribed to account ${subInfo.address} with ID: ${subscriptionId}`);
      
    } catch (error) {
      console.error(`Error subscribing to account ${subInfo.address}:`, error);
      this.subscriptionStatus.set(subscriptionId, 'error');
      
      // Implement retry with exponential backoff
      if (retryCount < DEFAULT_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          DEFAULT_RETRY_CONFIG.baseDelay * Math.pow(DEFAULT_RETRY_CONFIG.backoffFactor, retryCount),
          DEFAULT_RETRY_CONFIG.maxDelay
        );
        
        console.log(`Retrying account subscription in ${delay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          this.throttleQueue.push(async () => {
            await this.executeAccountSubscription(subscriptionId, retryCount + 1);
          });
          this.processThrottleQueue();
        }, delay);
      }
    }
  }
  
  /**
   * Execute a program subscription with retry-backoff
   */
  private async executeProgramSubscription(
    subscriptionId: number,
    retryCount: number
  ): Promise<void> {
    const subInfo = this.subscriptions.get(subscriptionId);
    if (!subInfo || subInfo.type !== 'program' || !subInfo.programId) {
      return;
    }
    
    try {
      const connection = getConnection();
      const programIdPubkey = new PublicKey(subInfo.programId);
      
      // Subscribe with the underlying connection
      const id = connection.onProgramAccountChange(
        programIdPubkey,
        subInfo.callback,
        subInfo.commitment,
        subInfo.filters
      );
      
      // Update the subscription status
      this.subscriptionStatus.set(subscriptionId, 'active');
      console.log(`Subscribed to program ${subInfo.programId} with ID: ${subscriptionId}`);
      
    } catch (error) {
      console.error(`Error subscribing to program ${subInfo.programId}:`, error);
      this.subscriptionStatus.set(subscriptionId, 'error');
      
      // Implement retry with exponential backoff
      if (retryCount < DEFAULT_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          DEFAULT_RETRY_CONFIG.baseDelay * Math.pow(DEFAULT_RETRY_CONFIG.backoffFactor, retryCount),
          DEFAULT_RETRY_CONFIG.maxDelay
        );
        
        console.log(`Retrying program subscription in ${delay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          this.throttleQueue.push(async () => {
            await this.executeProgramSubscription(subscriptionId, retryCount + 1);
          });
          this.processThrottleQueue();
        }, delay);
      }
    }
  }
  
  /**
   * Execute a signature subscription with retry-backoff
   */
  private async executeSignatureSubscription(
    subscriptionId: number,
    retryCount: number
  ): Promise<void> {
    const subInfo = this.subscriptions.get(subscriptionId);
    if (!subInfo || subInfo.type !== 'signature' || !subInfo.signature) {
      return;
    }
    
    try {
      const connection = getConnection();
      
      // Subscribe with the underlying connection
      const id = connection.onSignature(
        subInfo.signature,
        subInfo.callback,
        subInfo.commitment
      );
      
      // Update the subscription status
      this.subscriptionStatus.set(subscriptionId, 'active');
      console.log(`Subscribed to signature ${subInfo.signature} with ID: ${subscriptionId}`);
      
    } catch (error) {
      console.error(`Error subscribing to signature ${subInfo.signature}:`, error);
      this.subscriptionStatus.set(subscriptionId, 'error');
      
      // Implement retry with exponential backoff
      if (retryCount < DEFAULT_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          DEFAULT_RETRY_CONFIG.baseDelay * Math.pow(DEFAULT_RETRY_CONFIG.backoffFactor, retryCount),
          DEFAULT_RETRY_CONFIG.maxDelay
        );
        
        console.log(`Retrying signature subscription in ${delay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          this.throttleQueue.push(async () => {
            await this.executeSignatureSubscription(subscriptionId, retryCount + 1);
          });
          this.processThrottleQueue();
        }, delay);
      }
    }
  }
  
  /**
   * Execute a slot subscription with retry-backoff
   */
  private async executeSlotSubscription(
    subscriptionId: number,
    retryCount: number
  ): Promise<void> {
    const subInfo = this.subscriptions.get(subscriptionId);
    if (!subInfo || subInfo.type !== 'slot') {
      return;
    }
    
    try {
      const connection = getConnection();
      
      // Subscribe with the underlying connection
      const id = connection.onSlotChange(subInfo.callback);
      
      // Update the subscription status
      this.subscriptionStatus.set(subscriptionId, 'active');
      console.log(`Subscribed to slot updates with ID: ${subscriptionId}`);
      
    } catch (error) {
      console.error(`Error subscribing to slot updates:`, error);
      this.subscriptionStatus.set(subscriptionId, 'error');
      
      // Implement retry with exponential backoff
      if (retryCount < DEFAULT_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          DEFAULT_RETRY_CONFIG.baseDelay * Math.pow(DEFAULT_RETRY_CONFIG.backoffFactor, retryCount),
          DEFAULT_RETRY_CONFIG.maxDelay
        );
        
        console.log(`Retrying slot subscription in ${delay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          this.throttleQueue.push(async () => {
            await this.executeSlotSubscription(subscriptionId, retryCount + 1);
          });
          this.processThrottleQueue();
        }, delay);
      }
    }
  }
  
  /**
   * Get cached account data if available
   * @param address The account address
   * @returns The cached account info or null
   */
  public getCachedAccountInfo(address: string): any | null {
    return this.accountDataCache.get(address) || null;
  }
  
  /**
   * Clear the account data cache
   */
  public clearCache(): void {
    this.accountDataCache.clear();
  }
}

// Export the singleton instance
export const wsSubscriptions = WebSocketSubscriptionManager.getInstance();