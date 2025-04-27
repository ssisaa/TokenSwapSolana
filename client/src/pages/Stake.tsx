import { useState, useEffect } from "react";
import { useMultiWallet } from "@/context/MultiWalletContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowRight, Clock, Info } from "lucide-react";
import { useTokenData } from "@/hooks/useTokenData";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { AdminSettings } from "@shared/schema";
import { stakeYOTTokens, unstakeYOTTokens, harvestYOSRewards, getStakingInfo } from "@/lib/staking";

export default function Stake() {
  const { connected, publicKey } = useMultiWallet();
  const { balances, loading: isBalancesLoading, fetchBalances } = useTokenData();
  const { toast } = useToast();
  
  // Effect to fetch balances when wallet is connected
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances(publicKey.toString());
    }
  }, [connected, publicKey, fetchBalances]);
  
  // Staking state
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [stakingTab, setStakingTab] = useState<string>("stake");
  const [isStaking, setIsStaking] = useState<boolean>(false);
  const [isUnstaking, setIsUnstaking] = useState<boolean>(false);
  const [isHarvesting, setIsHarvesting] = useState<boolean>(false);
  
  // Blockchain staking data
  const [stakedYOT, setStakedYOT] = useState<number>(0);
  const [earnedYOS, setEarnedYOS] = useState<number>(0);
  const [stakeStartTime, setStakeStartTime] = useState<number | null>(null);
  
  // Fetch admin settings from API with auto-refresh
  const { data: adminSettings, isLoading: isSettingsLoading } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 2000, // Poll every 2 seconds for updates
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Staking rate from admin settings in database
  const stakeRatePerSecond = adminSettings?.stakeRatePerSecond 
    ? parseFloat(adminSettings.stakeRatePerSecond.toString()) / 100 
    : 0.00125 / 100; // 0.00125% per second default, convert to decimal
  
  // Harvest threshold from admin settings
  const harvestThreshold = adminSettings?.harvestThreshold 
    ? parseFloat(adminSettings.harvestThreshold.toString()) 
    : 100; // Default threshold of 100 YOS
  
  // Setup a timer to update earned rewards in real-time
  useEffect(() => {
    // If not staking, don't bother with the interval
    if (stakedYOT <= 0 || !stakeStartTime) return;
    
    // Update rewards calculation every second
    const updateInterval = setInterval(() => {
      // Calculate time staked in seconds
      const timeStakedMs = Date.now() - stakeStartTime;
      const timeStakedSeconds = timeStakedMs / 1000;
      
      // Calculate rewards based on current rate
      const rewards = stakedYOT * timeStakedSeconds * stakeRatePerSecond;
      setEarnedYOS(rewards);
    }, 1000);
    
    // Log for debugging
    console.log(`Live staking rate updated: ${stakeRatePerSecond * 100}% per second`);
    
    // Cleanup the interval on component unmount
    return () => clearInterval(updateInterval);
  }, [stakedYOT, stakeStartTime, stakeRatePerSecond]);
  
  // Check current staked amount and rewards on component mount, wallet connection, and admin settings change
  useEffect(() => {
    if (connected && publicKey) {
      // In a production environment, we would fetch this data from the blockchain
      // using the user's wallet address to get their staked tokens and rewards
      checkStakedBalance(publicKey.toString());
      
      // Log admin settings changes for debugging
      if (adminSettings) {
        console.log(`Admin settings detected: Stake Rate = ${stakeRatePerSecond * 100}%, Threshold = ${harvestThreshold} YOS`);
      }
    }
  }, [connected, publicKey, adminSettings, stakeRatePerSecond, harvestThreshold]); // Re-run when admin settings change
  
  // Function to check staked balance from blockchain
  const checkStakedBalance = async (walletAddress: string) => {
    try {
      // Get staking info from our staking library
      const stakingInfo = await getStakingInfo(walletAddress);
      
      setStakedYOT(stakingInfo.stakedAmount);
      setEarnedYOS(stakingInfo.rewardsEarned);
      setStakeStartTime(stakingInfo.startTimestamp);
    } catch (error) {
      console.error("Error checking staked balance:", error);
    }
  };
  
  const handleStakeAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setStakeAmount(value);
    }
  };
  
  const setMaxAmount = () => {
    if (balances && balances.yot) {
      setStakeAmount(balances.yot.toString());
    }
  };
  
  const handleStake = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to stake YOT tokens.",
        variant: "destructive",
      });
      return;
    }
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to stake.",
        variant: "destructive",
      });
      return;
    }
    
    if (balances && amount > balances.yot) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough YOT tokens to stake this amount.",
        variant: "destructive",
      });
      return;
    }
    
    setIsStaking(true);
    
    try {
      // Use our staking library to stake tokens
      const success = await stakeYOTTokens(publicKey.toString(), amount);
      
      if (success) {
        toast({
          title: "Staking Successful",
          description: `Successfully staked ${formatNumber(amount)} YOT tokens.`,
        });
        
        // Refresh staking data
        await checkStakedBalance(publicKey.toString());
        
        // Refresh wallet balances
        await fetchBalances(publicKey.toString());
        
        // Reset the form
        setStakeAmount("");
      } else {
        toast({
          title: "Staking Failed",
          description: "Failed to stake tokens. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error staking tokens:", error);
      toast({
        title: "Staking failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  };
  
  const handleUnstake = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to unstake YOT tokens.",
        variant: "destructive",
      });
      return;
    }
    
    if (stakedYOT <= 0) {
      toast({
        title: "Nothing to unstake",
        description: "You don't have any staked YOT tokens.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUnstaking(true);
    
    try {
      // Use our staking library to unstake tokens
      const success = await unstakeYOTTokens(publicKey.toString());
      
      if (success) {
        toast({
          title: "Unstaking Successful",
          description: `Successfully unstaked ${formatNumber(stakedYOT)} YOT tokens.`,
        });
        
        // Refresh staking data
        await checkStakedBalance(publicKey.toString());
        
        // Refresh wallet balances
        await fetchBalances(publicKey.toString());
      } else {
        toast({
          title: "Unstaking Failed",
          description: "Failed to unstake tokens. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error unstaking tokens:", error);
      toast({
        title: "Unstaking failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUnstaking(false);
    }
  };
  
  const handleHarvest = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to harvest YOS rewards.",
        variant: "destructive",
      });
      return;
    }
    
    if (earnedYOS <= 0) {
      toast({
        title: "Nothing to harvest",
        description: "You haven't earned any YOS tokens yet.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if earned YOS is above the harvest threshold
    if (earnedYOS < harvestThreshold) {
      toast({
        title: "Below harvest threshold",
        description: `You need at least ${harvestThreshold} YOS tokens to harvest. You currently have ${formatNumber(earnedYOS)} YOS.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsHarvesting(true);
    
    try {
      // Use our staking library to harvest rewards
      const success = await harvestYOSRewards(publicKey.toString());
      
      if (success) {
        toast({
          title: "Harvesting Successful",
          description: `Successfully harvested ${formatNumber(earnedYOS)} YOS tokens.`,
        });
        
        // Refresh staking data
        await checkStakedBalance(publicKey.toString());
        
        // Refresh wallet balances
        await fetchBalances(publicKey.toString());
      } else {
        toast({
          title: "Harvesting Failed",
          description: "Failed to harvest rewards. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error harvesting rewards:", error);
      toast({
        title: "Harvesting failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsHarvesting(false);
    }
  };
  
  // Calculate APY based on the per-second rate
  const calculateAPY = () => {
    const secondsInYear = 365 * 24 * 60 * 60;
    const apy = (stakeRatePerSecond * secondsInYear) * 100;
    return apy.toFixed(2);
  };
  
  // Time since staking started
  const getStakingTime = () => {
    if (!stakeStartTime) return "Not staking";
    
    const seconds = Math.floor((Date.now() - stakeStartTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Staking Card */}
          <Card className="flex-1 bg-dark-200 border-dark-400">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">Stake YOT</CardTitle>
              <CardDescription className="text-gray-400">
                Stake your YOT tokens and earn YOS rewards
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-6">
                {/* Staking Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-dark-300 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">APY</p>
                    <p className="text-green-400 text-2xl font-bold">{calculateAPY()}%</p>
                  </div>
                  <div className="bg-dark-300 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Total Staked</p>
                    <p className="text-white text-2xl font-bold">{formatNumber(stakedYOT)} YOT</p>
                  </div>
                  <div className="bg-dark-300 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-gray-400 text-sm">YOS Earned</p>
                      {earnedYOS >= harvestThreshold && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          Ready to Harvest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-primary-400 text-2xl font-bold">{formatNumber(earnedYOS)} YOS</p>
                      {earnedYOS > 0 && earnedYOS < harvestThreshold && (
                        <span className="text-xs text-gray-400">
                          ({((earnedYOS / harvestThreshold) * 100).toFixed(0)}% of threshold)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Staking Progress */}
                {stakedYOT > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-400">Staking Time</span>
                      <span className="text-sm text-white flex items-center">
                        <Clock className="h-3 w-3 mr-1" /> {getStakingTime()}
                      </span>
                    </div>
                    <Progress value={Math.min((earnedYOS / stakedYOT) * 100, 100)} className="h-1.5" />
                  </div>
                )}
                
                {/* Staking Actions */}
                <Tabs value={stakingTab} onValueChange={setStakingTab}>
                  <TabsList className="grid grid-cols-2 w-full bg-dark-300">
                    <TabsTrigger value="stake">Stake</TabsTrigger>
                    <TabsTrigger value="unstake">Unstake</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="stake" className="pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="stake-amount">Amount to Stake</Label>
                          {connected && balances && (
                            <span className="text-xs text-gray-400">
                              Balance: {formatNumber(balances.yot)} YOT
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="stake-amount"
                            placeholder="0.0"
                            value={stakeAmount}
                            onChange={handleStakeAmountChange}
                            className="bg-dark-300 border-primary-400 text-white text-lg font-medium"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={setMaxAmount}
                            className="border-dark-400 text-primary-400"
                          >
                            MAX
                          </Button>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        onClick={handleStake}
                        disabled={isStaking}
                      >
                        {isStaking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Staking...
                          </>
                        ) : (
                          "Stake YOT"
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="unstake" className="pt-4">
                    <div className="space-y-4">
                      <Alert className="bg-dark-300 border-dark-400">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Unstaking Information</AlertTitle>
                        <AlertDescription>
                          Unstaking will retrieve all of your staked YOT tokens.
                          Make sure to harvest your earned YOS first!
                        </AlertDescription>
                      </Alert>
                      
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Your Staked YOT</Label>
                              <span className="text-xs px-2 py-0.5 rounded bg-primary-400/20 text-primary-400">
                                {formatNumber(stakedYOT)} YOT
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">
                              Value: ${formatNumber(stakedYOT * (balances?.solUsd || 0) / (balances?.sol || 1))}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleHarvest}
                          disabled={isHarvesting || earnedYOS < harvestThreshold}
                          className="border-dark-400"
                        >
                          {isHarvesting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Harvesting...
                            </>
                          ) : (
                            "Harvest YOS"
                          )}
                        </Button>
                        <Button 
                          onClick={handleUnstake}
                          disabled={isUnstaking || stakedYOT <= 0}
                        >
                          {isUnstaking ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Unstaking...
                            </>
                          ) : (
                            "Unstake All"
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-dark-400 pt-4">
              <Alert className="bg-dark-300 border-dark-400">
                <Info className="h-4 w-4" />
                <AlertTitle>Staking Information</AlertTitle>
                <AlertDescription className="text-gray-400">
                  <p>APY: <span className="text-white">{calculateAPY()}%</span></p>
                  <p>Harvest Threshold: <span className="text-white">{harvestThreshold} YOS</span></p>
                  <p className="text-xs mt-1">
                    Stake YOT tokens to earn YOS. YOS will be harvestable once you reach the threshold.
                  </p>
                </AlertDescription>
              </Alert>
            </CardFooter>
          </Card>
          
          {/* Info Cards */}
          <div className="flex flex-col gap-4 w-full md:w-96">
            <Card className="bg-dark-200 border-dark-400">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Staking Rewards</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-dark-300 p-3 rounded-lg space-y-2">
                    <h4 className="text-white font-medium">How rewards work</h4>
                    <p className="text-gray-400 text-sm">
                      Staking YOT tokens earns you YOS tokens at a rate of {(stakeRatePerSecond * 100).toFixed(6)}% per second.
                      This equals approximately {(stakeRatePerSecond * 3600 * 100).toFixed(4)}% per hour.
                    </p>
                  </div>
                  <div className="bg-dark-300 p-3 rounded-lg space-y-2">
                    <h4 className="text-white font-medium">Harvest Threshold</h4>
                    <p className="text-gray-400 text-sm">
                      You need to accumulate at least {harvestThreshold} YOS tokens before you can harvest your rewards.
                      Current progress: {earnedYOS > 0 ? `${((earnedYOS / harvestThreshold) * 100).toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-dark-200 border-dark-400">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">YOT Utility</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">
                  YOT tokens can be staked to earn YOS rewards. You can also use YOT tokens for swapping, providing liquidity, and more.
                </p>
                <div className="mt-4 bg-dark-300 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary-400" />
                    <span className="text-sm text-white">Swap YOT and SOL with low fees</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <ArrowRight className="h-4 w-4 text-primary-400" />
                    <span className="text-sm text-white">Stake YOT to earn YOS rewards</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <ArrowRight className="h-4 w-4 text-primary-400" />
                    <span className="text-sm text-white">Provide liquidity to earn additional rewards</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}