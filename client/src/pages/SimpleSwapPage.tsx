import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { InfoIcon, ArrowRightIcon, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Constants
const SOL_SYMBOL = "SOL";
const YOT_SYMBOL = "YOT";
const CONTRIBUTION_PERCENT = 20;
const CASHBACK_PERCENT = 5;

export default function SimpleSwapPage() {
  const { toast } = useToast();
  
  // Local state
  const [isCashbackTooltipOpen, setIsCashbackTooltipOpen] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("0");
  const [isProcessing, setIsProcessing] = useState(false);
  const [fromToken, setFromToken] = useState(SOL_SYMBOL);
  const [toToken, setToToken] = useState(YOT_SYMBOL);
  const [fromAmount, setFromAmount] = useState<number>(1);
  const [toAmount, setToAmount] = useState<number>(15000);
  
  // Handle token swap
  const handleFromTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFromToken = e.target.value;
    setFromToken(newFromToken);
    
    // If both are set to the same, switch the other one
    if (newFromToken === toToken) {
      setToToken(newFromToken === SOL_SYMBOL ? YOT_SYMBOL : SOL_SYMBOL);
    }
    
    // Update amounts based on mock exchange rate
    if (newFromToken === SOL_SYMBOL) {
      // SOL to YOT rate: 1 SOL = 15000 YOT
      setToAmount(fromAmount * 15000);
    } else {
      // YOT to SOL rate: 15000 YOT = 1 SOL
      setToAmount(fromAmount / 15000);
    }
    
    // Update cashback calculation
    const cashback = toAmount * 0.05;
    setCashbackAmount(cashback.toFixed(6));
  };
  
  // Handle token swap
  const handleToTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newToToken = e.target.value;
    setToToken(newToToken);
    
    // If both are set to the same, switch the other one
    if (fromToken === newToToken) {
      setFromToken(newToToken === SOL_SYMBOL ? YOT_SYMBOL : SOL_SYMBOL);
    }
    
    // Update amounts based on mock exchange rate
    if (newToToken === YOT_SYMBOL) {
      // SOL to YOT rate: 1 SOL = 15000 YOT
      setToAmount(fromAmount * 15000);
    } else {
      // YOT to SOL rate: 15000 YOT = 1 SOL
      setToAmount(fromAmount / 15000);
    }
    
    // Update cashback calculation
    const cashback = toAmount * 0.05;
    setCashbackAmount(cashback.toFixed(6));
  };
  
  // Handle from amount change
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFromAmount(value);
    
    // Update to amount based on exchange rate
    if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
      // SOL to YOT rate: 1 SOL = 15000 YOT
      setToAmount(value * 15000);
    } else if (fromToken === YOT_SYMBOL && toToken === SOL_SYMBOL) {
      // YOT to SOL rate: 15000 YOT = 1 SOL
      setToAmount(value / 15000);
    }
    
    // Update cashback calculation - 5% of the to amount
    const newToAmount = (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) 
      ? value * 15000
      : value / 15000;
      
    const cashback = newToAmount * 0.05;
    setCashbackAmount(cashback.toFixed(6));
  };
  
  // Generate mock transaction signature
  const generateMockSignature = () => {
    const randomHex = Array.from(
      { length: 32 },
      () => Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    return randomHex;
  };
  
  // Execute mock swap
  const handleExecuteSwap = async () => {
    try {
      setSwapSuccess(false);
      setIsProcessing(true);
      
      // Display processing state on UI
      toast({
        title: "Processing Transaction",
        description: "Your swap is being processed. Please wait...",
        variant: "default"
      });
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock signature
      const signature = generateMockSignature();
      
      console.log("Mock swap completed with signature:", signature);
      
      // Show success message with signature
      toast({
        title: "Swap Successful!",
        description: (
          <div>
            <p>Swap completed successfully.</p>
            <p className="mt-2 text-green-500 font-medium">
              {fromAmount} {fromToken} → {toAmount.toFixed(6)} {toToken}
            </p>
            <p className="mt-1 text-xs">
              {CONTRIBUTION_PERCENT}% contributed to liquidity pool
            </p>
            <p className="text-xs">
              {CASHBACK_PERCENT}% cashback received as YOS tokens
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Transaction ID: {signature.substring(0, 15)}...
            </p>
          </div>
        ),
        variant: "default"
      });
      
      setSwapSuccess(true);
    } catch (error) {
      console.error("Mock swap failed:", error);
      
      toast({
        title: "Swap Failed",
        description: "There was an error processing your swap.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card className="mb-4 overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground font-bold">
            Simple Swap Demo
          </CardTitle>
          <CardDescription className="text-center text-base">
            Swap tokens with {CONTRIBUTION_PERCENT}% liquidity contribution and {CASHBACK_PERCENT}% cashback in YOS tokens
          </CardDescription>
        </CardHeader>
        
        {/* Swap Form */}
        <CardContent>
          {/* Success Message */}
          {swapSuccess && (
            <Alert className="mb-6 bg-green-50 border-green-200 text-green-700">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <AlertTitle>Swap Successful!</AlertTitle>
              <AlertDescription>
                Your swap has been successfully processed. You received {cashbackAmount} YOS as cashback.
              </AlertDescription>
            </Alert>
          )}
          
          {/* From Token */}
          <div className="mb-4 p-4 bg-card border rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">From</span>
              <span className="text-sm text-muted-foreground">
                Balance: {fromToken === SOL_SYMBOL ? "6.9898" : "159,627,437.145"} {fromToken}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {fromToken === "SOL" ? "S" : "Y"}
                </div>
                <select 
                  className="text-lg font-medium bg-transparent border-none outline-none cursor-pointer"
                  value={fromToken}
                  onChange={handleFromTokenChange}
                >
                  <option value="SOL">SOL</option>
                  <option value="YOT">YOT</option>
                </select>
              </div>
              
              <input
                type="number"
                value={fromAmount}
                onChange={handleFromAmountChange}
                className="text-right text-lg w-1/2 bg-transparent border-none focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
          
          {/* Arrow */}
          <div className="flex justify-center my-2">
            <div className="rounded-full bg-primary/10 p-2">
              <ArrowRightIcon className="h-4 w-4 text-primary" />
            </div>
          </div>
          
          {/* To Token */}
          <div className="mb-4 p-4 bg-card border rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">To</span>
              <span className="text-sm text-muted-foreground">
                Balance: {toToken === SOL_SYMBOL ? "6.9898" : "159,627,437.145"} {toToken}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {toToken === "SOL" ? "S" : "Y"}
                </div>
                <select 
                  className="text-lg font-medium bg-transparent border-none outline-none cursor-pointer"
                  value={toToken}
                  onChange={handleToTokenChange}
                >
                  <option value="SOL">SOL</option>
                  <option value="YOT">YOT</option>
                </select>
              </div>
              
              <input
                type="number"
                value={toAmount}
                readOnly
                className="text-right text-lg w-1/2 bg-transparent border-none focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
          
          {/* Cashback Preview */}
          <div className="mb-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-sm font-medium">YOS Cashback Reward</span>
                <TooltipProvider>
                  <Tooltip open={isCashbackTooltipOpen} onOpenChange={setIsCashbackTooltipOpen}>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0 ml-1" onClick={() => setIsCashbackTooltipOpen(!isCashbackTooltipOpen)}>
                        <InfoIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        You receive {CASHBACK_PERCENT}% of the swap amount as YOS tokens.
                        {CONTRIBUTION_PERCENT}% of your swap contributes to the SOL-YOT liquidity pool.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
                {cashbackAmount} YOS
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              This amount will be automatically sent to your wallet
            </div>
          </div>
          
          {/* Swap Button */}
          <Button
            onClick={handleExecuteSwap}
            disabled={isProcessing || !fromAmount || !toAmount}
            className="w-full py-6 text-lg bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700 transition-all"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </div>
            ) : (
              <>Swap with {CASHBACK_PERCENT}% Cashback</>
            )}
          </Button>
          
          <div className="mt-4 text-xs text-center text-muted-foreground">
            <span className="font-medium text-warning">Demo Mode:</span> This page demonstrates the swap UI flow using mock transactions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}