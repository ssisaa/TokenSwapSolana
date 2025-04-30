import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowRightLeft, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { TokenSearchInput } from './TokenSearchInput';
import { formatNumber } from '@/lib/utils';
import useMultiHubSwap from '@/hooks/useMultiHubSwap';
import { SwapProvider } from '@/lib/multi-hub-swap';
import { SOL_SYMBOL, YOT_SYMBOL } from '@/lib/constants';

export function MultiHubSwapCard() {
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
    swapEstimate,
    estimateLoading,
    swap,
    isSwapping,
    isValid,
    swapSummary
  } = useMultiHubSwap();
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers and one decimal point
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };
  
  const handleSwapClick = () => {
    if (!wallet.connected) {
      return;
    }
    
    swap();
  };
  
  return (
    <Card className="w-full max-w-md bg-background shadow-lg border-border">
      <CardHeader>
        <CardTitle className="text-2xl">Multi-Hub Swap</CardTitle>
        <CardDescription>Swap tokens with auto-liquidity contribution and YOS rewards</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">From</label>
            <label className="text-sm text-muted-foreground">
              Balance: {wallet.connected ? '0.00' : 'Connect wallet'}
            </label>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.0"
                className="w-full"
              />
            </div>
            
            <div className="w-32">
              <TokenSearchInput
                selectedToken={fromToken}
                onSelect={setFromToken}
                excludeTokens={toToken ? [toToken.address] : []}
              />
            </div>
          </div>
        </div>
        
        {/* Swap Icon */}
        <div className="flex justify-center py-2">
          <div 
            className="bg-muted/50 p-2 rounded-full cursor-pointer hover:bg-muted"
            onClick={() => {
              if (fromToken && toToken) {
                const temp = fromToken;
                setFromToken(toToken);
                setToToken(temp);
              }
            }}
          >
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">To (estimated)</label>
            <label className="text-sm text-muted-foreground">
              Balance: {wallet.connected ? '0.00' : 'Connect wallet'}
            </label>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 px-3 py-2 bg-muted border border-border rounded-md">
              {estimateLoading ? (
                <div className="flex items-center justify-center h-5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <span>
                  {swapEstimate?.success && swapEstimate.estimatedAmount !== undefined 
                    ? formatNumber(swapEstimate.estimatedAmount, 4) 
                    : '0.0'
                  }
                </span>
              )}
            </div>
            
            <div className="w-32">
              <TokenSearchInput
                selectedToken={toToken}
                onSelect={setToToken}
                excludeTokens={fromToken ? [fromToken.address] : []}
              />
            </div>
          </div>
        </div>
        
        {/* Swap Details */}
        <div className="bg-muted/30 rounded-md p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Route Provider</span>
            <span className="font-medium">
              {swapEstimate?.provider || SwapProvider.Contract}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage Tolerance</span>
            <div className="flex space-x-1">
              {[0.5, 1, 2].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value / 100)}
                  className={`px-2 py-0.5 text-xs rounded-md ${
                    slippage === value / 100
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-primary/20'
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center">
              Liquidity Contribution
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      20% of your swap amount goes to the SOL-YOT liquidity pool,
                      improving liquidity for all users.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-medium">20%</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center">
              YOS Cashback
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      5% of your swap amount is converted to YOS tokens as cashback rewards.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-medium">5%</span>
          </div>
          
          {swapSummary && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimum received</span>
                <span className="font-medium">
                  {formatNumber(swapSummary.minReceived, 4)} {toToken?.symbol}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Warning about slippage and price impact - only when needed */}
        {swapEstimate?.success && swapEstimate.estimatedAmount && swapEstimate.estimatedAmount > 0 && slippage < 0.01 && (
          <Alert variant="warning" className="bg-yellow-500/10 border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription>
              Your slippage tolerance is set to {slippage * 100}%. For larger swaps, consider increasing
              your slippage tolerance to ensure the transaction succeeds.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter>
        {!wallet.connected ? (
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => wallet.connect()}
          >
            Connect Wallet
          </Button>
        ) : (
          <Button
            className="w-full"
            size="lg"
            onClick={handleSwapClick}
            disabled={isSwapping || !isValid}
          >
            {isSwapping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </>
            ) : !fromToken || !toToken ? (
              'Select Tokens'
            ) : !amount || parseFloat(amount) <= 0 ? (
              'Enter Amount'
            ) : (
              `Swap ${fromToken.symbol} to ${toToken.symbol}`
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}