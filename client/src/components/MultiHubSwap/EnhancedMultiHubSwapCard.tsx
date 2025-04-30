import { useState, useEffect } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { 
  ArrowDownUp, 
  ArrowRight, 
  Loader2, 
  Info, 
  RefreshCw, 
  Settings, 
  Percent,
  ArrowLeftRight
} from 'lucide-react';
import { useMultiHubSwap } from '@/hooks/useMultiHubSwap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import TokenSearchInput from './TokenSearchInput';
import PriceChart from './PriceChart';
import { YOT_TOKEN_ADDRESS } from '@/lib/constants';
import { TokenMetadata, getSwapEstimate, getTokenByAddress } from '@/lib/token-search-api';
import { getSwapRoute, swapToBuyYOT, swapToSellYOT } from '@/lib/swap-router';

export default function EnhancedMultiHubSwapCard() {
  const [swapMode, setSwapMode] = useState<'buy' | 'sell'>('buy'); // 'buy' for TokenX→YOT, 'sell' for YOT→TokenX
  const [amountIn, setAmountIn] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5% default slippage
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  const [estimatedOutput, setEstimatedOutput] = useState<number>(0);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // Distribution estimates
  const [estimatedUser, setEstimatedUser] = useState<number>(0);
  const [estimatedLiquidity, setEstimatedLiquidity] = useState<number>(0);
  const [estimatedCashback, setEstimatedCashback] = useState<number>(0);
  const [estimatedCommission, setEstimatedCommission] = useState<number>(0);
  
  const { wallet, connected } = useMultiWallet();
  const { 
    swapStats, 
    isLoadingSwapStats,
    isSwapping
  } = useMultiHubSwap();

  // Initialize tokens on load
  useEffect(() => {
    const initTokens = async () => {
      try {
        const yotToken = await getTokenByAddress(YOT_TOKEN_ADDRESS);
        const solToken = await getTokenByAddress('So11111111111111111111111111111111111111112');
        
        if (swapMode === 'buy') {
          setFromToken(solToken);
          setToToken(yotToken);
        } else {
          setFromToken(yotToken);
          setToToken(solToken);
        }
      } catch (error) {
        console.error("Error initializing tokens:", error);
      }
    };
    
    initTokens();
  }, [swapMode]);

  // Flip tokens
  const flipTokens = () => {
    const newMode = swapMode === 'buy' ? 'sell' : 'buy';
    setSwapMode(newMode);
    setAmountIn('');
    setEstimatedOutput(0);
    setPriceImpact(0);
    setEstimatedUser(0);
    setEstimatedLiquidity(0);
    setEstimatedCashback(0);
    setEstimatedCommission(0);
  };

  // Update estimate when input changes
  useEffect(() => {
    const updateSwapEstimate = async () => {
      if (!fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0) {
        setEstimatedOutput(0);
        setPriceImpact(0);
        setEstimatedUser(0);
        setEstimatedLiquidity(0);
        setEstimatedCashback(0);
        setEstimatedCommission(0);
        return;
      }
      
      setIsQuoting(true);
      try {
        // Get swap route
        const route = await getSwapRoute(
          fromToken.address,
          toToken.address,
          parseFloat(amountIn)
        );
        
        setEstimatedOutput(route.estimatedAmount);
        setPriceImpact(route.priceImpact);
        
        // Calculate distribution based on mode
        if (swapMode === 'buy') {
          // For buy flow: Any token → YOT
          const userPercent = swapStats?.buyDistribution?.userPercent || 75;
          const liquidityPercent = swapStats?.buyDistribution?.liquidityPercent || 20;
          const cashbackPercent = swapStats?.buyDistribution?.cashbackPercent || 5;
          const commissionPercent = swapStats?.commissionPercent || 0.1;
          
          setEstimatedUser(route.estimatedAmount * (userPercent / 100));
          setEstimatedLiquidity(route.estimatedAmount * (liquidityPercent / 100));
          setEstimatedCashback(route.estimatedAmount * (cashbackPercent / 100));
          setEstimatedCommission(parseFloat(amountIn) * (commissionPercent / 100));
        } else {
          // For sell flow: YOT → Any token
          const userPercent = swapStats?.sellDistribution?.userPercent || 75;
          const liquidityPercent = swapStats?.sellDistribution?.liquidityPercent || 20;
          const cashbackPercent = swapStats?.sellDistribution?.cashbackPercent || 5;
          const commissionPercent = swapStats?.commissionPercent || 0.1;
          
          // For sell flow, the distribution applies to input amount (YOT)
          const inputAmount = parseFloat(amountIn);
          setEstimatedUser(route.estimatedAmount);
          setEstimatedLiquidity(inputAmount * (liquidityPercent / 100));
          setEstimatedCashback(inputAmount * (cashbackPercent / 100));
          setEstimatedCommission(route.estimatedAmount * (commissionPercent / 100));
        }
      } catch (error) {
        console.error("Error updating estimate:", error);
        setEstimatedOutput(0);
        setPriceImpact(0);
        setEstimatedUser(0);
        setEstimatedLiquidity(0);
        setEstimatedCashback(0);
        setEstimatedCommission(0);
      } finally {
        setIsQuoting(false);
      }
    };
    
    if (fromToken && toToken) {
      updateSwapEstimate();
    }
  }, [amountIn, fromToken, toToken, swapMode, swapStats]);

  // Function to handle swap
  const handleSwap = async () => {
    if (!fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0) return;
    
    const amount = parseFloat(amountIn);
    
    try {
      let txSignature: string;
      
      if (swapMode === 'buy') {
        // Any token → YOT (Buy flow)
        txSignature = await swapToBuyYOT(
          wallet,
          fromToken.address,
          amount,
          slippage,
          swapStats?.buyDistribution?.userPercent || 75,
          swapStats?.buyDistribution?.liquidityPercent || 20,
          swapStats?.buyDistribution?.cashbackPercent || 5
        );
      } else {
        // YOT → Any token (Sell flow)
        txSignature = await swapToSellYOT(
          wallet,
          toToken.address,
          amount,
          slippage,
          swapStats?.sellDistribution?.userPercent || 75,
          swapStats?.sellDistribution?.liquidityPercent || 20,
          swapStats?.sellDistribution?.cashbackPercent || 5
        );
      }
      
      console.log("Swap transaction successful:", txSignature);
      
      // Reset form
      setAmountIn('');
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Price Chart - 3/5 width on large screens */}
      <div className="lg:col-span-3 order-2 lg:order-1">
        <PriceChart 
          fromSymbol={fromToken?.symbol || 'TOKEN'} 
          toSymbol={toToken?.symbol || 'YOT'} 
        />
      </div>
      
      {/* Swap Interface - 2/5 width on large screens */}
      <div className="lg:col-span-2 order-1 lg:order-2">
        <div className="bg-muted/30 rounded-lg p-4 shadow-sm border border-border/30">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Swap</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Percent className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="slippage">Slippage Tolerance</Label>
                        <span className="text-sm">{slippage}%</span>
                      </div>
                      <Slider 
                        id="slippage"
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={[slippage]}
                        onValueChange={(values) => setSlippage(values[0])}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.1%</span>
                        <span>5%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="advanced-mode">Auto Router</Label>
                        <Switch 
                          id="advanced-mode" 
                          checked={showAdvanced}
                          onCheckedChange={setShowAdvanced}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically route through Jupiter or Raydium for best execution
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* From */}
          <div className="bg-background rounded-lg p-4 mb-2">
            <div className="flex justify-between mb-2">
              <Label htmlFor="from-amount" className="text-muted-foreground text-xs">From</Label>
              <span className="text-xs text-muted-foreground">
                Balance: 0.00
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <Input
                id="from-amount"
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className="border-0 text-xl p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="flex-shrink-0">
                <TokenSearchInput 
                  onSelect={setFromToken}
                  selectedToken={fromToken || undefined}
                  placeholder="Select"
                  excludeTokens={toToken ? [toToken.address] : []}
                />
              </div>
            </div>
          </div>
          
          {/* Swap Direction */}
          <div className="flex justify-center -my-2 relative z-10">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10 rounded-full bg-background shadow-md border-border"
              onClick={flipTokens}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>
          
          {/* To */}
          <div className="bg-background rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2">
              <Label htmlFor="to-amount" className="text-muted-foreground text-xs">To</Label>
              <span className="text-xs text-muted-foreground">
                Balance: 0.00
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Input
                  id="to-amount"
                  type="number"
                  placeholder="0.0"
                  value={isQuoting ? '...' : estimatedOutput.toFixed(6)}
                  readOnly
                  className="border-0 text-xl p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {isQuoting && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <TokenSearchInput 
                  onSelect={setToToken}
                  selectedToken={toToken || undefined}
                  placeholder="Select"
                  excludeTokens={fromToken ? [fromToken.address] : []}
                />
              </div>
            </div>
          </div>
          
          {/* Distribution Info Accordion */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between mb-4"
                size="sm"
              >
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>Distribution Info</span>
                </span>
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full">
              <div className="space-y-3 py-1">
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">User Receives:</span>
                  <span className="text-right font-medium">
                    {swapMode === 'buy'
                      ? `${estimatedUser.toFixed(6)} YOT`
                      : `${estimatedUser.toFixed(6)} ${toToken?.symbol || 'TOKEN'}`}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">Liquidity Contribution:</span>
                  <span className="text-right font-medium">
                    {estimatedLiquidity.toFixed(6)} YOT
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">YOS Cashback:</span>
                  <span className="text-right font-medium">
                    {estimatedCashback.toFixed(6)} YOS
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">Owner Commission:</span>
                  <span className="text-right font-medium">
                    {estimatedCommission.toFixed(6)} SOL
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">Price Impact:</span>
                  <span className="text-right font-medium">
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">Slippage Tolerance:</span>
                  <span className="text-right font-medium">
                    {slippage}%
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Swap Button */}
          <Button 
            className="w-full" 
            size="lg"
            disabled={!connected || isSwapping || !amountIn || parseFloat(amountIn) <= 0 || !fromToken || !toToken}
            onClick={handleSwap}
          >
            {!connected ? (
              "Connect Wallet"
            ) : isSwapping ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Swapping...
              </>
            ) : (
              "Swap"
            )}
          </Button>
          
          {/* Swap Stats Footer */}
          <div className="mt-4 flex justify-between text-xs text-muted-foreground">
            <div>YOT Price: ${swapStats?.yotPriceUsd?.toFixed(3) || "0.000"}</div>
            <div>Weekly APR: {swapStats?.weeklyRewardRate || 1.92}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}