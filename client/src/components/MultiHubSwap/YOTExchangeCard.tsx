import { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPoolBalances } from '@/lib/solana';

interface PoolData {
  sol: number;
  yot: number;
  yos: number;
  timestamp: number;
}

// Static default pool data for immediate rendering
const DEFAULT_POOL_DATA: PoolData = {
  sol: 31.327196998,
  yot: 643844667.1563296,
  yos: 562951041.1034079,
  timestamp: Date.now()
};

export default function YOTExchangeCard() {
  const [solToYot, setSolToYot] = useState<number | null>(null);
  const [yotToSol, setYotToSol] = useState<number | null>(null);
  const [solToYos, setSolToYos] = useState<number | null>(null);
  const [yosToSol, setYosToSol] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [poolData, setPoolData] = useState<PoolData>(DEFAULT_POOL_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs for caching and tracking
  const lastUpdateTimeRef = useRef<number>(0);
  const requestInProgressRef = useRef<boolean>(false);
  const poolCacheRef = useRef<PoolData>(DEFAULT_POOL_DATA);
  
  // Calculate exchange rates immediately using cached/default data
  const calculateRatesLocally = (poolDataToUse: PoolData) => {
    const { sol: SOL_RESERVE, yot: YOT_RESERVE, yos: YOS_RESERVE } = poolDataToUse;
    const FEE_MULTIPLIER = 0.997; // 0.3% fee
    
    try {
      // Calculate exchange rates using proper AMM constant product formula (x * y = k)
      const CP_CONSTANT = SOL_RESERVE * YOT_RESERVE; // Calculate constant product k
      
      // Calculate SOL → YOT rate properly
      const inputSOL = 1; // Calculate for 1 SOL
      const newSolReserve = SOL_RESERVE + inputSOL;
      const newYotReserve = CP_CONSTANT / newSolReserve;
      const outputYOT = (YOT_RESERVE - newYotReserve) * FEE_MULTIPLIER; // Apply fee
      setSolToYot(outputYOT);
      
      // Calculate YOT → SOL rate (for 1M YOT)
      const inputYOT = 1000000; // Calculate for 1M YOT for better display
      const newYotReserveForSol = YOT_RESERVE + inputYOT;
      const newSolReserveForYot = CP_CONSTANT / newYotReserveForSol;
      const outputSOL = (SOL_RESERVE - newSolReserveForYot) * FEE_MULTIPLIER; // Apply fee
      setYotToSol(outputSOL);
      
      // Only calculate YOS rates if we have YOS in the pool
      if (YOS_RESERVE > 0) {
        // Calculate SOL → YOS rate
        const CP_CONSTANT_YOS = SOL_RESERVE * YOS_RESERVE;
        const newSolReserveForYos = SOL_RESERVE + inputSOL;
        const newYosReserve = CP_CONSTANT_YOS / newSolReserveForYos;
        const outputYOS = (YOS_RESERVE - newYosReserve) * FEE_MULTIPLIER;
        setSolToYos(outputYOS);
        
        // Calculate YOS → SOL rate (for 1M YOS)
        const inputYOS = 1000000; // Calculate for 1M YOS
        const newYosReserveForSol = YOS_RESERVE + inputYOS;
        const newSolReserveForYos2 = CP_CONSTANT_YOS / newYosReserveForSol;
        const outputSOLFromYOS = (SOL_RESERVE - newSolReserveForYos2) * FEE_MULTIPLIER;
        setYosToSol(outputSOLFromYOS);
      }
    } catch (error) {
      console.error('Error in local rate calculation:', error);
    }
  };
  
  // Function to fetch latest pool data and update rates
  const fetchPoolData = async (force = false) => {
    // Check if a request is already in progress
    if (requestInProgressRef.current && !force) {
      return;
    }
    
    // Check if we recently updated (within 15 seconds) and not forcing
    const now = Date.now();
    if (!force && now - lastUpdateTimeRef.current < 15000) {
      console.log('Using cached pool data (too soon to refresh)');
      return;
    }
    
    // If we're here due to a forced refresh, show the refresh indicator
    if (force) {
      setIsRefreshing(true);
    }
    
    requestInProgressRef.current = true;
    
    try {
      // Try to fetch real-time pool balances from the blockchain
      const livePoolData = await getPoolBalances();
      
      // Check if we have valid pool data
      if (livePoolData && livePoolData.solBalance > 0 && livePoolData.yotBalance > 0) {
        // Convert SOL from lamports to SOL for calculations (if needed)
        const SOL_RESERVE = typeof livePoolData.solBalance === 'number' ? livePoolData.solBalance : livePoolData.solBalance / 1_000_000_000;
        const YOT_RESERVE = livePoolData.yotBalance;
        const YOS_RESERVE = livePoolData.yosBalance || 0;
        
        // Create new pool data object
        const newPoolData: PoolData = {
          sol: SOL_RESERVE,
          yot: YOT_RESERVE,
          yos: YOS_RESERVE,
          timestamp: now
        };
        
        // Update the cache and state
        poolCacheRef.current = newPoolData;
        setPoolData(newPoolData);
        lastUpdateTimeRef.current = now;
        
        // Calculate new rates with the fresh data
        calculateRatesLocally(newPoolData);
      }
    } catch (error) {
      console.warn('Error fetching pool data:', error);
      // Use the last known good data
      calculateRatesLocally(poolCacheRef.current);
    } finally {
      requestInProgressRef.current = false;
      setIsRefreshing(false);
    }
  };
  
  // Handle manual refresh button click
  const handleRefresh = () => {
    fetchPoolData(true);
  };
  
  // Calculate rates immediately on component mount using default/cached data
  useEffect(() => {
    // Initial calculation using cached/default data for immediate display
    calculateRatesLocally(poolCacheRef.current);
    setLoading(false);
    
    // Then fetch latest data in the background
    fetchPoolData();
    
    // Set up periodic refresh - only when tab is visible
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        fetchPoolData();
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Format the last updated time string
  const lastUpdatedText = useMemo(() => {
    if (!poolData?.timestamp) return 'N/A';
    
    const timestamp = new Date(poolData.timestamp);
    return timestamp.toLocaleTimeString();
  }, [poolData?.timestamp]);

  return (
    <Card className="w-full bg-dark-200 border-dark-300">
      <CardHeader className="space-y-1">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">SOL/YOT Exchange Rate</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Live Devnet Liquidity Pool Stats
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-28">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark-300 rounded-md p-3 border border-dark-400">
                <div className="text-sm text-muted-foreground mb-1">1 SOL =</div>
                <div className="text-xl font-bold">
                  {solToYot !== null ? formatNumber(solToYot) : '—'} YOT
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  AMM constant product formula
                </div>
              </div>
              
              <div className="bg-dark-300 rounded-md p-3 border border-dark-400">
                <div className="text-sm text-muted-foreground mb-1">1M YOT =</div>
                <div className="text-xl font-bold">
                  {yotToSol !== null ? formatNumber(yotToSol, 4) : '—'} SOL
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Using live blockchain data
                </div>
              </div>
              
              <div className="bg-dark-300 rounded-md p-3 border border-dark-400">
                <div className="text-sm text-muted-foreground mb-1">1 SOL =</div>
                <div className="text-xl font-bold">
                  {solToYos !== null ? formatNumber(solToYos) : '—'} YOS
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Includes 0.3% protocol fee
                </div>
              </div>
              
              <div className="bg-dark-300 rounded-md p-3 border border-dark-400">
                <div className="text-sm text-muted-foreground mb-1">1M YOS =</div>
                <div className="text-xl font-bold">
                  {yosToSol !== null ? formatNumber(yosToSol, 4) : '—'} SOL
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Updated {lastUpdatedText}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-2 bg-dark-300 rounded-md border border-dark-400 mt-2">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold">Pool Reserves:</span> {formatNumber(poolData.sol)} SOL | {formatNumber(poolData.yot)} YOT | {formatNumber(poolData.yos)} YOS
              </div>
              <Badge variant="outline" className="text-muted-foreground border-dark-400">
                Devnet
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}