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
  
  // Fetch admin settings from API
  const { data: adminSettings, isLoading: isSettingsLoading } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  // Staking rate from admin settings in database
  const stakeRatePerSecond = adminSettings?.stakeRatePerSecond 
    ? parseFloat(adminSettings.stakeRatePerSecond.toString()) / 100 
    : 0.00125 / 100; // 0.00125% per second default, convert to decimal
  
  // Harvest threshold from admin settings
  const harvestThreshold = adminSettings?.harvestThreshold 
    ? parseFloat(adminSettings.harvestThreshold.toString()) 
    : 100; // Default threshold of 100 YOS
  
  // Check current staked amount and rewards on component mount and wallet connection
  useEffect(() => {
    if (connected && publicKey) {
      // In a production environment, we would fetch this data from the blockchain
      // using the user's wallet address to get their staked tokens and rewards
      checkStakedBalance(publicKey.toString());
    }
  }, [connected, publicKey]);
  
  // Function to check staked balance from blockchain
  const checkStakedBalance = async (walletAddress: string) => {
    try {
      // This would be replaced with an actual blockchain query
      // to retrieve staked token amounts and staking start time
      
      // For now, we'll reset the state until the appropriate blockchain
      // methods are implemented
      setStakedYOT(0);
      setEarnedYOS(0);
      setStakeStartTime(null);
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
      // In a production environment, this would create and send a Solana 
      // transaction to stake the tokens using the connected wallet
      
      toast({
        title: "Staking not implemented",
        description: "The staking blockchain functionality needs to be implemented using Solana program calls.",
        variant: "destructive",
      });
      
      // Reset the form
      setStakeAmount("");
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
      // In a production environment, this would create and send a Solana 
      // transaction to unstake the tokens using the connected wallet
      
      toast({
        title: "Unstaking not implemented",
        description: "The unstaking blockchain functionality needs to be implemented using Solana program calls.",
        variant: "destructive",
      });
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
      // In a production environment, this would create and send a Solana 
      // transaction to harvest the rewards using the connected wallet
      
      toast({
        title: "Harvesting not implemented",
        description: "The harvesting blockchain functionality needs to be implemented using Solana program calls.",
        variant: "destructive",
      });
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
                    <p className="text-gray-400 text-sm">YOS Earned</p>
                    <p className="text-primary-400 text-2xl font-bold">{formatNumber(earnedYOS)} YOS</p>
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
                            className="bg-dark-300 border-dark-400"
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
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary-400" />
                          <span className="text-xs text-gray-400">
                            Minimum {harvestThreshold} YOS required to harvest rewards
                          </span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            variant="secondary" 
                            className="flex-1" 
                            onClick={handleHarvest}
                            disabled={isHarvesting || earnedYOS <= 0}
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
                            variant="destructive" 
                            className="flex-1" 
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
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-dark-400 pt-4">
              <div className="text-xs text-gray-400 w-full">
                <p>Staking YOT tokens earns you YOS tokens over time at a rate of {(stakeRatePerSecond * 100).toFixed(6)}% per second.</p>
                <p className="mt-1">You can unstake at any time, but make sure to harvest your rewards first!</p>
                <p className="mt-1">Note: You need to accumulate at least <span className="text-primary-400">{harvestThreshold} YOS</span> tokens before you can harvest.</p>
              </div>
            </CardFooter>
          </Card>
          
          {/* Info Card */}
          <div className="md:w-1/3 space-y-4">
            <Card className="bg-dark-200 border-dark-400">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white">How Staking Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-2xl">
                    YOT
                  </div>
                  <ArrowRight className="text-gray-400" />
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-green-200 flex items-center justify-center text-dark-900 font-bold">
                    Earn YOS
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-400">
                  <p>1. Stake your YOT tokens to earn YOS rewards</p>
                  <p>2. Rewards accumulate every second at {(stakeRatePerSecond * 100).toFixed(6)}% per second</p>
                  <p>3. You'll need at least {harvestThreshold} YOS to harvest</p>
                  <p>4. Harvest your YOS rewards when ready</p>
                  <p>5. Swap YOS back to YOT when desired</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-dark-200 border-dark-400">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white">Staking Benefits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-400">
                <p>• Earn passive income through YOS rewards</p>
                <p>• Support the YOT ecosystem</p>
                <p>• No lockup period - unstake anytime</p>
                <p>• Competitive APY of {calculateAPY()}%</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}