import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  initializeMultiHubSwap, 
  executeMultiHubSwap 
} from '@/lib/multihub-client-fixed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Predefined tokens for testing
const TOKENS = [
  { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'YOT', name: 'YieldOwlToken', address: '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF', decimals: 9 },
  { symbol: 'YOS', name: 'YieldOwlShares', address: 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n', decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', address: '9T7uw5dqaEmEC4McqyefzYsrEP5hoC4e2oV8it1Uc4f1', decimals: 9 }
];

const FixedSwapComponent: React.FC = () => {
  const { publicKey, connected, signTransaction, signAllTransactions, sendTransaction } = useWallet();
  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  const [amount, setAmount] = useState('1');
  const [minAmountOut, setMinAmountOut] = useState('0.95');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [txResult, setTxResult] = useState<{ signature: string, success: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFromTokenChange = (value: string) => {
    const token = TOKENS.find(t => t.symbol === value);
    if (token) {
      setFromToken(token);
    }
  };

  const handleToTokenChange = (value: string) => {
    const token = TOKENS.find(t => t.symbol === value);
    if (token) {
      setToToken(token);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) { // Allow numbers and a single decimal point
      setAmount(value);
      
      // Update min amount based on 5% slippage
      if (value) {
        const parsedValue = parseFloat(value);
        if (!isNaN(parsedValue)) {
          setMinAmountOut((parsedValue * 0.95).toFixed(2));
        }
      }
    }
  };

  const handleMinAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) { // Allow numbers and a single decimal point
      setMinAmountOut(value);
    }
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const handleInitialize = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    setIsInitializing(true);
    setError(null);
    setTxResult(null);

    try {
      const wallet = { publicKey, signTransaction, signAllTransactions, sendTransaction };
      const signature = await initializeMultiHubSwap(wallet);
      
      setTxResult({
        signature,
        success: true
      });
      
      toast({
        title: "Program Initialized",
        description: "MultiHub Swap program has been successfully initialized",
      });
    } catch (err) {
      console.error("Initialization error:", err);
      setError(err instanceof Error ? err.message : "Unknown error during initialization");
      
      toast({
        title: "Initialization Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to swap",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxResult(null);

    try {
      const wallet = { publicKey, signTransaction, signAllTransactions, sendTransaction };
      const fromMint = new PublicKey(fromToken.address);
      const toMint = new PublicKey(toToken.address);
      const amountValue = parseFloat(amount);
      const minAmountOutValue = parseFloat(minAmountOut);
      
      const signature = await executeMultiHubSwap(
        wallet,
        fromMint,
        toMint,
        amountValue,
        minAmountOutValue
      );
      
      setTxResult({
        signature,
        success: true
      });
      
      toast({
        title: "Swap Successful",
        description: `Successfully swapped ${amount} ${fromToken.symbol} to ${toToken.symbol}`,
      });
    } catch (err) {
      console.error("Swap error:", err);
      setError(err instanceof Error ? err.message : "Unknown error during swap");
      
      toast({
        title: "Swap Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl font-bold">
            MultiHub Fixed Swap
            <div className="text-sm text-muted-foreground mt-1">
              New implementation with fixed initialization
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Wallet not connected</AlertTitle>
              <AlertDescription>
                Please connect your wallet to use the swap functionality
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="from-token">From</Label>
            <div className="flex space-x-2">
              <Select value={fromToken.symbol} onValueChange={handleFromTokenChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map(token => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="Amount"
                className="flex-1"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleSwapTokens} 
              disabled={isLoading}
              className="rounded-full"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M7 10v12" />
                <path d="M15 4v12" />
                <path d="m3 14 4-4 4 4" />
                <path d="m21 8-4-4-4 4" />
              </svg>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-token">To</Label>
            <div className="flex space-x-2">
              <Select value={toToken.symbol} onValueChange={handleToTokenChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map(token => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="min-amount"
                type="text"
                value={minAmountOut}
                onChange={handleMinAmountChange}
                placeholder="Minimum amount out"
                className="flex-1"
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {txResult && (
            <Alert variant={txResult.success ? "default" : "destructive"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{txResult.success ? "Success" : "Transaction Completed"}</AlertTitle>
              <AlertDescription className="break-all">
                Signature: {txResult.signature}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            className="w-full" 
            onClick={handleInitialize} 
            disabled={isInitializing || !connected}
          >
            {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Initialize Program (Admin)
          </Button>
          
          <Button 
            className="w-full" 
            onClick={handleExecuteSwap} 
            disabled={isLoading || !connected}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Swap
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default FixedSwapComponent;