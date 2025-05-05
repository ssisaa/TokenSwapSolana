import { useEffect, useState } from 'react';
import { Connection, clusterApiUrl } from '@solana/web3.js';

// Cache a single connection instance for the entire application
let connectionInstance: Connection | null = null;

/**
 * Create a stable Solana connection that can be used anywhere
 * Unlike a normal hook, this can be called outside of components
 * @returns A Solana Connection object connected to devnet
 */
export function getConnection(): Connection {
  if (!connectionInstance) {
    // Use devnet for development
    const endpoint = clusterApiUrl('devnet');
    
    // Create a new connection with improved timeout settings
    connectionInstance = new Connection(endpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });
    
    // Log initialization for debugging
    console.log('Solana connection initialized to devnet (singleton)');
  }
  
  return connectionInstance;
}

/**
 * Custom React hook that provides a stable Solana connection
 * This wraps the getConnection function for components
 * @returns A Solana Connection object connected to devnet
 */
export default function useConnection(): Connection {
  // We use a useState here just to properly follow React conventions
  // but the actual connection will always be the singleton
  const [connection] = useState<Connection>(getConnection());
  
  // No useEffect needed since we're managing a singleton connection instance
  
  return connection;
}