import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowDownIcon, AlertCircle, CheckCircle } from "lucide-react";
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { findSwapRoute } from '@/lib/raydium-pools';
import { SOL_TOKEN_ADDRESS } from '@/lib/constants';

// Test tokens used for swap testing
const TEST_TOKENS = [
  {
    symbol: 'XAR',
    name: 'XAR Test Token',
    mint: '9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa',
    decimals: 9
  },
  {
    symbol: 'XMP',
    name: 'XMP Test Token',
    mint: 'HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs',
    decimals: 9
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: SOL_TOKEN_ADDRESS,
    decimals: 9
  },
  {
    symbol: 'YOT',
    name: 'Yot Token',
    mint: '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF',
    decimals: 9
  },
  {
    symbol: 'YOS',
    name: 'Yos Token',
    mint: 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n',
    decimals: 9
  }
];

/**
 * SwapTestPanel component provides an interface for testing token swaps
 * between XAR, XMP, SOL, YOT, and YOS tokens
 */
export default function SwapTestPanel() {
  const { wallet, connected: walletConnected, connect } = useMultiWallet();
  const { toast } = useToast();

  const [fromToken, setFromToken] = useState(TEST_TOKENS[0]); // XAR
  const [toToken, setToToken] = useState(TEST_TOKENS[2]);     // SOL
  const [amount, setAmount] = useState('10');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [swapRoute, setSwapRoute] = useState<{
    hops: number;
    route: any[];
    path?: string;
  } | null>(null);

  // Function to check available swap routes with priority for XAR → SOL → YOT
  const checkSwapRoute = async () => {
    if (!fromToken || !toToken) {
      toast({
        title: "Select tokens",
        description: "Please select both from and to tokens",
        variant: "destructive"
      });
      return;
    }

    try {
      setSwapResult(null);
      
      // Special handling for XAR → YOT (forcing through SOL)
      if (fromToken.symbol === 'XAR' && toToken.symbol === 'YOT') {
        // Find XAR → SOL route
        const xarToSolRoute = await findSwapRoute(fromToken.mint, SOL_TOKEN_ADDRESS);
        
        // Find SOL → YOT route
        const solToYotRoute = await findSwapRoute(SOL_TOKEN_ADDRESS, toToken.mint);
        
        if (xarToSolRoute.hops > 0 && solToYotRoute.hops > 0) {
          // Create a combined multi-hop route
          setSwapRoute({
            hops: 2,
            route: [...xarToSolRoute.route, ...solToYotRoute.route],
            path: `${fromToken.symbol} → SOL → ${toToken.symbol} (via Raydium AMM)`,
            amm: "Raydium"
          });
          
          toast({
            title: "Optimal route found",
            description: `Using optimal XAR → SOL → YOT route via Raydium AMM`
          });
          return;
        }
      }
      
      // For other token pairs, use the standard route finding logic
      const route = await findSwapRoute(fromToken.mint, toToken.mint);
      
      // Create a human-readable path
      let path = "";
      let amm = "Raydium";
      
      if (route.hops === 0) {
        path = "Direct swap not available";
        amm = "None";
      } else if (route.hops === 1) {
        path = `${fromToken.symbol} → ${toToken.symbol}`;
      } else if (route.hops === 2 && route.intermediateTokens?.includes(SOL_TOKEN_ADDRESS)) {
        path = `${fromToken.symbol} → SOL → ${toToken.symbol}`;
      } else {
        path = `${fromToken.symbol} → [${route.hops} hops] → ${toToken.symbol}`;
      }
      
      setSwapRoute({
        hops: route.hops,
        route: route.route,
        path,
        amm
      });
      
      if (route.hops === 0) {
        toast({
          title: "No route found",
          description: `No swap route found between ${fromToken.symbol} and ${toToken.symbol}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Route found",
          description: `Found ${route.hops}-hop route for ${fromToken.symbol} to ${toToken.symbol}`,
        });
      }
    } catch (error) {
      console.error("Error checking swap route:", error);
      toast({
        title: "Error checking route",
        description: error instanceof Error ? error.message : "Failed to check swap route",
        variant: "destructive"
      });
    }
  };

  // Function to simulate a token swap
  const simulateSwap = async () => {
    if (!walletConnected) {
      toast({
        title: "Connect wallet",
        description: "Please connect your wallet to swap tokens",
        variant: "destructive"
      });
      return;
    }
    
    if (!fromToken || !toToken) {
      toast({
        title: "Select tokens",
        description: "Please select both from and to tokens",
        variant: "destructive"
      });
      return;
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to swap",
        variant: "destructive"
      });
      return;
    }

    setIsSwapping(true);
    setSwapResult(null);
    
    try {
      // First check if a route exists
      if (!swapRoute) {
        await checkSwapRoute();
      }
      
      // Simulate the swap with a delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Special handling for XAR → SOL → YOT (prioritized route)
      if (fromToken.symbol === 'XAR' && toToken.symbol === 'YOT') {
        // Calculate transaction details with 20% contribution to SOL-YOT liquidity pool
        const inputAmount = parseFloat(amount);
        const contributionAmount = inputAmount * 0.20; // 20% goes to liquidity pool
        const swappedAmount = inputAmount * 0.80; // 80% used for actual swap
        
        // Calculate approximate SOL amount received in first hop
        const xarToSolRate = 0.00015; // Approximate exchange rate
        const solAmount = swappedAmount * xarToSolRate;
        
        // Calculate YOT amount from SOL in second hop
        const solToYotRate = 24480; // Approximate exchange rate
        const yotAmount = solAmount * solToYotRate;
        
        // 3% cashback in YOS tokens based on initial amount
        const cashbackAmount = inputAmount * 0.03;
        
        setSwapResult({
          success: true,
          message: `Successfully performed multi-hop swap via Raydium AMM:
          • ${inputAmount.toFixed(4)} ${fromToken.symbol} → ${solAmount.toFixed(6)} SOL → ${yotAmount.toFixed(4)} ${toToken.symbol}
          
          Transaction breakdown:
          • ${contributionAmount.toFixed(4)} ${fromToken.symbol} (20%) contributed to SOL-YOT liquidity pool
          • ${swappedAmount.toFixed(4)} ${fromToken.symbol} (80%) used for swap path
          • Received ${cashbackAmount.toFixed(4)} YOS as cashback reward (3%)
          
          Liquidity contribution:
          • ${(contributionAmount * xarToSolRate * solToYotRate).toFixed(4)} YOT value added to YOT-SOL liquidity pool
          
          Yield farming rewards:
          • 100% APR paid weekly in YOS tokens (${(contributionAmount * xarToSolRate * solToYotRate * 0.02).toFixed(4)} YOS estimated weekly reward on YOT contribution)`
        });
      } else {
        // For other token pairs, use simplified simulation
        const contributionAmount = parseFloat(amount) * 0.20; // 20% contribution
        const swapAmount = parseFloat(amount) * 0.80; // 80% for swap
        const cashbackAmount = parseFloat(amount) * 0.03; // 3% cashback
        
        setSwapResult({
          success: true,
          message: `Successfully swapped ${amount} ${fromToken.symbol} to ${toToken.symbol}
          
          Transaction breakdown:
          • ${contributionAmount.toFixed(4)} ${fromToken.symbol} (20%) contributed to liquidity pool
          • ${swapAmount.toFixed(4)} ${fromToken.symbol} (80%) used for token swap
          • Received ${cashbackAmount.toFixed(4)} YOS as cashback reward (3%)`
        });
      }
    } catch (error) {
      console.error("Error simulating swap:", error);
      
      setSwapResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to simulate swap"
      });
    } finally {
      setIsSwapping(false);
    }
  };

  // Function to swap input and output tokens
  const switchTokens = () => {
    setSwapResult(null);
    setSwapRoute(null);
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Test Token Swap</CardTitle>
        <CardDescription>
          Swap between test tokens to verify liquidity pool functionality
          <div className="mt-2 p-2 bg-blue-950 rounded-md text-xs border border-blue-900">
            <p>Note: This simulates the complete swap process but does not perform actual on-chain transactions.
            In production, this would connect to the Solana blockchain using the Raydium SDK.</p>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* From Token */}
          <div className="space-y-2">
            <Label htmlFor="from-token">From</Label>
            <div className="flex space-x-2">
              <Select
                value={fromToken.symbol}
                onValueChange={(value) => {
                  setSwapResult(null);
                  setSwapRoute(null);
                  setFromToken(TEST_TOKENS.find(t => t.symbol === value) || TEST_TOKENS[0]);
                }}
              >
                <SelectTrigger className="w-1/3">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {TEST_TOKENS.filter(t => t.symbol !== toToken.symbol).map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => {
                  setSwapResult(null);
                  setAmount(e.target.value);
                }}
                placeholder="Amount"
                className="flex-1"
              />
            </div>
          </div>
          
          {/* Swap Direction Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={switchTokens}
            >
              <ArrowDownIcon className="h-4 w-4" />
            </Button>
          </div>
          
          {/* To Token */}
          <div className="space-y-2">
            <Label htmlFor="to-token">To</Label>
            <div className="flex space-x-2">
              <Select
                value={toToken.symbol}
                onValueChange={(value) => {
                  setSwapResult(null);
                  setSwapRoute(null);
                  setToToken(TEST_TOKENS.find(t => t.symbol === value) || TEST_TOKENS[0]);
                }}
              >
                <SelectTrigger className="w-1/3">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {TEST_TOKENS.filter(t => t.symbol !== fromToken.symbol).map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 flex items-center justify-end px-3 border rounded-md bg-secondary/50">
                <span className="text-muted-foreground">
                  ≈ {(parseFloat(amount || '0') * 0.95).toFixed(4)} {toToken.symbol}
                </span>
              </div>
            </div>
          </div>
          
          {/* Swap Route Information */}
          {swapRoute && (
            <div className="p-3 border rounded-md bg-secondary/30">
              <p className="text-sm font-medium">Swap Route:</p>
              <p className="text-sm text-muted-foreground">{swapRoute.path}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Hops: {swapRoute.hops} | 
                Pools: {swapRoute.route.length} | 
                Fee: {swapRoute.hops * 0.25}%
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            {!walletConnected && (
              <Button
                className="flex-1"
                onClick={() => connect()}
              >
                Connect Wallet
              </Button>
            )}
            
            <Button
              variant="outline"
              className="flex-1"
              onClick={checkSwapRoute}
              disabled={isSwapping || !fromToken || !toToken}
            >
              Check Route
            </Button>
            
            <Button
              className="flex-1"
              onClick={simulateSwap}
              disabled={isSwapping || !walletConnected}
            >
              {isSwapping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Swapping...
                </>
              ) : 'Swap'}
            </Button>
          </div>
          
          {/* Swap Result */}
          {swapResult && (
            <Alert variant={swapResult.success ? "default" : "destructive"}>
              {swapResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription className="whitespace-pre-line">
                {swapResult.message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}