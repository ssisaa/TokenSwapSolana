import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, Coins, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { connection } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { STAKING_PROGRAM_ID, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from "@/lib/constants";
import { getStakingProgramState } from "@/lib/solana-staking";
import { Progress } from "@/components/ui/progress";

// Find program state address
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('program_state')],
    new PublicKey(STAKING_PROGRAM_ID)
  );
}

export default function AdminStatistics() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Query staking program state
  const { 
    data: programState, 
    isLoading: isLoadingState,
    error: stateError,
    refetch: refetchState
  } = useQuery({
    queryKey: ['stakingProgramState', refreshTrigger],
    queryFn: async () => {
      try {
        return await getStakingProgramState();
      } catch (error) {
        console.error("Error fetching staking program state:", error);
        throw error;
      }
    },
    retry: 1,
    enabled: true
  });
  
  // Query token accounts to check total staked and rewards
  const {
    data: tokenStats,
    isLoading: isLoadingTokenStats,
    refetch: refetchTokenStats
  } = useQuery({
    queryKey: ['tokenStats', refreshTrigger],
    queryFn: async () => {
      // Find program authority address
      const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority')],
        new PublicKey(STAKING_PROGRAM_ID)
      );
      
      // Get token accounts owned by the program authority
      try {
        const response = await connection.getParsedTokenAccountsByOwner(
          programAuthorityAddress,
          {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") // Solana token program ID
          }
        );
        
        let yotStaked = 0;
        let yosRewards = 0;
        
        for (const item of response.value) {
          const tokenInfo = item.account.data.parsed.info;
          const mintAddress = tokenInfo.mint;
          const amount = Number(tokenInfo.tokenAmount.amount) / (10 ** tokenInfo.tokenAmount.decimals);
          
          if (mintAddress === YOT_TOKEN_ADDRESS) {
            yotStaked = amount;
          } else if (mintAddress === YOS_TOKEN_ADDRESS) {
            yosRewards = amount;
          }
        }
        
        return {
          yotStaked,
          yosRewards
        };
      } catch (error) {
        console.error("Error fetching token stats:", error);
        return {
          yotStaked: 0,
          yosRewards: 0
        };
      }
    },
    retry: 1,
    enabled: true
  });
  
  // Query for total stakers
  const {
    data: stakersData,
    isLoading: isLoadingStakers,
    refetch: refetchStakers
  } = useQuery({
    queryKey: ['stakersCount', refreshTrigger],
    queryFn: async () => {
      try {
        // This is a simple approximation - in a production environment,
        // you would query all staking accounts by gpa (getProgramAccounts)
        const response = await connection.getProgramAccounts(
          new PublicKey(STAKING_PROGRAM_ID),
          {
            filters: [
              { dataSize: 73 }, // Approximate size of a staking account
            ]
          }
        );
        
        return {
          totalStakers: response.length
        };
      } catch (error) {
        console.error("Error fetching stakers count:", error);
        return {
          totalStakers: 0
        };
      }
    },
    retry: 1,
    enabled: true
  });
  
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    refetchState();
    refetchTokenStats();
    refetchStakers();
  };
  
  const isLoading = isLoadingState || isLoadingTokenStats || isLoadingStakers;
  
  if (stateError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-red-500">Error Loading Statistics</CardTitle>
          <CardDescription>
            Could not load program statistics. Please ensure the staking program is initialized.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Staking Program Statistics</h2>
        <Button 
          onClick={handleRefresh} 
          variant="outline"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Data
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Staked */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <Coins className="h-5 w-5 mr-2 text-blue-500" />
              Total YOT Staked
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTokenStats ? (
              <div className="h-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="text-3xl font-bold">
                {(tokenStats?.yotStaked || 0).toLocaleString()} YOT
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Card 2: Program Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
              Current APY
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingState ? (
              <div className="h-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="text-3xl font-bold">
                {programState ? 
                  // Convert rate to APY percentage 
                  // With 0.00125% per second, this should be close to 39,420% per year
                  `${programState.yearlyAPR.toFixed(2)}%` 
                  : "0.00%"}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Card 3: Total Stakers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <Users className="h-5 w-5 mr-2 text-purple-500" />
              Total Stakers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStakers ? (
              <div className="h-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="text-3xl font-bold">
                {stakersData?.totalStakers || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Program Settings</CardTitle>
          <CardDescription>
            Current settings from the staking program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingState ? (
            <div className="h-24 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : programState ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Staking Rate</span>
                  <span className="text-sm text-muted-foreground">
                    {(programState.stakeRatePerSecond * 100).toFixed(6)}% per second
                  </span>
                </div>
                <Progress value={programState.stakeRatePerSecond * 1000000} max={1000} />
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Harvest Threshold</span>
                  <span className="text-sm text-muted-foreground">
                    {programState.harvestThreshold.toLocaleString()} YOS
                  </span>
                </div>
                <Progress value={Math.min(programState.harvestThreshold, 100)} max={100} />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <span className="text-sm text-muted-foreground">YOT Token</span>
                  <div className="font-mono text-xs truncate mt-1">
                    {YOT_TOKEN_ADDRESS}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">YOS Token</span>
                  <div className="font-mono text-xs truncate mt-1">
                    {YOS_TOKEN_ADDRESS}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              No program state available. The program may not be initialized yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}