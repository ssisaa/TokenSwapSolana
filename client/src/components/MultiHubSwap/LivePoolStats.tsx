import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon, ActivityIcon, RefreshCwIcon } from 'lucide-react';
import { useWebSocket, PoolData } from '@/hooks/useWebSocket';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function LivePoolStats() {
  const { poolData, connectionState, isConnected, connect } = useWebSocket();
  const [previousData, setPreviousData] = useState<PoolData | null>(null);
  const [fallbackData, setFallbackData] = useState<PoolData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [changes, setChanges] = useState<{ sol: number; yot: number; yos: number; }>({ 
    sol: 0, 
    yot: 0,
    yos: 0
  });

  // Function to fetch pool data directly from API if WebSocket fails
  const fetchPoolDataFromAPI = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pool');
      if (response.ok) {
        const data = await response.json();
        // Transform to match PoolData interface
        // Calculate pool value based on real AMM formula: liquidity = sqrt(solAmount * yotAmount)
        const solAmount = data.solBalance || 0;
        const yotAmount = data.yotBalance || 0;
        
        // Price calculation based on AMM constant product formula
        // For SOL-YOT pool, price of YOT in SOL = solAmount / yotAmount
        // Convert to USD using SOL price of $148.35
        const yotPriceInSol = yotAmount > 0 ? solAmount / yotAmount : 0;
        const yotPriceInUsd = yotPriceInSol * 148.35;
        
        // Total value calculation using AMM invariant
        // The value of a liquidity pool typically is 2× the value of one asset side
        const poolValueInSol = 2 * solAmount;
        const poolValueInUsd = poolValueInSol * 148.35;
        
        const poolData: PoolData = {
          sol: solAmount,
          yot: yotAmount,
          yos: 0, // YOS balance will be tracked in future when available
          // Total value in USD based on AMM calculation
          totalValue: poolValueInUsd,
          timestamp: Date.now()
        };
        setFallbackData(poolData);
      }
    } catch (error) {
      console.error('Error fetching pool data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Try to fetch data from API if WebSocket is not connected
  useEffect(() => {
    if (!isConnected && connectionState === 'closed' && !fallbackData) {
      fetchPoolDataFromAPI();
    }
  }, [isConnected, connectionState, fallbackData]);

  // Handle manual refresh
  const handleRefresh = () => {
    if (isConnected) {
      // Attempt to reconnect WebSocket
      connect();
    } else {
      // Fetch from API directly
      fetchPoolDataFromAPI();
    }
  };

  // Calculate changes when pool data updates
  useEffect(() => {
    // Use WebSocket data if available, otherwise use fallback data
    const currentData = poolData || fallbackData;
    
    if (currentData && previousData) {
      setChanges({
        sol: currentData.sol - previousData.sol,
        yot: currentData.yot - previousData.yot,
        yos: currentData.yos - previousData.yos
      });
    }
    
    if (currentData) {
      setPreviousData(currentData);
    }
  }, [poolData, fallbackData]);

  // Helper to render change indicators
  const renderChangeIndicator = (value: number) => {
    if (value === 0) return null;
    
    return value > 0 ? (
      <Badge variant="success" className="ml-2 flex items-center gap-1">
        <ArrowUpIcon className="h-3 w-3" />
        +{formatNumber(value, 6)}
      </Badge>
    ) : (
      <Badge variant="destructive" className="ml-2 flex items-center gap-1">
        <ArrowDownIcon className="h-3 w-3" />
        {formatNumber(value, 6)}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Devnet Liquidity Pool Stats
        </CardTitle>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCwIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
          </Button>
          <Badge
            variant={isConnected ? "success" : (fallbackData ? "secondary" : "destructive")}
            className="flex items-center gap-1"
          >
            <ActivityIcon className={`h-3 w-3 ${isConnected ? 'animate-pulse' : ''}`} />
            {isConnected ? 'Live' : (fallbackData ? 'Static' : connectionState)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Display a loading state if needed */}
          {isLoading && !poolData && !fallbackData && (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <RefreshCwIcon className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Loading pool data...</p>
            </div>
          )}

          {/* Display data from WebSocket or fallback API */}
          {(poolData || fallbackData) && (
            <>
              {/* Devnet Notice */}
              <div className="mb-4 p-3 bg-secondary/50 rounded-md text-xs text-muted-foreground">
                <p>These stats display token accounts on Solana <strong>devnet</strong> that will be used for the liquidity pool. 
                YOT and YOS tokens are in development, and this component will show real token balances after launch.</p>
              </div>
              
              {/* SOL Balance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">SOL Balance</span>
                  <span className="text-sm font-medium flex items-center">
                    {formatNumber((poolData || fallbackData)!.sol, 6)} SOL
                    {renderChangeIndicator(changes.sol)}
                  </span>
                </div>
                <Progress value={(poolData || fallbackData) ? Math.min(((poolData || fallbackData)!.sol / 30) * 100, 100) : 0} />
              </div>

              {/* YOT Balance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">YOT Balance</span>
                  <span className="text-sm font-medium flex items-center">
                    {formatNumber((poolData || fallbackData)!.yot, 6)} YOT
                    {renderChangeIndicator(changes.yot)}
                  </span>
                </div>
                <Progress value={(poolData || fallbackData) ? Math.min(((poolData || fallbackData)!.yot / 1_000_000) * 100, 100) : 0} />
              </div>

              {/* YOS Balance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">YOS Balance</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium">Not Available Yet</span>
                    <Badge variant="outline" className="ml-2 text-xs">Coming Soon</Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Progress value={0} className="flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">0.000000 YOS</span>
                </div>
              </div>

              {/* Total Value */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Value (USD)</span>
                  <span className="font-bold text-lg">
                    ${formatNumber((poolData || fallbackData)!.totalValue, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {!isConnected && fallbackData ? 'Using API data (WebSocket unavailable)' : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Last updated: {new Date((poolData || fallbackData)!.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* No data available state */}
          {!isLoading && !poolData && !fallbackData && (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <ActivityIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">No pool data available</p>
              <Button variant="secondary" size="sm" onClick={handleRefresh}>
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Fetch Pool Data
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}