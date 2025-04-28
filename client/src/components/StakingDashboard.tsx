import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Download, 
  Upload, 
  CheckCircle,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { useStaking } from "@/hooks/useStaking";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from "@/lib/constants";
import { useMultiWallet } from "@/context/MultiWalletContext";
import { formatNumber } from "@/lib/utils";

interface StakingDashboardProps {
  onTabChange?: (tab: string) => void;
}

export default function StakingDashboard({ onTabChange }: StakingDashboardProps = {}) {
  const { connected } = useMultiWallet();
  const { balance: yotBalance } = useTokenBalance(YOT_TOKEN_ADDRESS);
  const { balance: yosBalance } = useTokenBalance(YOS_TOKEN_ADDRESS);
  
  // Get staking info and global staking stats
  const {
    stakingInfo,
    stakingRates,
    isLoading,
    globalStats,
    refreshStakingInfo
  } = useStaking();
  
  // Local state
  const [refreshing, setRefreshing] = useState(false);
  
  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStakingInfo();
    setTimeout(() => setRefreshing(false), 1000); // Visual feedback
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Staking Dashboard</h2>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm" 
          className="gap-2"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Staked (Individual) */}
        <Card className="bg-dark-200 border-border">
          <CardContent className="p-6">
            <h3 className="text-md font-medium text-muted-foreground mb-2">Total Staked</h3>
            {isLoading ? (
              <Skeleton className="h-9 w-40 bg-dark-100" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{formatNumber(stakingInfo.stakedAmount)}</span>
                <span className="text-lg font-semibold text-primary">YOT</span>
                <span className="text-sm text-muted-foreground ml-1">
                  ${formatNumber(stakingInfo.stakedAmount * 0.01)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Earned Rewards */}
        <Card className="bg-dark-200 border-border">
          <CardContent className="p-6">
            <h3 className="text-md font-medium text-muted-foreground mb-2">Earned Rewards</h3>
            {isLoading ? (
              <Skeleton className="h-9 w-40 bg-dark-100" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{formatNumber(stakingInfo.rewardsEarned)}</span>
                <span className="text-lg font-semibold text-green-500">YOS</span>
                <span className="text-sm text-muted-foreground ml-1">
                  ${formatNumber(stakingInfo.rewardsEarned * 0.005)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Additional Stats Row */}
      <div className="grid gap-4 grid-cols-3">
        {/* Annual Rates */}
        <Card className="bg-dark-200 border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Annual Rates</h3>
            {isLoading ? (
              <Skeleton className="h-6 w-28 bg-dark-100" />
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">APR:</span>
                  <span className="text-lg font-bold text-green-400">{(stakingRates?.yearlyAPR || 0).toFixed(2)}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">APY:</span>
                  <span className="text-lg font-bold text-green-400">{(stakingRates?.yearlyAPY || 0).toFixed(2)}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Total Staked (All Users Combined) */}
        <Card className="bg-dark-200 border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Staked (All Users)</h3>
            {isLoading ? (
              <Skeleton className="h-6 w-28 bg-dark-100" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">{formatNumber(globalStats ? globalStats.totalStaked : 0)}</span>
                <span className="text-sm font-semibold text-primary">YOT</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Total Staked Percentage */}
        <Card className="bg-dark-200 border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Your Stake %</h3>
            {isLoading ? (
              <Skeleton className="h-6 w-16 bg-dark-100" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">
                  {globalStats && globalStats.totalStaked ? 
                    ((stakingInfo.stakedAmount / globalStats.totalStaked) * 100).toFixed(2) : 
                    '0.00'}
                </span>
                <span className="text-sm font-semibold text-primary">%</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Total Harvested */}
        <Card className="bg-dark-200 border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Harvested</h3>
            {isLoading ? (
              <Skeleton className="h-6 w-28 bg-dark-100" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.totalHarvested)}</span>
                <span className="text-sm font-semibold text-green-500">YOS</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3 mt-4">
        <Button 
          variant="default" 
          className="flex gap-2 bg-primary text-white hover:bg-primary/90 font-medium" 
          disabled={!connected}
          onClick={() => onTabChange && onTabChange("stake")}
        >
          <Download className="h-4 w-4" /> Stake YOT
        </Button>
        <Button 
          variant="default" 
          className="flex gap-2 bg-secondary text-white hover:bg-secondary/90 font-medium" 
          disabled={!connected || stakingInfo.stakedAmount <= 0}
          onClick={() => onTabChange && onTabChange("unstake")}
        >
          <Upload className="h-4 w-4" /> Unstake YOT
        </Button>
        <Button 
          variant="default" 
          className="flex gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700 font-medium" 
          disabled={!connected || stakingInfo.rewardsEarned <= 0}
          onClick={() => onTabChange && onTabChange("harvest")}
        >
          <CheckCircle className="h-4 w-4" /> Harvest Rewards
        </Button>
      </div>
    </div>
  );
}