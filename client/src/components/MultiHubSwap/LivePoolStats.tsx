import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon, ActivityIcon } from 'lucide-react';
import { useWebSocket, PoolData } from '@/hooks/useWebSocket';
import { formatNumber } from '@/lib/utils';

export function LivePoolStats() {
  const { poolData, connectionState, isConnected } = useWebSocket();
  const [previousData, setPreviousData] = useState<PoolData | null>(null);
  const [changes, setChanges] = useState<{ sol: number; yot: number; yos: number; }>({ 
    sol: 0, 
    yot: 0,
    yos: 0
  });

  // Calculate changes when pool data updates
  useEffect(() => {
    if (poolData && previousData) {
      setChanges({
        sol: poolData.sol - previousData.sol,
        yot: poolData.yot - previousData.yot,
        yos: poolData.yos - previousData.yos
      });
    }
    
    if (poolData) {
      setPreviousData(poolData);
    }
  }, [poolData]);

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
          Live Liquidity Pool Stats
        </CardTitle>
        <div className="flex items-center">
          <Badge
            variant={isConnected ? "success" : "destructive"}
            className="flex items-center gap-1"
          >
            <ActivityIcon className={`h-3 w-3 ${isConnected ? 'animate-pulse' : ''}`} />
            {isConnected ? 'Live' : connectionState}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* SOL Balance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">SOL Balance</span>
              <span className="text-sm font-medium flex items-center">
                {poolData ? formatNumber(poolData.sol, 6) : '0.000000'} SOL
                {renderChangeIndicator(changes.sol)}
              </span>
            </div>
            <Progress value={poolData ? Math.min((poolData.sol / 30) * 100, 100) : 0} />
          </div>

          {/* YOT Balance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">YOT Balance</span>
              <span className="text-sm font-medium flex items-center">
                {poolData ? formatNumber(poolData.yot, 6) : '0.000000'} YOT
                {renderChangeIndicator(changes.yot)}
              </span>
            </div>
            <Progress value={poolData ? Math.min((poolData.yot / 1_000_000) * 100, 100) : 0} />
          </div>

          {/* YOS Balance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">YOS Balance</span>
              <span className="text-sm font-medium flex items-center">
                {poolData ? formatNumber(poolData.yos, 6) : '0.000000'} YOS
                {renderChangeIndicator(changes.yos)}
              </span>
            </div>
            <Progress value={poolData ? Math.min((poolData.yos / 1_000_000) * 100, 100) : 0} />
          </div>

          {/* Total Value */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Value (USD)</span>
              <span className="font-bold text-lg">
                ${poolData ? formatNumber(poolData.totalValue, 2) : '0.00'}
              </span>
            </div>
            {poolData && (
              <div className="text-xs text-muted-foreground text-right mt-1">
                Last updated: {new Date(poolData.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}