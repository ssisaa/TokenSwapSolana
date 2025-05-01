import { useEffect, useRef, useState } from 'react';

// Define pool data structure
export interface PoolData {
  sol: number;
  yot: number;
  yos: number;
  totalValue: number;
  timestamp: number;
}

// Singleton WebSocket instance to be shared across the app
let globalWsInstance: WebSocket | null = null;
let wsListeners: Function[] = [];
let wsRetryCount = 0;
const MAX_RETRY_COUNT = 5;
const RETRY_BACKOFF_MS = 2000;

// Cache for pool data
const dataCache: {
  poolData: PoolData | null;
  timestamp: number;
} = {
  poolData: null,
  timestamp: 0
};

// Function to create or return the global WebSocket
function getGlobalWebSocket() {
  if (globalWsInstance && globalWsInstance.readyState === WebSocket.OPEN) {
    return globalWsInstance;
  }
  
  if (globalWsInstance) {
    try {
      globalWsInstance.close();
    } catch (e) {
      console.warn('Error closing existing WebSocket', e);
    }
  }
  
  // Create a new WebSocket with proper error handling
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log(`Creating shared WebSocket connection to ${wsUrl}`);
    
    globalWsInstance = new WebSocket(wsUrl);
    
    globalWsInstance.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      wsRetryCount = 0;
      
      // Send pool subscription message
      globalWsInstance?.send(JSON.stringify({
        type: 'subscribe',
        channel: 'pool_updates'
      }));
      
      // Notify all listeners about connection
      wsListeners.forEach(listener => listener({ type: 'connection', status: 'open' }));
    };
    
    globalWsInstance.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // If it's pool data, update the cache
        if (data.type === 'pool_update' && data.data) {
          dataCache.poolData = data.data;
          dataCache.timestamp = Date.now();
        }
        
        // Notify all listeners
        wsListeners.forEach(listener => listener(data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    globalWsInstance.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
      wsListeners.forEach(listener => listener({ 
        type: 'error', 
        error: 'WebSocket connection error' 
      }));
    };
    
    globalWsInstance.onclose = (event) => {
      console.warn(`🔌 WebSocket closed with code: ${event.code}`);
      
      // Notify all listeners
      wsListeners.forEach(listener => listener({ 
        type: 'connection', 
        status: 'closed',
        code: event.code
      }));
      
      // Clear the global instance
      globalWsInstance = null;
      
      // Implement exponential backoff for reconnection
      if (wsRetryCount < MAX_RETRY_COUNT) {
        const delay = RETRY_BACKOFF_MS * Math.pow(2, wsRetryCount);
        console.log(`Will attempt to reconnect in ${delay/1000}s (attempt ${wsRetryCount + 1}/${MAX_RETRY_COUNT})`);
        
        setTimeout(() => {
          wsRetryCount++;
          getGlobalWebSocket();
        }, delay);
      } else {
        console.error('Maximum WebSocket reconnection attempts reached');
      }
    };
    
    return globalWsInstance;
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    return null;
  }
}

// Function to fetch pool data via HTTP with throttling and caching
async function fetchPoolData(forceRefresh = false): Promise<PoolData | null> {
  const now = Date.now();
  
  // Return cached data if recent and not forcing refresh
  if (!forceRefresh && dataCache.poolData && now - dataCache.timestamp < 15000) {
    console.log(`Using cached pool data (age: ${Math.floor((now - dataCache.timestamp)/1000)}s)`);
    return dataCache.poolData;
  }
  
  try {
    const url = `${window.location.protocol}//${window.location.host}/api/pool-data`;
    console.log(`Fetching pool data from API: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.warn(`API returned status ${response.status}`);
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process and cache the data
    if (data && typeof data.sol !== 'undefined' && typeof data.yot !== 'undefined') {
      const poolData: PoolData = {
        sol: typeof data.sol === 'number' ? data.sol : parseFloat(data.sol),
        yot: typeof data.yot === 'number' ? data.yot : parseFloat(data.yot),
        yos: data.yos ? (typeof data.yos === 'number' ? data.yos : parseFloat(data.yos)) : 0,
        totalValue: data.totalValue || (data.sol * 148.35), // Default SOL price
        timestamp: now
      };
      
      dataCache.poolData = poolData;
      dataCache.timestamp = now;
      
      console.log('Pool data fetched and cached:', poolData);
      return poolData;
    }
    
    throw new Error('Invalid pool data format received');
  } catch (error) {
    console.error('Failed to fetch pool data:', error);
    // Return stale cache as fallback if available
    if (dataCache.poolData) {
      console.log('Returning stale cached data due to error');
      return dataCache.poolData;
    }
    return null;
  }
}

// Main hook for consuming pool data
export function usePoolData() {
  const [poolData, setPoolData] = useState<PoolData | null>(dataCache.poolData);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Refs to manage state
  const listenerRef = useRef<Function | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Handle WebSocket messages
  const handleWsMessage = (message: any) => {
    if (message.type === 'pool_update' && message.data) {
      setPoolData(message.data);
      setError(null);
    } else if (message.type === 'connection') {
      setIsConnected(message.status === 'open');
      if (message.status === 'open') {
        setError(null);
      }
    } else if (message.type === 'error') {
      setError(message.error || 'WebSocket error');
      // Trigger HTTP fallback when WebSocket has error
      fetchPoolData(true).then(data => {
        if (data) setPoolData(data);
      });
    }
  };
  
  useEffect(() => {
    // Register listener
    if (!listenerRef.current) {
      listenerRef.current = handleWsMessage;
      wsListeners.push(handleWsMessage);
    }
    
    // Initial data load
    fetchPoolData().then(data => {
      if (data) setPoolData(data);
    });
    
    // Initialize WebSocket (or get existing one)
    getGlobalWebSocket();
    
    // Set up HTTP polling fallback at longer intervals
    intervalRef.current = window.setInterval(() => {
      if (!isConnected) {
        console.log('WebSocket disconnected - using HTTP fallback');
        fetchPoolData().then(data => {
          if (data) setPoolData(data);
        });
      }
    }, 30000); // 30 second fallback polling
    
    // Cleanup function
    return () => {
      if (listenerRef.current) {
        const index = wsListeners.indexOf(listenerRef.current);
        if (index !== -1) {
          wsListeners.splice(index, 1);
        }
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isConnected]);
  
  // Function to manually refresh data
  const refreshData = () => {
    // Try reconnecting WebSocket if disconnected
    if (!isConnected) {
      getGlobalWebSocket();
    }
    
    // Also fetch via HTTP for immediate feedback
    return fetchPoolData(true).then(data => {
      if (data) setPoolData(data);
      return data;
    });
  };
  
  return {
    poolData,
    error,
    isConnected,
    refreshData
  };
}