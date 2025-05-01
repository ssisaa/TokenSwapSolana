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
      
      // Create WebSocket connection with relative path to avoid protocol/host issues in Replit
      const wsUrl = `/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      const ws = new WebSocket((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + wsUrl);
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
      
      // Connection error
      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
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
  
  // Connect WebSocket on mount and cleanup on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
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