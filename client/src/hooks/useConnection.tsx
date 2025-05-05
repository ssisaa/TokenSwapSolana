import { useEffect, useState } from 'react';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { connectionManager } from '@/lib/connection-manager';

/**
 * Custom hook to get a Solana RPC connection
 * Uses connectionManager under the hood for fallback connections
 */
export function useConnection(): Connection {
  const [connection, setConnection] = useState<Connection>(() => {
    // Start with the main connection from connectionManager
    return connectionManager.getConnection();
  });

  useEffect(() => {
    // Nothing to do here as we're using the singleton connectionManager
    // which already handles connection fallbacks and retries
  }, []);

  return connection;
}