import { Connection } from '@solana/web3.js';

// Hardcoded Solana RPC URLs for Devnet that are known to work
const RELIABLE_RPC_ENDPOINTS = [
  'https://api.devnet.solana.com',         // Official devnet endpoint
  'https://rpc-devnet.helius.xyz/?api-key=57335a7c-a2b7-4ee2-a479-4110c9bb3565', // Helius endpoint
  'https://devnet.genesysgo.net/',         // GenesysGo endpoint
  'https://devnet.rpcpool.com',            // RPC Pool
  'https://bold-small-star.solana-devnet.discover.quiknode.pro/dfa93da4a4f44a581f9adb4d5a24ad88806db9fa/', // QuickNode
  'https://solana-devnet-rpc.publicnode.com', // Public Node
];

// Create a connection with automatic fallback
const connection = new Connection(RELIABLE_RPC_ENDPOINTS[0], 'confirmed');

/**
 * Custom hook to get a Solana RPC connection
 * Uses connectionManager under the hood for fallback connections
 */
export function useConnection(): Connection {
  return connection;
}