import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

export interface UserStats {
  connected: boolean;
  walletAddress: string;
  totalSwapped: number;
  totalContributed: number;
  pendingRewards: number;
  totalRewardsClaimed: number;
}

export interface GlobalStats {
  totalVolume: number;
  liquidityContributed: number;
  rewardsDistributed: number;
  uniqueUsers: number;
}

export function UserStatsPanel() {
  const { wallet, connected } = useWallet();
  const [userStats, setUserStats] = useState<UserStats>({
    connected: false,
    walletAddress: "",
    totalSwapped: 0,
    totalContributed: 0,
    pendingRewards: 0.75, // Example value for demonstration
    totalRewardsClaimed: 0,
  });

  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalVolume: 0,
    liquidityContributed: 0,
    rewardsDistributed: 0,
    uniqueUsers: 0,
  });

  // Fetch user stats when wallet connects
  useEffect(() => {
    if (connected && wallet) {
      // Simplified: In production, this would fetch from blockchain or API
      const walletKey = wallet.publicKey?.toString() || "";
      const shortenedAddress = walletKey 
        ? `${walletKey.substring(0, 6)}...${walletKey.substring(walletKey.length - 4)}`
        : "";
        
      setUserStats({
        connected: true,
        walletAddress: shortenedAddress,
        totalSwapped: 0,
        totalContributed: 0,
        pendingRewards: 0.75, // Example value for demonstration
        totalRewardsClaimed: 0,
      });
      
      // Fetch global stats for the protocol
      fetchGlobalStats();
    }
  }, [connected, wallet]);
  
  // Fetch global stats (simulated)
  const fetchGlobalStats = async () => {
    try {
      // In production, this would call an API or blockchain
      setGlobalStats({
        totalVolume: 0,
        liquidityContributed: 0, 
        rewardsDistributed: 0,
        uniqueUsers: 0,
      });
    } catch (error) {
      console.error("Error fetching global stats:", error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Stats</CardTitle>
        {connected && userStats.walletAddress && (
          <div className="text-sm text-muted-foreground">
            Connected: {userStats.walletAddress}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* User Stats */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Total Swapped</span>
              <span className="font-medium">{userStats.totalSwapped.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Total Contributed</span>
              <span className="font-medium">{userStats.totalContributed.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Pending Rewards</span>
              <span className="font-medium">{userStats.pendingRewards.toFixed(2)} YOS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Total Rewards Claimed</span>
              <span className="font-medium">{userStats.totalRewardsClaimed.toFixed(2)} YOS</span>
            </div>
          </div>
          
          {/* Divider */}
          <div className="my-4 border-t border-border"></div>
          
          {/* Global Stats */}
          <div className="pt-2">
            <h3 className="font-semibold mb-3">Global Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Total Volume</span>
                <span className="font-medium">{globalStats.totalVolume.toFixed(2)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Liquidity Contributed</span>
                <span className="font-medium">{globalStats.liquidityContributed.toFixed(2)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Rewards Distributed</span>
                <span className="font-medium">{globalStats.rewardsDistributed.toFixed(2)} YOS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Unique Users</span>
                <span className="font-medium">{globalStats.uniqueUsers}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}