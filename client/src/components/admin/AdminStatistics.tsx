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
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <Coins className="h-5 w-5 mr-2 text-blue-400" />
              Total YOT Staked
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTokenStats ? (
              <div className="h-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="text-3xl font-bold">
                {(tokenStats?.yotStaked || 0).toLocaleString()} YOT
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Card 2: Program Rate */}
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-400" />
              Current APY
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingState ? (
              <div className="h-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
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
            {programState && (
              <div className="text-sm text-gray-400 mt-1">
                {programState.dailyAPY.toFixed(2)}% daily
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Card 3: Total Stakers */}
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <Users className="h-5 w-5 mr-2 text-purple-400" />
              Total Stakers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStakers ? (
              <div className="h-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="text-3xl font-bold">
                {stakersData?.totalStakers || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Program Settings */}
        <Card className="border-slate-800">
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
                  <Progress value={programState.stakeRatePerSecond * 1000000} max={1000} className="h-2 bg-slate-800" />
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Harvest Threshold</span>
                    <span className="text-sm text-muted-foreground">
                      {programState.harvestThreshold.toLocaleString()} YOS
                    </span>
                  </div>
                  <Progress value={Math.min(programState.harvestThreshold, 100)} max={100} className="h-2 bg-slate-800" />
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
      
        {/* APR/APY Breakdown */}
        <Card className="border-slate-800">
          <CardHeader>
            <CardTitle>APY Rate Breakdown</CardTitle>
            <CardDescription>
              Staking reward rates over different time periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingState ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : programState ? (
              <div className="space-y-2">
                <div className="bg-slate-100 p-3 rounded-md">
                  <div className="flex justify-between items-center text-sm font-medium text-slate-900">
                    <span>Per Second Rate:</span>
                    <span className="font-bold text-green-600">
                      {programState.stakeRatePerSecond.toFixed(8)}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-medium text-muted-foreground">Daily APR:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.dailyAPR.toFixed(2)}%
                    </div>
                  </div>
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-medium text-muted-foreground">Daily APY:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.dailyAPY.toFixed(2)}%
                    </div>
                  </div>
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-medium text-muted-foreground">Weekly APR:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.weeklyAPR.toFixed(2)}%
                    </div>
                  </div>
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-medium text-muted-foreground">Weekly APY:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.weeklyAPY.toFixed(2)}%
                    </div>
                  </div>
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-medium text-muted-foreground">Monthly APR:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.monthlyAPR.toFixed(2)}%
                    </div>
                  </div>
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-medium text-muted-foreground">Monthly APY:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.monthlyAPY.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Yearly APR:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.yearlyAPR.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Yearly APY:</div>
                    <div className="text-sm font-bold text-green-500">
                      {programState.yearlyAPY.toFixed(2)}%
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start mt-3 text-xs text-muted-foreground">
                  <div className="flex-shrink-0 mt-0.5 mr-1">
                    <InfoIcon className="h-3 w-3 text-blue-400" />
                  </div>
                  <div>
                    APR is simple interest, while APY accounts for compounding (reinvesting rewards)
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No rate data available. The program may not be initialized yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Token Holdings */}
      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle>Protocol Token Holdings</CardTitle>
          <CardDescription>
            Tokens controlled by the staking program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTokenStats ? (
            <div className="h-24 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-4 rounded-md border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-300">YOT Token Balance</span>
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">YOT</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {(tokenStats?.yotStaked || 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Staked by users and held by the program
                </div>
              </div>
              
              <div className="bg-slate-900 p-4 rounded-md border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-300">YOS Token Balance</span>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">YOS</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {(tokenStats?.yosRewards || 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Available for distribution as rewards
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}