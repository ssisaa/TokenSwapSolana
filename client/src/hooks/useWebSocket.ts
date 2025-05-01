import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket connection states
export type WebSocketConnectionState = 'connecting' | 'open' | 'closing' | 'closed' | 'error';

// Message types received from WebSocket
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Pool data structure
export interface PoolData {
  sol: number;
  yot: number;
  yos: number;
  totalValue: number;
  timestamp: number;
}

// Constants
export const CLUSTER = 'devnet';
export const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

interface UseWebSocketOptions {
  reconnectInterval?: number;
  reconnectAttempts?: number;
  autoReconnect?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  subscriptions?: string[];
}

export function useWebSocket(
  options: UseWebSocketOptions = {}
) {
  const {
    reconnectInterval = 5000,
    reconnectAttempts = 10,
    autoReconnect = true,
    onMessage,
    subscriptions = ['pool_updates'] // Default subscription to pool updates
  } = options;

  // Connection state
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('closed');
  const [clientId, setClientId] = useState<string | null>(null);
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Create a WebSocket connection or reconnect if disconnected
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      // Close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setConnectionState('connecting');
      
      // Create WebSocket connection with proper protocol, host and path
      // Use an absolute path with explicit protocol to avoid connection issues
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl} (fixing code 1006 error)`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      // Connection opened
      ws.addEventListener('open', () => {
        console.log('WebSocket connection established');
        setConnectionState('open');
        reconnectAttemptsRef.current = 0;
        
        // Subscribe to channels
        subscriptions.forEach(channel => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel
          }));
        });
      });
      
      // Connection error - improved error handling
      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
        
        // Try fetching pool data via HTTP right after a connection error
        fetchPoolDataViaHttp();
      });
      
      // Connection closed
      ws.addEventListener('close', (event) => {
        console.log(`WebSocket connection closed with code: ${event.code}`);
        setConnectionState('closed');
        
        // Handle reconnection if enabled
        if (autoReconnect && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${reconnectAttempts})...`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      });
      
      // Handle messages
      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(message);
          
          // Handle different message types
          switch (message.type) {
            case 'connection':
              if (message.clientId) {
                setClientId(message.clientId);
              }
              break;
              
            case 'pool_update':
              if (message.data) {
                setPoolData(message.data as PoolData);
              }
              break;
          }
          
          // Call onMessage handler if provided
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState('error');
    }
  }, [subscriptions, reconnectInterval, reconnectAttempts, autoReconnect, onMessage]);
  
  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      setConnectionState('closing');
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  // Cache to prevent duplicate requests
  const requestTimeoutRef = useRef<number | null>(null);
  const lastRequestTimeRef = useRef<number>(0);
  const cachedDataRef = useRef<PoolData | null>(null);
  
  // HTTP fallback to fetch pool data when WebSocket fails - optimized version
  const fetchPoolDataViaHttp = useCallback(async (forceRefresh = false) => {
    // Implement rate limiting - only request if it's been at least 10 seconds since last request
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    
    // Return cached data if it's recent (less than 30 seconds old) and not forcing refresh
    if (!forceRefresh && cachedDataRef.current && timeSinceLastRequest < 30000) {
      console.log('Using cached pool data (age: ' + Math.floor(timeSinceLastRequest/1000) + 's)');
      setPoolData(cachedDataRef.current);
      return;
    }
    
    // Enforce rate limiting of 10 seconds between requests
    if (!forceRefresh && timeSinceLastRequest < 10000) {
      console.log(`Rate limiting HTTP requests (${Math.floor((10000 - timeSinceLastRequest)/1000)}s until next allowed)`);
      return;
    }
    
    // Cancel any pending request
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    
    try {
      // Record request time for rate limiting
      lastRequestTimeRef.current = now;
      
      // Use the primary endpoint only to reduce request load
      const url = `${window.location.protocol}//${window.location.host}/api/pool-data`;
      console.log(`Fetching pool data from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        cache: 'no-store' // Force fresh data
      });
      
      if (!response.ok) {
        console.warn(`API returned status ${response.status}`);
        return;
      }
      
      const data = await response.json();
      
      // Process pool data
      if (data && data.sol !== undefined && data.yot !== undefined) {
        const poolData: PoolData = {
          sol: typeof data.sol === 'number' ? data.sol : parseFloat(data.sol),
          yot: typeof data.yot === 'number' ? data.yot : parseFloat(data.yot),
          yos: data.yos ? (typeof data.yos === 'number' ? data.yos : parseFloat(data.yos)) : 0,
          totalValue: data.totalValue || (data.sol * 148.35),
          timestamp: now
        };
        
        // Cache the data for future requests
        cachedDataRef.current = poolData;
        setPoolData(poolData);
        console.log('Pool data fetched and cached:', poolData);
      }
    } catch (error) {
      console.error('Failed to fetch pool data:', error);
    }
  }, []);

  // Connect WebSocket on mount and cleanup on unmount
  useEffect(() => {
    connect();
    
    // Fetch initial pool data via HTTP as a fallback
    fetchPoolDataViaHttp(true);
    
    // Set up periodic HTTP fallback with proper rate limiting
    const fallbackInterval = setInterval(() => {
      if (connectionState !== 'open') {
        // Only fetch if WebSocket is not connected
        fetchPoolDataViaHttp(false);
      }
    }, 30000); // Check every 30 seconds instead of 10
    
    return () => {
      disconnect();
      clearInterval(fallbackInterval);
    };
  }, [connect, disconnect, fetchPoolDataViaHttp, connectionState]);
  
  return {
    connectionState,
    clientId,
    poolData,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    isConnected: connectionState === 'open'
  };
}