import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowDownUp,
  ArrowRightLeft,
  ChevronDown,
  RefreshCw,
  Info,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TokenListDialog } from './TokenListDialog';
import useMultiHubSwap from '@/hooks/useMultiHubSwap';
import { formatNumber } from '@/lib/utils';
import { SwapProvider } from '@/lib/multi-hub-swap';

export default function MultiHubSwapCard() {
  const wallet = useWallet();
  const {
    fromToken,
    toToken,
    amount,
    slippage,
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    switchTokens,
    swapEstimate,
    estimateLoading,
    swap,
    isSwapping,
    swapSummary,
    isValid
  } = useMultiHubSwap();

  const [slippageInput, setSlippageInput] = useState(slippage * 100 + '');
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  // Conditionally render swap summary data
  const renderSwapSummary = useMemo(() => {
    if (!swapSummary) return null;

    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Rate</span>
          <span>
            1 {fromToken?.symbol} ≈ {formatNumber(swapSummary.estimatedOutputAmount / parseFloat(amount || '1'))} {toToken?.symbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Minimum received</span>
          <span>{formatNumber(swapSummary.minReceived)} {toToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span>Liquidity contribution</span>
          <span>{formatNumber(swapSummary.liquidityContribution)} {fromToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span>YOS cashback</span>
          <span>{formatNumber(swapSummary.yosCashback)} YOS</span>
        </div>
        <div className="flex justify-between">
          <span>Provider</span>
          <span>{swapSummary.provider}</span>
        </div>
      </div>
    );
  }, [fromToken, toToken, amount, swapSummary]);

  // Update slippage tolerance
  const updateSlippage = () => {
    const newSlippage = parseFloat(slippageInput) / 100;
    if (!isNaN(newSlippage) && newSlippage > 0 && newSlippage <= 5) {
      setSlippage(newSlippage);
      setShowSlippageSettings(false);
    }
  };

  // Set quick slippage values
  const setQuickSlippage = (value: number) => {
    setSlippageInput(value.toString());
    setSlippage(value / 100);
    setShowSlippageSettings(false);
  };

  // Conditional warning based on swap estimate
  const swapWarning = useMemo(() => {
    if (!swapEstimate) return null;
    
    if (swapEstimate.provider === SwapProvider.Contract) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-500 mt-1">
          <AlertCircle className="h-3 w-3" />
          <span>Using smart contract for best efficiency</span>
        </div>
      );
    }
    
    if (swapEstimate.provider && swapEstimate.provider !== SwapProvider.Direct) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-500 mt-1">
          <AlertCircle className="h-3 w-3" />
          <span>Routing via {swapEstimate.provider} for best price</span>
        </div>
      );
    }
    
    return null;
  }, [swapEstimate]);

  return (
    <Card className="w-full max-w-md mx-auto bg-dark-200 border-dark-300">
      <CardHeader className="space-y-1">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">Swap Tokens</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh prices</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Trade tokens with multi-hub routing for the best price
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor="from-amount">From</label>
            {wallet.publicKey && fromToken && (
              <span className="text-muted-foreground">
                Balance: {/* Add wallet balance here */}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                id="from-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-dark-300 border-dark-400"
              />
            </div>
            
            <TokenListDialog
              selectedToken={fromToken}
              onSelect={setFromToken}
              exclude={toToken ? [toToken.address] : []}
            />
          </div>
        </div>
        
        {/* Switch Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={switchTokens}
            className="h-8 w-8 rounded-full bg-dark-300"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>
        
        {/* To Token Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor="to-amount">To (Estimated)</label>
            {wallet.publicKey && toToken && (
              <span className="text-muted-foreground">
                Balance: {/* Add wallet balance here */}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              {estimateLoading ? (
                <Skeleton className="h-10 w-full bg-dark-300" />
              ) : (
                <Input
                  id="to-amount"
                  readOnly
                  value={swapEstimate?.estimatedAmount 
                    ? formatNumber(swapEstimate.estimatedAmount) 
                    : '0.00'
                  }
                  placeholder="0.00"
                  className="bg-dark-300 border-dark-400"
                />
              )}
            </div>
            
            <TokenListDialog
              selectedToken={toToken}
              onSelect={setToToken}
              exclude={fromToken ? [fromToken.address] : []}
            />
          </div>
          
          {swapWarning}
        </div>
        
        {/* Slippage Settings */}
        <div className="flex justify-between items-center">
          <Popover open={showSlippageSettings} onOpenChange={setShowSlippageSettings}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-dark-400 bg-dark-300"
              >
                Slippage: {(slippage * 100).toFixed(1)}%
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-dark-200 border-dark-300">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Slippage Tolerance</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickSlippage(0.5)}
                    className="flex-1 h-7 text-xs"
                  >
                    0.5%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickSlippage(1.0)}
                    className="flex-1 h-7 text-xs"
                  >
                    1.0%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickSlippage(2.0)}
                    className="flex-1 h-7 text-xs"
                  >
                    2.0%
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={slippageInput}
                    onChange={(e) => setSlippageInput(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Custom"
                  />
                  <span className="text-xs">%</span>
                  <Button
                    size="sm"
                    onClick={updateSlippage}
                    className="h-7 text-xs"
                  >
                    Set
                  </Button>
                </div>
                <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                  <Info className="h-3 w-3 mt-0.5" />
                  <span>
                    Your transaction will revert if the price changes unfavorably by more than this percentage.
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center text-xs text-muted-foreground">
            <ArrowRightLeft className="mr-1 h-3 w-3" />
            <span>Multi-Hub Swap</span>
          </div>
        </div>
        
        {amount && parseFloat(amount) > 0 && (
          <>
            <Separator />
            {renderSwapSummary}
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        {wallet.connected ? (
          <Button
            onClick={() => swap()}
            disabled={!isValid || isSwapping}
            className="w-full"
          >
            {isSwapping && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {isSwapping ? 'Swapping...' : 'Swap'}
          </Button>
        ) : (
          <Button
            onClick={() => wallet.connect()}
            className="w-full"
          >
            Connect Wallet
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}