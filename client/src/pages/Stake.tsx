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
import { Loader2, AlertCircle, ArrowRight, Clock } from "lucide-react";
import { useTokenData } from "@/hooks/useTokenData";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";

export default function Stake() {
  const { connected, publicKey } = useMultiWallet();
  const { balances, loading: isBalancesLoading } = useTokenData();
  const { toast } = useToast();
  
  // Staking state
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [stakingTab, setStakingTab] = useState<string>("stake");
  const [isStaking, setIsStaking] = useState<boolean>(false);
  const [isUnstaking, setIsUnstaking] = useState<boolean>(false);
  
  // Simulated staking data
  const [stakedYOT, setStakedYOT] = useState<number>(0);
  const [earnedYOS, setEarnedYOS] = useState<number>(0);
  const [stakeStartTime, setStakeStartTime] = useState<number | null>(null);
  
  // Staking rate per second (retrieved from admin settings)
  const stakeRatePerSecond = 0.00125 / 100; // 0.00125% per second, convert to decimal
  
  // Effect to simulate earning YOS over time when YOT is staked
  useEffect(() => {
    if (stakedYOT > 0 && stakeStartTime) {
      const timer = setInterval(() => {
        const secondsStaked = Math.floor((Date.now() - stakeStartTime) / 1000);
        const earned = stakedYOT * stakeRatePerSecond * secondsStaked;
        setEarnedYOS(earned);
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [stakedYOT, stakeStartTime]);
  
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
  
  const handleStake = () => {
    if (!connected) {
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
    
    // Simulate staking process
    setTimeout(() => {
      setStakedYOT(prev => prev + amount);
      if (!stakeStartTime) {
        setStakeStartTime(Date.now());
      }
      setStakeAmount("");
      setIsStaking(false);
      
      toast({
        title: "Staking successful",
        description: `You have staked ${amount} YOT tokens and will start earning YOS.`,
      });
    }, 2000);
  };
  
  const handleUnstake = () => {
    if (!connected || stakedYOT <= 0) {
      toast({
        title: "Nothing to unstake",
        description: "You don't have any staked YOT tokens.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUnstaking(true);
    
    // Simulate unstaking process
    setTimeout(() => {
      setStakedYOT(0);
      setStakeStartTime(null);
      setEarnedYOS(0);
      setIsUnstaking(false);
      
      toast({
        title: "Unstaking successful",
        description: "You have unstaked all your YOT tokens.",
      });
    }, 2000);
  };
  
  const handleHarvest = () => {
    if (earnedYOS <= 0) {
      toast({
        title: "Nothing to harvest",
        description: "You haven't earned any YOS tokens yet.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Harvest successful",
      description: `You have harvested ${formatNumber(earnedYOS)} YOS tokens.`,
    });
    
    // Reset earned YOS but keep staking
    setEarnedYOS(0);
    setStakeStartTime(Date.now());
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
                        disabled={!connected || isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0}
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
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          variant="secondary" 
                          className="flex-1" 
                          onClick={handleHarvest}
                          disabled={!connected || earnedYOS <= 0}
                        >
                          Harvest YOS
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="flex-1" 
                          onClick={handleUnstake}
                          disabled={!connected || isUnstaking || stakedYOT <= 0}
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
              <div className="text-xs text-gray-400 w-full">
                <p>Staking YOT tokens earns you YOS tokens over time at a rate of 0.00125% per second.</p>
                <p className="mt-1">You can unstake at any time, but make sure to harvest your rewards first!</p>
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
                  <p>3. Harvest your YOS rewards anytime</p>
                  <p>4. Swap YOS back to YOT when desired</p>
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