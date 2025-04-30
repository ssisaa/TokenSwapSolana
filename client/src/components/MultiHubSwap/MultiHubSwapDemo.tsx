import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TokenSearchInput from './TokenSearchInput';
import { TokenMetadata, getTokenByAddress } from '@/lib/token-search-api';
import { getMultiHubSwapEstimate, executeMultiHubSwap, SwapProvider, SwapEstimate } from '@/lib/multi-hub-swap';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, SOL_TOKEN_ADDRESS, RAYDIUM } from '@/lib/constants';

/**
 * A simplified component to demonstrate the multi-hub swap functionality
 */
export default function MultiHubSwapDemo() {
  const wallet = useWallet();
  
  // Token selection state
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  
  // Amount and estimate state
  const [amount, setAmount] = useState('');
  const [swapEstimate, setSwapEstimate] = useState<SwapEstimate | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  // Result states
  const [swapResult, setSwapResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<SwapProvider>(SwapProvider.Raydium);
  
  // Load default tokens
  useEffect(() => {
    async function loadDefaultTokens() {
      const solToken = await getTokenByAddress(SOL_TOKEN_ADDRESS);
      const yotToken = await getTokenByAddress(YOT_TOKEN_ADDRESS);
      
      if (solToken) setFromToken(solToken);
      if (yotToken) setToToken(yotToken);
    }
    
    loadDefaultTokens();
  }, []);
  
  // Calculate swap estimate when inputs change
  useEffect(() => {
    async function calculateEstimate() {
      if (!fromToken || !toToken || !amount || Number(amount) <= 0) {
        setSwapEstimate(null);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const estimate = await getMultiHubSwapEstimate(fromToken, toToken, Number(amount));
        setSwapEstimate(estimate);
      } catch (err) {
        console.error('Error calculating swap estimate:', err);
        setError('Failed to calculate swap estimate');
        setSwapEstimate(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    calculateEstimate();
  }, [fromToken, toToken, amount]);
  
  // Handle swap action
  const handleSwap = async () => {
    if (!wallet.connected) {
      setError('Please connect your wallet');
      return;
    }
    
    if (!fromToken || !toToken || !amount || !swapEstimate) {
      setError('Please fill in all fields');
      return;
    }
    
    setIsSwapping(true);
    setError(null);
    setSwapResult(null);
    
    try {
      const result = await executeMultiHubSwap(
        wallet,
        fromToken,
        toToken,
        Number(amount),
        0.01 // 1% slippage
      );
      
      if (result.success) {
        setSwapResult(`Swap successful! Tx: ${result.signature.slice(0, 8)}...${result.signature.slice(-8)}`);
      } else {
        setError(`Swap failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Swap error:', err);
      setError(`Swap error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSwapping(false);
    }
  };
  
  // Swap tokens
  const handleSwapTokens = () => {
    if (fromToken && toToken) {
      const temp = fromToken;
      setFromToken(toToken);
      setToToken(temp);
      setSwapEstimate(null);
    }
  };
  
  return (
    <Card className="max-w-md mx-auto my-8">
      <CardHeader>
        <CardTitle>Multi-Hub Swap Demo</CardTitle>
        <CardDescription>Swap tokens using Raydium on Devnet</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">From</label>
          <div className="flex space-x-2">
            <div className="w-2/3">
              <TokenSearchInput
                onTokenSelect={setFromToken}
                selectedToken={fromToken || undefined}
                placeholder="From token"
              />
            </div>
            <div className="w-1/3">
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {/* Swap button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwapTokens}
            className="rounded-full"
          >
            ↑↓
          </Button>
        </div>
        
        {/* To token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">To</label>
          <div className="flex space-x-2">
            <div className="w-2/3">
              <TokenSearchInput
                onTokenSelect={setToToken}
                selectedToken={toToken || undefined}
                placeholder="To token"
              />
            </div>
            <div className="w-1/3">
              <Input
                type="text"
                placeholder="0.0"
                value={swapEstimate ? swapEstimate.outputAmount.toFixed(6) : ''}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
        </div>
        
        {/* Provider selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Provider</label>
          <Select
            value={selectedProvider}
            onValueChange={(value) => setSelectedProvider(value as SwapProvider)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SwapProvider.Raydium}>Raydium DEX</SelectItem>
              <SelectItem value={SwapProvider.Jupiter}>Jupiter Aggregator</SelectItem>
              <SelectItem value={SwapProvider.Contract}>YOT Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Swap details */}
        {swapEstimate && (
          <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span>
                1 {fromToken?.symbol} = {swapEstimate.price.toFixed(6)} {toToken?.symbol}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum received</span>
              <span>{swapEstimate.minimumReceived.toFixed(6)} {toToken?.symbol}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price impact</span>
              <span className={swapEstimate.priceImpact > 5 ? 'text-destructive' : 'text-primary'}>
                {swapEstimate.priceImpact.toFixed(2)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Route</span>
              <span>{swapEstimate.route.join(' → ')}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span>{swapEstimate.provider}</span>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
            {error}
          </div>
        )}
        
        {/* Success message */}
        {swapResult && (
          <div className="text-sm text-primary p-2 bg-primary/10 rounded-md">
            {swapResult}
          </div>
        )}
        
        {/* Swap button */}
        <Button
          className="w-full"
          disabled={!wallet.connected || !fromToken || !toToken || !amount || !swapEstimate || isSwapping}
          onClick={handleSwap}
        >
          {isSwapping ? 'Swapping...' : 'Swap'}
        </Button>
      </CardContent>
    </Card>
  );
}