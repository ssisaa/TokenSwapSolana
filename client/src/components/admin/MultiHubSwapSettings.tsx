import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { updateMultiHubSwapParameters, getMultiHubSwapStats } from '@/lib/multi-hub-swap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function MultiHubSwapSettings() {
  const { wallet } = useMultiWallet();
  const queryClient = useQueryClient();
  
  // State for form fields
  const [buyUserPercent, setBuyUserPercent] = useState<number>(75);
  const [buyLiquidityPercent, setBuyLiquidityPercent] = useState<number>(20);
  const [buyCashbackPercent, setBuyCashbackPercent] = useState<number>(5);
  
  const [sellUserPercent, setSellUserPercent] = useState<number>(75);
  const [sellLiquidityPercent, setSellLiquidityPercent] = useState<number>(20);
  const [sellCashbackPercent, setSellCashbackPercent] = useState<number>(5);
  
  const [weeklyRewardRate, setWeeklyRewardRate] = useState<number>(1.92);
  const [activeTab, setActiveTab] = useState<string>('buy');
  
  // Query to get current settings
  const { data: swapStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['multi-hub-swap-stats-admin'],
    queryFn: async () => {
      return await getMultiHubSwapStats();
    },
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Mutation to update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("Wallet not connected");
      
      return await updateMultiHubSwapParameters(
        wallet,
        buyUserPercent,
        buyLiquidityPercent,
        buyCashbackPercent,
        sellUserPercent,
        sellLiquidityPercent,
        sellCashbackPercent,
        weeklyRewardRate
      );
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Multi-Hub Swap parameters have been updated successfully.",
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['multi-hub-swap-stats'] });
      queryClient.invalidateQueries({ queryKey: ['multi-hub-swap-stats-admin'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Load initial values from stats
  useEffect(() => {
    if (swapStats) {
      setBuyUserPercent(swapStats.buyDistribution.userPercent);
      setBuyLiquidityPercent(swapStats.buyDistribution.liquidityPercent);
      setBuyCashbackPercent(swapStats.buyDistribution.cashbackPercent);
      
      setSellUserPercent(swapStats.sellDistribution.userPercent);
      setSellLiquidityPercent(swapStats.sellDistribution.liquidityPercent);
      setSellCashbackPercent(swapStats.sellDistribution.cashbackPercent);
      
      setWeeklyRewardRate(swapStats.weeklyRewardRate);
    }
  }, [swapStats]);
  
  // Validate that percentages add up to 100%
  const validateBuyPercentages = (): boolean => {
    return buyUserPercent + buyLiquidityPercent + buyCashbackPercent === 100;
  };
  
  const validateSellPercentages = (): boolean => {
    return sellUserPercent + sellLiquidityPercent + sellCashbackPercent === 100;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate percentages
    if (!validateBuyPercentages()) {
      toast({
        title: "Invalid Buy Percentages",
        description: "Buy distribution percentages must add up to 100%.",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateSellPercentages()) {
      toast({
        title: "Invalid Sell Percentages",
        description: "Sell distribution percentages must add up to 100%.",
        variant: "destructive",
      });
      return;
    }
    
    updateSettingsMutation.mutate();
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Multi-Hub Swap Settings</CardTitle>
        <CardDescription>
          Configure the token distribution percentages and reward rates
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoadingStats ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="buy" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="buy">Buy Distribution</TabsTrigger>
                <TabsTrigger value="sell">Sell Distribution</TabsTrigger>
                <TabsTrigger value="rewards">Reward Rates</TabsTrigger>
              </TabsList>
              
              <TabsContent value="buy" className="space-y-4">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="buyUserPercent">User Percent</Label>
                    <Input 
                      id="buyUserPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={buyUserPercent}
                      onChange={(e) => setBuyUserPercent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage of tokens sent directly to user
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="buyLiquidityPercent">Liquidity Percent</Label>
                    <Input 
                      id="buyLiquidityPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={buyLiquidityPercent}
                      onChange={(e) => setBuyLiquidityPercent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage contributed to liquidity pool
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="buyCashbackPercent">Cashback Percent</Label>
                    <Input 
                      id="buyCashbackPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={buyCashbackPercent}
                      onChange={(e) => setBuyCashbackPercent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage given as YOS token cashback
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2 px-4 bg-muted rounded">
                  <span>Total:</span>
                  <span className={validateBuyPercentages() ? 'text-green-500' : 'text-red-500 font-bold'}>
                    {buyUserPercent + buyLiquidityPercent + buyCashbackPercent}% 
                    {validateBuyPercentages() ? ' ✓' : ' (must be 100%)'}
                  </span>
                </div>
              </TabsContent>
              
              <TabsContent value="sell" className="space-y-4">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="sellUserPercent">User Percent</Label>
                    <Input 
                      id="sellUserPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={sellUserPercent}
                      onChange={(e) => setSellUserPercent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage of tokens sent directly to user
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sellLiquidityPercent">Liquidity Percent</Label>
                    <Input 
                      id="sellLiquidityPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={sellLiquidityPercent}
                      onChange={(e) => setSellLiquidityPercent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage contributed to liquidity pool
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sellCashbackPercent">Cashback Percent</Label>
                    <Input 
                      id="sellCashbackPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={sellCashbackPercent}
                      onChange={(e) => setSellCashbackPercent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage given as YOS token cashback
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2 px-4 bg-muted rounded">
                  <span>Total:</span>
                  <span className={validateSellPercentages() ? 'text-green-500' : 'text-red-500 font-bold'}>
                    {sellUserPercent + sellLiquidityPercent + sellCashbackPercent}% 
                    {validateSellPercentages() ? ' ✓' : ' (must be 100%)'}
                  </span>
                </div>
              </TabsContent>
              
              <TabsContent value="rewards" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="weeklyRewardRate">Weekly Reward Rate (%)</Label>
                  <Input 
                    id="weeklyRewardRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={weeklyRewardRate}
                    onChange={(e) => setWeeklyRewardRate(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of contributed liquidity paid weekly as YOS rewards
                  </p>
                </div>
                
                <div className="py-2 px-4 bg-muted rounded space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Equivalent Annual Rate:</span>
                    <span className="font-semibold">{(weeklyRewardRate * 52).toFixed(2)}% APR</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This is an estimate based on consistent weekly distribution. Default is 1.92% weekly (100% APR).
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-end">
        <Button 
          type="submit" 
          onClick={handleSubmit}
          disabled={updateSettingsMutation.isPending || isLoadingStats}
        >
          {updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}