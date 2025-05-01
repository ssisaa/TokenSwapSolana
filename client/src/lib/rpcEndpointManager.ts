/**
 * RPC Endpoint Manager
 * Manages multiple RPC endpoints with rotation, retry, and health checking
 */

import { LRUCache } from './lruCache';

// Define RPC endpoint with weight for load balancing
export interface RpcEndpoint {
  url: string;
  weight: number;
  health?: {
    latency: number;
    successRate: number;
    lastChecked: number;
  };
}

// Default RPC endpoints with weights (higher weight = more frequent use)
const DEFAULT_ENDPOINTS: RpcEndpoint[] = [
  { url: 'api.devnet.solana.com', weight: 3 },
  { url: 'rpc-devnet.helius.xyz/?api-key=15319bf6-5525-43d0-8cdc-17f54a2c452a', weight: 3 },
  { url: 'rpc.ankr.com/solana_devnet', weight: 2 }
];

export class RpcEndpointManager {
  private endpoints: RpcEndpoint[];
  private weightSum: number;
  private lastIndex: number = -1;
  private endpointErrors: Map<string, { count: number, lastError: number }> = new Map();
  private responseCache: LRUCache<string, any>;
  
  /**
   * Create a new RPC endpoint manager
   * @param endpoints Optional list of custom endpoints (defaults to standard devnet endpoints)
   */
  constructor(endpoints: RpcEndpoint[] = DEFAULT_ENDPOINTS) {
    this.endpoints = [...endpoints];
    this.weightSum = this.calculateWeightSum();
    this.responseCache = new LRUCache<string, any>(100, 60 * 1000); // 1 minute cache TTL
    
    // Check endpoints periodically
    setInterval(() => this.checkEndpointHealth(), 5 * 60 * 1000); // Every 5 minutes
  }
  
  /**
   * Calculate the sum of all endpoint weights
   */
  private calculateWeightSum(): number {
    return this.endpoints.reduce((sum, endpoint) => sum + endpoint.weight, 0);
  }
  
  /**
   * Get the next RPC endpoint using weighted selection
   * @param blacklist Optional array of endpoint URLs to exclude
   * @returns The selected endpoint or null if all are blacklisted
   */
  getNextEndpoint(blacklist: string[] = []): RpcEndpoint | null {
    // If all endpoints are blacklisted, return null
    if (blacklist.length >= this.endpoints.length) {
      return null;
    }
    
    // Filter out blacklisted endpoints
    const availableEndpoints = this.endpoints.filter(e => !blacklist.includes(e.url));
    if (availableEndpoints.length === 0) {
      return null;
    }
    
    // If only one endpoint is available, return it
    if (availableEndpoints.length === 1) {
      return availableEndpoints[0];
    }
    
    // Use weighted random selection
    const targetWeight = Math.random() * this.calculateWeightSum();
    let cumulativeWeight = 0;
    
    for (const endpoint of availableEndpoints) {
      cumulativeWeight += endpoint.weight;
      if (cumulativeWeight >= targetWeight) {
        return endpoint;
      }
    }
    
    // Fallback to the first endpoint if something went wrong with weight calculation
    return availableEndpoints[0];
  }
  
  /**
   * Check the health of all endpoints
   */
  private async checkEndpointHealth(): Promise<void> {
    const checkPromises = this.endpoints.map(async endpoint => {
      const startTime = performance.now();
      
      try {
        const response = await fetch(`https://${endpoint.url}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getHealth'
          }),
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        if (response.ok) {
          // Update health metrics
          endpoint.health = {
            latency,
            successRate: 1.0,
            lastChecked: Date.now()
          };
          
          // Reset error count
          this.endpointErrors.delete(endpoint.url);
        } else {
          this.recordEndpointError(endpoint.url);
        }
      } catch (error) {
        this.recordEndpointError(endpoint.url);
      }
    });
    
    await Promise.allSettled(checkPromises);
    
    // Update weights based on health
    this.updateEndpointWeights();
  }
  
  /**
   * Record an error for an endpoint
   */
  private recordEndpointError(url: string): void {
    const errorData = this.endpointErrors.get(url) || { count: 0, lastError: 0 };
    errorData.count++;
    errorData.lastError = Date.now();
    this.endpointErrors.set(url, errorData);
    
    // Update the corresponding endpoint's health
    const endpoint = this.endpoints.find(e => e.url === url);
    if (endpoint) {
      endpoint.health = {
        latency: endpoint.health?.latency || 500, // Default to 500ms if no previous data
        successRate: endpoint.health ? Math.max(0.1, endpoint.health.successRate * 0.8) : 0.5, // Reduce success rate
        lastChecked: Date.now()
      };
    }
  }
  
  /**
   * Update endpoint weights based on health metrics
   */
  private updateEndpointWeights(): void {
    // Check if we have health data for at least half the endpoints
    const endpointsWithHealth = this.endpoints.filter(e => e.health);
    if (endpointsWithHealth.length < this.endpoints.length / 2) {
      return; // Not enough health data yet
    }
    
    // Update weights based on success rate and latency
    for (const endpoint of this.endpoints) {
      if (endpoint.health) {
        // Calculate a score between 0.1 and 1.0 based on health
        const latencyScore = Math.max(0.1, 1.0 - (endpoint.health.latency / 2000)); // 0-2000ms range
        const successScore = endpoint.health.successRate;
        const combinedScore = (latencyScore + successScore) / 2;
        
        // Adjust weight based on score, keeping original weight as a factor
        const originalWeight = DEFAULT_ENDPOINTS.find(e => e.url === endpoint.url)?.weight || 1;
        endpoint.weight = Math.max(1, Math.round(originalWeight * combinedScore * 5));
      }
    }
    
    // Recalculate weight sum
    this.weightSum = this.calculateWeightSum();
  }
  
  /**
   * Add a new RPC endpoint to the rotation
   */
  addEndpoint(endpoint: RpcEndpoint): void {
    // Check if endpoint already exists
    const existingIndex = this.endpoints.findIndex(e => e.url === endpoint.url);
    if (existingIndex >= 0) {
      // Update existing endpoint
      this.endpoints[existingIndex] = {
        ...this.endpoints[existingIndex],
        weight: endpoint.weight
      };
    } else {
      // Add new endpoint
      this.endpoints.push(endpoint);
    }
    
    // Recalculate weight sum
    this.weightSum = this.calculateWeightSum();
  }
  
  /**
   * Remove an RPC endpoint from the rotation
   */
  removeEndpoint(url: string): void {
    this.endpoints = this.endpoints.filter(e => e.url !== url);
    this.endpointErrors.delete(url);
    this.weightSum = this.calculateWeightSum();
  }
  
  /**
   * Get a cached response by key
   */
  getCachedResponse(key: string): any {
    return this.responseCache.get(key);
  }
  
  /**
   * Store a response in the cache
   */
  cacheResponse(key: string, response: any): void {
    this.responseCache.set(key, response);
  }
  
  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }
}

// Export singleton instance
export const rpcManager = new RpcEndpointManager();