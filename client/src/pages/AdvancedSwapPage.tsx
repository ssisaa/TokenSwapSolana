import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowDownIcon, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import TokenSearchInput from '@/components/MultiHubSwap/TokenSearchInput';
import RouteDisplay from '@/components/MultiHubSwap/RouteDisplay';
import { TOKEN_ADDRESSES } from '@/lib/jupiter-swap';
import { getJupiterQuote, executeJupiterSwap } from '@/lib/jupiter-swap';
import { formatNumber } from '@/lib/utils';

// Define common tokens
const COMMON_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: TOKEN_ADDRESSES.SOL,
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  {
    symbol: 'YOT',
    name: 'YOT Token',
    address: TOKEN_ADDRESSES.YOT,
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Placeholder logo
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: TOKEN_ADDRESSES.USDC,
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  {
    symbol: 'YOS',
    name: 'YOS Token',
    address: TOKEN_ADDRESSES.YOS,
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Placeholder logo
  }
];

export default function AdvancedSwapPage() {
  const { toast } = useToast();
  const wallet = useWallet();
  const [fromToken, setFromToken] = useState(COMMON_TOKENS[0]); // SOL
  const [toToken, setToToken] = useState(COMMON_TOKENS[1]);     // YOT
  const [amount, setAmount] = useState<string>('0.1');
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5%
  const [route, setRoute] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

  // Reset state when tokens change
  useEffect(() => {
    setRoute(null);
    setExpectedOutput(null);
    setError(null);
    setIsSuccess(false);
    setLastTxSignature(null);
  }, [fromToken, toToken]);

  // Handle token swap
  const handleTokenSwap = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  // Calculate route when amount changes
  useEffect(() => {
    if (Number(amount) > 0) {
      calculateRoute();
    } else {
      setRoute(null);
      setExpectedOutput(null);
    }
  }, [amount, fromToken, toToken, slippage]);

  // Calculate the route
  const calculateRoute = async () => {
    if (!fromToken || !toToken || Number(amount) <= 0) return;

    setIsLoadingRoute(true);
    setError(null);
    
    try {
      // Convert amount to raw (lamports)
      const amountRaw = Math.floor(Number(amount) * Math.pow(10, fromToken.decimals)).toString();
      
      // Get route from Jupiter
      const quote = await getJupiterQuote(
        fromToken.address, 
        toToken.address, 
        amountRaw,
        slippage * 100 // Convert slippage to basis points
      );
      
      if (quote) {
        setRoute(quote);
        setExpectedOutput(parseFloat(quote.outAmount) / Math.pow(10, toToken.decimals));
      } else {
        setError("No route found between these tokens. Try a different pair.");
      }
    } catch (err) {
      console.error("Error calculating route:", err);
      setError("Failed to calculate route. Please try again.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Execute the swap
  const executeSwap = async () => {
    if (!wallet.connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to proceed with the swap",
        variant: "destructive"
      });
      return;
    }

    if (!fromToken || !toToken || Number(amount) <= 0 || !route) {
      toast({
        title: "Invalid swap parameters",
        description: "Please ensure all swap parameters are valid",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSuccess(false);
    
    try {
      const result = await executeJupiterSwap(
        wallet,
        fromToken,
        toToken,
        Number(amount),
        slippage / 100 // Convert to decimal
      );
      
      if (result.success) {
        setIsSuccess(true);
        setLastTxSignature(result.signature);
        toast({
          title: "Swap successful",
          description: `Swapped ${amount} ${fromToken.symbol} to ${formatNumber(result.toAmount)} ${toToken.symbol}`,
          variant: "default"
        });
      } else {
        throw new Error("Swap failed");
      }
    } catch (err: any) {
      console.error("Swap execution error:", err);
      setError(err.message || "Failed to execute swap");
      toast({
        title: "Swap failed",
        description: err.message || "Failed to execute swap",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate minimum amount out
  const minAmountOut = expectedOutput ? expectedOutput * (1 - slippage / 100) : null;

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold">Advanced Multi-Hop Swap</CardTitle>
        <CardDescription>
          Swap any token to any token with automatic routing through Jupiter
        </CardDescription>
      </CardHeader>
      
      <Card>
        <CardContent className="pt-6">
          {/* From Token Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="fromAmount">From</Label>
              {wallet.connected && (
                <span className="text-sm text-muted-foreground">
                  Balance: {/* TODO: Show actual balance */}
                </span>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Input
                id="fromAmount"
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
              />
              
              <TokenSearchInput
                selectedToken={fromToken}
                onTokenSelect={setFromToken}
                commonTokens={COMMON_TOKENS}
              />
            </div>
          </div>
          
          {/* Swap Direction Button */}
          <div className="flex justify-center my-4">
            <Button 
              variant="outline"
              size="icon"
              onClick={handleTokenSwap}
              className="rounded-full h-10 w-10"
            >
              <ArrowDownIcon className="h-6 w-6" />
            </Button>
          </div>
          
          {/* To Token Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="toAmount">To</Label>
              {wallet.connected && (
                <span className="text-sm text-muted-foreground">
                  Balance: {/* TODO: Show actual balance */}
                </span>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Input
                id="toAmount"
                type="text"
                placeholder="0.0"
                value={expectedOutput ? formatNumber(expectedOutput) : ''}
                readOnly
                className="flex-1"
              />
              
              <TokenSearchInput
                selectedToken={toToken}
                onTokenSelect={setToToken}
                commonTokens={COMMON_TOKENS}
              />
            </div>
          </div>
          
          {/* Slippage Setting */}
          <div className="mb-4">
            <Label htmlFor="slippage" className="mb-2 block">
              Slippage Tolerance
            </Label>
            <div className="flex space-x-2">
              <Button 
                variant={slippage === 0.1 ? "default" : "outline"}
                size="sm"
                onClick={() => setSlippage(0.1)}
                className="w-16"
              >
                0.1%
              </Button>
              <Button 
                variant={slippage === 0.5 ? "default" : "outline"}
                size="sm"
                onClick={() => setSlippage(0.5)}
                className="w-16"
              >
                0.5%
              </Button>
              <Button 
                variant={slippage === 1.0 ? "default" : "outline"}
                size="sm"
                onClick={() => setSlippage(1.0)}
                className="w-16"
              >
                1.0%
              </Button>
              <Input
                id="customSlippage"
                type="number"
                min="0.1"
                max="5.0"
                step="0.1"
                value={slippage}
                onChange={(e) => setSlippage(Number(e.target.value))}
                className="w-20"
              />
              <span className="flex items-center">%</span>
            </div>
          </div>
          
          {/* Route Display */}
          {isLoadingRoute ? (
            <div className="flex justify-center my-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : route ? (
            <div className="my-4 p-4 bg-muted rounded-lg">
              <div className="font-medium mb-2">Route</div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="font-bold">
                  {fromToken.symbol}
                </Badge>
                {route.routePlan && route.routePlan.map((step: any, i: number) => (
                  <React.Fragment key={i}>
                    <ArrowDownIcon className="h-4 w-4 rotate-90" />
                    <Badge variant="outline" className="font-bold">
                      {step.swapInfo.outputMint === toToken.address 
                        ? toToken.symbol 
                        : "SOL"}
                    </Badge>
                  </React.Fragment>
                ))}
              </div>
              
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Output:</span>
                <span className="font-medium">
                  {expectedOutput ? formatNumber(expectedOutput) : '0'} {toToken.symbol}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Minimum Received:</span>
                <span className="font-medium">
                  {minAmountOut ? formatNumber(minAmountOut) : '0'} {toToken.symbol}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price Impact:</span>
                <span className={`font-medium ${route.priceImpactPct > 1 ? 'text-destructive' : ''}`}>
                  {route.priceImpactPct ? `${route.priceImpactPct.toFixed(2)}%` : '< 0.01%'}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Route Provider:</span>
                <span className="font-medium">Jupiter</span>
              </div>
            </div>
          ) : null}
          
          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Success Display */}
          {isSuccess && lastTxSignature && (
            <Alert variant="default" className="my-4 bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">
                Swap completed successfully!{" "}
                <a
                  href={`https://solscan.io/tx/${lastTxSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View transaction
                </a>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col">
          {!wallet.connected ? (
            <div className="w-full flex justify-center">
              <WalletMultiButton className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg px-4 py-2" />
            </div>
          ) : (
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-2"
              disabled={isLoading || isLoadingRoute || !route || Number(amount) <= 0}
              onClick={executeSwap}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Swapping...
                </>
              ) : (
                "Swap"
              )}
            </Button>
          )}
          
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>
              Powered by Jupiter Protocol. 5% YOS cashback and 20% liquidity contribution applied on all swaps.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}