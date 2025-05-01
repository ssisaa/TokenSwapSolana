import React from 'react';
import { usePoolData } from '@/hooks/usePoolData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  RefreshCwIcon, 
  WifiIcon, 
  WifiOffIcon 
} from "lucide-react";

// Helper to format numbers with K/M/B suffixes
const formatNumber = (value: number, decimals = 2): string => {
  if (value === 0) return '0';
  
  const absValue = Math.abs(value);
  
  if (absValue < 1000) {
    return value.toFixed(decimals);
  } else if (absValue < 1000000) {
    return (value / 1000).toFixed(decimals) + 'K';
  } else if (absValue < 1000000000) {
    return (value / 1000000).toFixed(decimals) + 'M';
  } else {
    return (value / 1000000000).toFixed(decimals) + 'B';
  }
};

export default function LivePoolStatsOptimized() {
  const { poolData, error, isConnected, refreshData } = usePoolData();
  const [previousData, setPreviousData] = React.useState<any>(null);
  const [changes, setChanges] = React.useState<{sol: number, yot: number, yos: number}>({
    sol: 0,
    yot: 0,
    yos: 0
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  
  // Calculate changes when pool data updates
  React.useEffect(() => {
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
  
  // Handle manual refresh with UI feedback
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
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
  
  if (error) {
    return (
      <Card className="w-full bg-card border-destructive">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-destructive flex items-center">
            Pool Data Error
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto" 
              onClick={handleRefresh}
            >
              <RefreshCwIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  if (!poolData) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pool Data</CardTitle>
          <CardDescription>Loading pool statistics...</CardDescription>
        </CardHeader>
        <CardContent className="animate-pulse space-y-2">
          <div className="h-5 bg-muted rounded w-3/4"></div>
          <div className="h-5 bg-muted rounded w-1/2"></div>
          <div className="h-5 bg-muted rounded w-2/3"></div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          Pool Statistics
          {isConnected ? (
            <Badge variant="outline" className="ml-2 flex gap-1 items-center">
              <WifiIcon className="h-3 w-3 text-green-500" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-2 flex gap-1 items-center">
              <WifiOffIcon className="h-3 w-3 text-amber-500" />
              Polling
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto" 
            onClick={handleRefresh}
          >
            <RefreshCwIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Updated {Math.floor((Date.now() - poolData.timestamp) / 1000)}s ago
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">SOL Balance:</span>
          <span className="font-mono text-sm flex items-center">
            {formatNumber(poolData.sol, 4)} SOL
            {renderChangeIndicator(changes.sol)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">YOT Balance:</span>
          <span className="font-mono text-sm flex items-center">
            {formatNumber(poolData.yot)} YOT
            {renderChangeIndicator(changes.yot)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">YOS Balance:</span>
          <span className="font-mono text-sm flex items-center">
            {formatNumber(poolData.yos)} YOS
            {renderChangeIndicator(changes.yos)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Total Pool Value:</span>
          <span className="font-mono text-sm font-bold">
            ${formatNumber(poolData.totalValue, 2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}