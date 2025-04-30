import { useState, useEffect, useCallback } from 'react';
import { TokenMetadata } from '@/lib/token-search-api';
import { 
  getMultiHubSwapEstimate, 
  executeMultiHubSwap, 
  SwapEstimate, 
  SwapResult,
  SwapProvider 
} from '@/lib/multi-hub-swap';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';

export function useMultiHubSwap() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { toast } = useToast();
  
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [swapEstimate, setSwapEstimate] = useState<SwapEstimate | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapHistory, setSwapHistory] = useState<SwapResult[]>([]);
  const [slippage, setSlippage] = useState<number>(0.01); // 1% default slippage
  
  // Calculate swap estimate when inputs change
  useEffect(() => {
    async function calculateSwapEstimate() {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        setSwapEstimate(null);
        setToAmount('');
        return;
      }
      
      setIsLoading(true);
      try {
        const estimate = await getMultiHubSwapEstimate(
          fromToken,
          toToken,
          parseFloat(fromAmount)
        );
        
        setSwapEstimate(estimate);
        if (estimate) {
          setToAmount(estimate.outputAmount.toFixed(toToken.decimals));
        } else {
          setToAmount('');
        }
      } catch (error) {
        console.error('Error estimating swap:', error);
        setSwapEstimate(null);
        setToAmount('');
      } finally {
        setIsLoading(false);
      }
    }
    
    // Use debounce to avoid excessive API calls
    const handler = setTimeout(() => {
      calculateSwapEstimate();
    }, 500);
    
    return () => clearTimeout(handler);
  }, [fromToken, toToken, fromAmount]);
  
  // Reset form when wallet disconnects
  useEffect(() => {
    if (!wallet.connected) {
      setSwapHistory([]);
    }
  }, [wallet.connected]);
  
  // Swap tokens
  const executeSwap = useCallback(async () => {
    if (!wallet.publicKey || !fromToken || !toToken || !fromAmount || !swapEstimate) {
      return;
    }
    
    setIsSwapping(true);
    try {
      const result = await executeMultiHubSwap(
        wallet,
        fromToken,
        toToken,
        parseFloat(fromAmount),
        slippage
      );
      
      // Add to swap history
      setSwapHistory(prev => [result, ...prev]);
      
      // Show toast notification
      if (result.success) {
        toast({
          title: 'Swap successful',
          description: `Swapped ${result.fromAmount} ${result.fromToken.symbol} for ${result.toAmount.toFixed(6)} ${result.toToken.symbol}`,
        });
        
        // Reset form
        setFromAmount('');
        setToAmount('');
        setSwapEstimate(null);
      } else {
        toast({
          title: 'Swap failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      toast({
        title: 'Swap failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSwapping(false);
    }
  }, [wallet, fromToken, toToken, fromAmount, swapEstimate, slippage, toast]);
  
  // Swap tokens
  const handleSwapTokens = useCallback(() => {
    if (fromToken && toToken) {
      const temp = fromToken;
      setFromToken(toToken);
      setToToken(temp);
      setFromAmount(toAmount);
      setToAmount(fromAmount);
      setSwapEstimate(null);
    }
  }, [fromToken, toToken, fromAmount, toAmount]);
  
  return {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    swapEstimate,
    isLoading,
    isSwapping,
    swapHistory,
    slippage,
    setFromToken,
    setToToken,
    setFromAmount,
    setToAmount,
    setSlippage,
    executeSwap,
    handleSwapTokens,
    connected: wallet.connected,
    wallet
  };
}