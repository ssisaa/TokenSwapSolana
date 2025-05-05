import { useEffect, useState } from 'react';
import { Connection, clusterApiUrl } from '@solana/web3.js';

/**
 * Custom hook that provides a stable Solana connection
 * @returns A Solana Connection object connected to devnet
 */
export default function useConnection(): Connection {
  // Store the Connection object in state to ensure it's stable
  const [connection, setConnection] = useState<Connection | null>(null);

  // Initialize the connection on component mount
  useEffect(() => {
    // Use devnet for development
    const endpoint = clusterApiUrl('devnet');
    
    // Create a new Connection object with preflight commitment level
    const conn = new Connection(endpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });
    
    // Store the connection in state
    setConnection(conn);
    
    // Log initialization for debugging
    console.log('Solana connection initialized to devnet');

    // No cleanup needed - Connection objects don't have disposal methods
  }, []);

  // Return the Connection object, or a fallback that will be replaced once initialized
  return connection || new Connection(clusterApiUrl('devnet'), 'confirmed');
}