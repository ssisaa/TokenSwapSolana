import React, { useState, useEffect } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useConnection } from '@/hooks/useConnection';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { performSwap as executeMultiHubSwap, initializeProgram as initializeMultiHubSwap } from '@/lib/multihub-contract-v3';

// Token definitions
const TOKENS = [
  { symbol: 'YOT', name: 'Yot Token', address: '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF' },
  { symbol: 'YOS', name: 'Yos Token', address: 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n' },
  { symbol: 'SOL', name: 'Solana', address: 'native' },
  { symbol: 'XAR', name: 'XAR Test Token', address: '9VnMEkvpCPkRVyxXZQWEDocyipoq2uGehdYwAw3yryEa' },
  { symbol: 'XMP', name: 'XMP Test Token', address: 'HMfSHCLwS6tJmg4aoYnkAqCFte1LQMkjRpfFvP5M3HPs' },
];

type TokenInfo = {
  symbol: string;
  name: string;
  address: string;
};

type TxResult = {
  success: boolean;
  signature: string;
};

const FixedSwapComponent: React.FC = () => {
  const { toast } = useToast();
  const { connected, wallet } = useMultiWallet();
  
  const [fromToken, setFromToken] = useState<TokenInfo>(TOKENS[0]); // Default to YOT
  const [toToken, setToToken] = useState<TokenInfo>(TOKENS[1]); // Default to YOS
  const [amount, setAmount] = useState<string>('100');
  const [minAmountOut, setMinAmountOut] = useState<string>('95');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TxResult | null>(null);

  const clearStatus = () => {
    setError(null);
    setTxResult(null);
  };

  const handleFromTokenChange = (symbol: string) => {
    clearStatus();
    const newToken = TOKENS.find(t => t.symbol === symbol);
    if (newToken) {
      setFromToken(newToken);
      // Swap to token if same tokens selected
      if (newToken.symbol === toToken.symbol) {
        const otherToken = TOKENS.find(t => t.symbol !== symbol) || TOKENS[1];
        setToToken(otherToken);
      }
    }
  };

  const handleToTokenChange = (symbol: string) => {
    clearStatus();
    const newToken = TOKENS.find(t => t.symbol === symbol);
    if (newToken) {
      setToToken(newToken);
      // Swap from token if same tokens selected
      if (newToken.symbol === fromToken.symbol) {
        const otherToken = TOKENS.find(t => t.symbol !== symbol) || TOKENS[0];
        setFromToken(otherToken);
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearStatus();
    setAmount(e.target.value);
  };

  const handleMinAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearStatus();
    setMinAmountOut(e.target.value);
  };

  const handleSwapTokens = () => {
    clearStatus();
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const handleInitialize = async () => {
    if (!connected || !wallet) {
      setError("Wallet not connected");
      return;
    }

    setIsInitializing(true);
    setError(null);
    setTxResult(null);

    try {
      const signature = await initializeMultiHubSwap(wallet);
      setTxResult({
        success: true,
        signature,
      });
      toast({
        title: "Initialization successful",
        description: "MultiHub Swap program has been initialized",
      });
    } catch (error: any) {
      console.error("Initialization error:", error);
      setError(error.message || "Failed to initialize MultiHub Swap program");
      toast({
        title: "Initialization failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!connected || !wallet) {
      setError("Wallet not connected");
      return;
    }

    // Validate inputs
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!minAmountOut || isNaN(parseFloat(minAmountOut)) || parseFloat(minAmountOut) <= 0) {
      setError("Please enter a valid minimum amount out");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxResult(null);

    try {
      const amountValue = parseFloat(amount);
      const minAmountOutValue = parseFloat(minAmountOut);
      
      // Extra validation for token addresses
      if (fromToken.address === 'native' && fromToken.symbol !== 'SOL') {
        throw new Error("Native token must be SOL");
      }
      
      if (toToken.address === 'native' && toToken.symbol !== 'SOL') {
        throw new Error("Native token must be SOL");
      }
      
      // Create properly validated PublicKeys or handle SOL (native) special case
      let fromAddress = fromToken.address === 'native' 
        ? SystemProgram.programId // Use SystemProgram ID for SOL
        : new PublicKey(fromToken.address);
      
      let toAddress = toToken.address === 'native'
        ? SystemProgram.programId // Use SystemProgram ID for SOL
        : new PublicKey(toToken.address);
      
      console.log(`Starting swap from ${fromToken.symbol} (${fromAddress.toString()}) to ${toToken.symbol} (${toAddress.toString()})`);
      console.log(`Amount: ${amountValue}, Minimum out: ${minAmountOutValue}`);
      
      // Check if swapping between same tokens
      if (fromAddress.equals(toAddress)) {
        throw new Error("Cannot swap between the same token");
      }
      
      // Execute the swap with detailed error handling
      const signature = await executeMultiHubSwap(
        wallet,
        fromAddress,
        toAddress,
        amountValue,
        minAmountOutValue
      );
      
      setTxResult({
        success: true,
        signature,
      });
      
      toast({
        title: "Swap successful",
        description: `${amount} ${fromToken.symbol} swapped to ${toToken.symbol}`,
      });
    } catch (error: any) {
      console.error("Swap error:", error);
      
      // Enhanced error handling with specific messages
      let errorMsg = "Failed to execute swap: ";
      
      // Check for program not having enough tokens (our added validation)
      if (error.message.includes("Program doesn't have enough") || 
          error.message.includes("Program doesn't have a")) {
        // Use the error message directly as it's already descriptive
        errorMsg = error.message;
      }
      // Check for insufficient funds error
      else if (error.message.includes("Insufficient") || 
               error.message.includes("insufficient funds")) {
        errorMsg = error.message;
      }
      // Handle custom program errors
      else if (error.message.includes("Custom program error: 0x")) {
        // Extract specific error codes
        if (error.message.includes("Custom program error: 0xb") || 
            error.message.includes("Custom program error: 0x11")) {
          errorMsg += "Invalid parameter or account. Check that all required token accounts exist.";
        } else if (error.message.includes("InstructionError: Custom(4)")) {
          errorMsg += "InsufficientFunds error. The program may not have enough tokens to complete this swap.";
        } else {
          errorMsg = error.message;
        }
      } 
      // Handle simulation errors that mention insufficient funds
      else if (error.message.includes("Transaction simulation failed") && 
               error.message.includes("InsufficientFunds")) {
        errorMsg += "Program account lacks sufficient funds. Try swapping YOT to SOL first to fund the program.";
      }
      else {
        errorMsg = error.message;
      }
      
      setError(errorMsg);
      
      toast({
        title: "Swap failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>MultiHub Swap</span>
            <div className="text-sm font-normal text-muted-foreground flex items-center space-x-1">
              <span>Fixed Implementation</span>
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
              <AlertDescription>
                {error}
                {error.includes("Program doesn't have enough") && (
                  <div className="mt-2 pt-2 border-t border-destructive/20">
                    <strong>Why this happens:</strong> When swapping SOL → YOT, the program must already have YOT tokens to send to you.
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      <li>Try swapping YOT → SOL first to fund the program</li>
                      <li>Use a smaller swap amount</li>
                      <li>The admin can fund the program with YOT</li>
                    </ul>
                  </div>
                )}
              </AlertDescription>
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