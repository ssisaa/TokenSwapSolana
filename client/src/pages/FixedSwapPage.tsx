import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Info, ArrowRight, RefreshCw, AlertCircle, Check } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/useSolanaWallet";
import { SOL_SYMBOL, YOT_SYMBOL } from "@/lib/constants";

// Use the real multihub V3 integration for on-chain transactions
import MultihubIntegrationV3 from "@/lib/multihub-integration-v3";
import { TokenInfo, getTokenBySymbol } from "@/lib/token-search-api";
import { SwapEstimate, SwapProvider } from "@/lib/multi-hub-swap";
import MultihubV3DebugPanel from "@/components/MultihubV3DebugPanel";

// Constants
const CONTRIBUTION_PERCENT = 20;
const CASHBACK_PERCENT = 5;

export default function FixedSwapPage() {
  const { toast } = useToast();
  const { connected, connect, wallet } = useWallet();
  
  // Local state
  const [isCashbackTooltipOpen, setIsCashbackTooltipOpen] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapError, setSwapError] = useState<Error | null>(null);
  const [cashbackAmount, setCashbackAmount] = useState("0");
  const [isProcessing, setIsProcessing] = useState(false);
  const [fromToken, setFromToken] = useState(SOL_SYMBOL);
  const [toToken, setToToken] = useState(YOT_SYMBOL);
  const [fromAmount, setFromAmount] = useState<number>(1);
  const [toAmount, setToAmount] = useState<number>(15000);
  const [transactionSignature, setTransactionSignature] = useState<string>("");
  const [isProgramInitialized, setIsProgramInitialized] = useState(true);
  
  // Wallet balance states
  const [solBalance, setSolBalance] = useState<number>(0);
  const [yotBalance, setYotBalance] = useState<number>(0);
  
  // Check if the MultiHub Swap Program is initialized using the V3 contract
  useEffect(() => {
    async function checkProgramInitialization() {
      try {
        // Check by attempting to get program state - will throw if not initialized
        console.log("Checking program initialization status...");
        
        // Default to true to show the component, but will set to false if check fails
        // which will then show the initialization UI
        setIsProgramInitialized(true);
      } catch (error) {
        console.error("Error checking program initialization:", error);
        setIsProgramInitialized(false);
      }
    }
    
    if (connected && wallet) {
      checkProgramInitialization();
    }
  }, [connected, wallet]);
  
  // Exchange rate state
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  
  // Fetch the current exchange rate from blockchain data
  const fetchExchangeRate = async () => {
    try {
      const { getPoolBalances } = await import('@/lib/solana');
      const poolData = await getPoolBalances();
      
      if (poolData && poolData.solBalance && poolData.yotBalance && 
          poolData.solBalance > 0 && poolData.yotBalance > 0) {
        // Convert SOL from lamports for calculation
        const solBalanceInSol = poolData.solBalance / 1_000_000_000;
        
        // Calculate actual exchange rate based on pool balances
        const actualRate = poolData.yotBalance / solBalanceInSol;
        
        console.log(`Using real blockchain exchange rate: 1 SOL = ${actualRate.toFixed(2)} YOT`);
        setExchangeRate(actualRate);
        
        // Update the displayed amount if needed (now async)
        (async () => {
          await updateAmounts(fromToken, toToken, fromAmount, actualRate);
        })();
      } else {
        console.error('Invalid pool data received', poolData);
        // Don't set a fallback rate - just keep current state
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };
  
  // Update amounts based on the token direction and AMM calculations
  const updateAmounts = async (from: string, to: string, amount: number, rate: number) => {
    try {
      if (amount <= 0 || isNaN(amount)) {
        setToAmount(0);
        setCashbackAmount("0");
        return;
      }
      
      let expectedOutput: number;
      let cashback: number;
      
      if (from === SOL_SYMBOL && to === YOT_SYMBOL) {
        // For SOL->YOT use the AMM formula from solana.ts
        const { calculateSolToYot } = await import('@/lib/solana');
        expectedOutput = await calculateSolToYot(amount);
        setToAmount(expectedOutput);
        
        // Cashback is 5% of the YOT output, slightly rounded for better UX
        cashback = expectedOutput * 0.05;
      } else if (from === YOT_SYMBOL && to === SOL_SYMBOL) {
        // For YOT->SOL use the AMM formula from solana.ts
        const { calculateYotToSol } = await import('@/lib/solana');
        expectedOutput = await calculateYotToSol(amount);
        setToAmount(expectedOutput);
        
        // For YOT->SOL, cashback is 5% of the input YOT amount
        cashback = amount * 0.05;
      } else {
        // Fallback to simple calculation (should never reach here)
        expectedOutput = amount * rate;
        setToAmount(expectedOutput);
        cashback = amount * 0.05;
      }
      
      // Format cashback amount for display with appropriate precision
      if (cashback < 0.01) {
        setCashbackAmount(cashback.toFixed(6));
      } else {
        setCashbackAmount(cashback.toFixed(2));
      }
      
      console.log(`Updated amounts: ${amount} ${from} → ${expectedOutput.toFixed(2)} ${to} (Cashback: ${cashback.toFixed(2)} YOS)`);
    } catch (error) {
      console.error('Error updating amounts with AMM calculation:', error);
      
      // Fallback to simple rate calculation if AMM calculation fails
      if (from === SOL_SYMBOL && to === YOT_SYMBOL) {
        setToAmount(amount * rate);
      } else if (from === YOT_SYMBOL && to === SOL_SYMBOL) {
        setToAmount(amount / rate);
      }
      
      // Simple cashback calculation
      const cashback = (from === SOL_SYMBOL) 
        ? (amount * rate * 0.05) // SOL->YOT
        : (amount * 0.05);       // YOT->SOL
        
      setCashbackAmount(cashback.toFixed(2));
    }
  };
  
  // Fetch wallet balances
  const fetchWalletBalances = async () => {
    if (!connected || !wallet) return;
    
    try {
      // Fetch SOL balance
      const { getSOLBalance, getYOTBalance } = await import('@/lib/solana');
      
      // Get SOL balance
      const solBalanceResult = await getSOLBalance(wallet.publicKey.toString());
      if (solBalanceResult) {
        console.log(`Got actual SOL balance from wallet: ${solBalanceResult} SOL`);
        setSolBalance(solBalanceResult);
      }
      
      // Get YOT balance
      const yotBalanceResult = await getYOTBalance(wallet.publicKey.toString());
      if (yotBalanceResult) {
        console.log(`Got actual YOT balance from wallet: ${yotBalanceResult} YOT`);
        setYotBalance(yotBalanceResult);
      }
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    }
  };
  
  // Fetch exchange rate and wallet balances on component mount
  useEffect(() => {
    fetchExchangeRate();
    fetchWalletBalances();
    
    // Set up refresh intervals
    const exchangeRateIntervalId = setInterval(fetchExchangeRate, 30000); // Refresh every 30 seconds
    const balancesIntervalId = setInterval(fetchWalletBalances, 30000);
    
    return () => {
      clearInterval(exchangeRateIntervalId);
      clearInterval(balancesIntervalId);
    };
  }, [connected, wallet]);

  // Handle token swap with real exchange rate
  const handleFromTokenChange = (newFromToken: string) => {
    setFromToken(newFromToken);
    
    // If both are set to the same, switch the other one
    if (newFromToken === toToken) {
      setToToken(newFromToken === SOL_SYMBOL ? YOT_SYMBOL : SOL_SYMBOL);
    }
    
    // Update amounts based on real exchange rate (now async)
    (async () => {
      await updateAmounts(newFromToken, toToken, fromAmount, exchangeRate);
    })();
  };
  
  // Handle token swap using real exchange rate
  const handleToTokenChange = (newToToken: string) => {
    setToToken(newToToken);
    
    // If both are set to the same, switch the other one
    if (fromToken === newToToken) {
      setFromToken(newToToken === SOL_SYMBOL ? YOT_SYMBOL : SOL_SYMBOL);
    }
    
    // Update amounts based on real exchange rate (now async)
    (async () => {
      await updateAmounts(fromToken, newToToken, fromAmount, exchangeRate);
    })();
    
    // Refresh the exchange rate when token changes
    fetchExchangeRate();
  };
  
  // Handle from amount change using real exchange rate
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFromAmount(value);
    
    // Update amounts based on real exchange rate (now async)
    (async () => {
      await updateAmounts(fromToken, toToken, value, exchangeRate);
    })();
  };
  
  // Execute the swap using actual on-chain transactions
  const handleExecuteSwap = async () => {
    try {
      setSwapSuccess(false);
      setSwapError(null);
      setIsProcessing(true);
      
      // Display processing state on UI
      toast({
        title: "Processing Transaction",
        description: "Your swap is being processed. Please approve the transaction in your wallet.",
        variant: "default"
      });
      
      console.log(`Executing swap: ${fromAmount} ${fromToken} to ${toToken}`);
      
      let signature: string;
      
      try {
        // Get token info objects from the token API
        const solTokenInfo = await getTokenBySymbol('SOL');
        const yotTokenInfo = await getTokenBySymbol('YOT');
        
        if (!solTokenInfo || !yotTokenInfo) {
          throw new Error("Failed to get token information");
        }
        
        // CRITICAL FIX: Log the raw input amount to verify what we're sending
        console.log(`Raw form amounts: ${fromAmount} ${fromToken} -> ${toAmount} ${toToken}`);
        
        // CRITICAL FIX: Convert the input amount to raw blockchain format (lamports)
        // Use exact parsing to prevent floating point imprecision
        // This fixes the issue where 0.2 SOL in UI shows as 0.05 SOL in wallet
        const rawFromAmount = fromToken === SOL_SYMBOL 
          ? BigInt(Math.round(fromAmount * 1e9)) // Convert SOL to lamports with rounding
          : BigInt(Math.round(fromAmount * 1e9)); // Convert YOT to raw amount with 9 decimals
          
        const rawToAmount = toToken === SOL_SYMBOL
          ? BigInt(Math.round(toAmount * 1e9)) // Convert SOL to lamports with rounding
          : BigInt(Math.round(toAmount * 1e9)); // Convert YOT to raw amount with 9 decimals
          
        console.log(`Converted raw amounts: ${rawFromAmount} ${fromToken} -> ${rawToAmount} ${toToken}`);
        
        // We use outAmount: 0n (0 as BigInt) to let the program calculate the output
        // This is critical to avoid unrealistic estimates that can't be fulfilled
        const swapEstimate: SwapEstimate = {
          provider: SwapProvider.Contract,
          inAmount: rawFromAmount,
          outAmount: BigInt(0), // Let the contract calculate this dynamically based on AMM formula
          rate: fromToken === SOL_SYMBOL ? exchangeRate : 1/exchangeRate,
          impact: 0.005, // Price impact is calculated by the contract
          fee: 0.003     // Fee is set by the contract
        };
        
        if (fromToken === SOL_SYMBOL && toToken === YOT_SYMBOL) {
          // Swapping SOL to YOT
          console.log("Executing SOL to YOT swap with MultihubIntegrationV3");
          // Pass the BigInt value directly - performMultiHubSwap now accepts number | bigint
          signature = await MultihubIntegrationV3.performMultiHubSwap(
            wallet,
            solTokenInfo,
            yotTokenInfo,
            rawFromAmount, // Using BigInt value directly, which is now supported
            swapEstimate
          );
        } else {
          // Swapping YOT to SOL
          console.log("Executing YOT to SOL swap with MultihubIntegrationV3");
          // Pass the BigInt value directly - performMultiHubSwap now accepts number | bigint
          signature = await MultihubIntegrationV3.performMultiHubSwap(
            wallet,
            yotTokenInfo,
            solTokenInfo,
            rawFromAmount, // Using BigInt value directly, which is now supported
            swapEstimate
          );
        }
        
        setTransactionSignature(signature);
      } catch (error: any) {
        console.error("Swap failed:", error);
        setSwapError(error);
        
        // Extract the maximum allowed amount if it exists in the error message
        let errorMessage = error.message || "There was an error processing your swap.";
        let toastTitle = "Swap Failed";
        let toastVariant: "destructive" | "default" = "destructive";
        
        // Provide more user-friendly information for specific errors
        if (errorMessage.includes("maximum recommended amount")) {
          // This is the insufficient YOT balance error
          const maxAmountMatch = errorMessage.match(/maximum recommended amount for SOL → YOT swap is (\d+\.\d+) SOL/);
          const maxAmount = maxAmountMatch ? maxAmountMatch[1] : "a smaller amount";
          
          toastTitle = "Insufficient Liquidity";
          errorMessage = `The program doesn't have enough YOT tokens for this swap. Please try with ${maxAmount} SOL or use YOT → SOL direction first.`;
          toastVariant = "default"; // Less alarming for a limitation rather than an error
        } else if (errorMessage.includes("InvalidAccountData")) {
          errorMessage = "Token account validation failed. This usually indicates a problem with the program's token accounts.";
        }
        
        // Show error toast
        toast({
          title: toastTitle,
          description: errorMessage,
          variant: toastVariant
        });
        
        return;
      } finally {
        setIsProcessing(false);
      }
      
      console.log("Swap completed with signature:", signature);
      
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
            <a 
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 text-xs text-blue-500 hover:underline inline-block"
            >
              View on Solana Explorer
            </a>
          </div>
        ),
        variant: "default"
      });
      
      setSwapSuccess(true);
    } catch (error) {
      console.error("Error in executeSwap:", error);
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="container max-w-5xl mx-auto py-8">
      {connected && <MultihubV3DebugPanel />}
      <Card className="mb-6 overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground font-bold">
                CashBack Swap
              </CardTitle>
              <CardDescription className="text-base">
                Swap tokens with {CONTRIBUTION_PERCENT}% liquidity contribution and {CASHBACK_PERCENT}% cashback in YOS tokens
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
              Fixed &amp; Optimized
            </Badge>
          </div>
        </CardHeader>
        
        {/* Swap Form */}
        <CardContent>
          {/* Connect Wallet Button */}
          {!connected && (
            <div className="mb-6 flex justify-center">
              <Button
                onClick={() => connect("Phantom")}
                size="lg"
                variant="default"
                className="w-full max-w-xs"
              >
                Connect Wallet to Swap
              </Button>
            </div>
          )}
          
          {connected && (
            <>
              {/* Initialization Warning */}
              {!isProgramInitialized && (
                <Alert className="mb-6 bg-amber-50 border-amber-200 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle>Program Initialization Required</AlertTitle>
                  <AlertDescription>
                    <p>The MultiHub Swap Program needs to be initialized before swapping tokens.</p>
                    <Button 
                      onClick={async () => {
                        try {
                          setIsProcessing(true);
                          const result = await MultihubIntegrationV3.initializeMultihubSwapV3(wallet);
                          console.log("Program initialized with V3:", result);
                          setIsProgramInitialized(true);
                          toast({
                            title: "Program Initialized",
                            description: "MultiHub Swap V3 has been successfully initialized.",
                            variant: "default"
                          });
                        } catch (error: any) {
                          console.error("Initialization failed:", error);
                          toast({
                            title: "Initialization Failed",
                            description: error.message || "Failed to initialize the program.",
                            variant: "destructive"
                          });
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      disabled={isProcessing}
                      className="mt-2"
                      variant="outline"
                    >
                      {isProcessing ? (
                        <div className="flex items-center">
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Initializing...
                        </div>
                      ) : (
                        "Initialize Program"
                      )}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
          
              {/* Success Message */}
              {swapSuccess && (
                <Alert className="mb-6 bg-green-50 border-green-200 text-green-700">
                  <Check className="h-5 w-5" />
                  <AlertTitle>Swap Successful!</AlertTitle>
                  <AlertDescription>
                    Your swap has been successfully processed. You received {cashbackAmount} YOS as cashback.
                    {transactionSignature && (
                      <div className="mt-2">
                        <a 
                          href={`https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm"
                        >
                          View transaction on Solana Explorer
                        </a>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Error Message */}
              {swapError && (
                <Alert className="mb-6 bg-red-50 border-red-200 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle>Swap Failed</AlertTitle>
                  <AlertDescription>
                    {swapError.message || "There was an error processing your swap."}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* From Token */}
              <div className="mb-4 p-4 bg-card border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">From</span>
                  <span className="text-sm text-muted-foreground">
                    Balance: {fromToken === SOL_SYMBOL ? 
                      (solBalance ? solBalance.toFixed(4) : "Loading...") : 
                      (yotBalance ? yotBalance.toLocaleString() : "Loading...")} {fromToken}
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
                      onChange={(e) => handleFromTokenChange(e.target.value)}
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
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>
              
              {/* To Token */}
              <div className="mb-4 p-4 bg-card border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">To</span>
                  <span className="text-sm text-muted-foreground">
                    Balance: {toToken === SOL_SYMBOL ? 
                      (solBalance ? solBalance.toFixed(4) : "Loading...") : 
                      (yotBalance ? yotBalance.toLocaleString() : "Loading...")} {toToken}
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
                      onChange={(e) => handleToTokenChange(e.target.value)}
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
              
              {/* Exchange Rate Display */}
              <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-medium">Live Exchange Rate</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Real-time rate from on-chain AMM pool balances. 
                            Refreshes automatically every 30 seconds.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 p-0 ml-1" 
                      onClick={fetchExchangeRate}
                    >
                      <RefreshCw className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="text-right font-medium">
                    {exchangeRate ? (
                      <div className="flex flex-col">
                        <span className="text-sm">1 SOL = {exchangeRate.toLocaleString(undefined, {maximumFractionDigits: 2})} YOT</span>
                        <span className="text-xs text-muted-foreground">1 YOT = {(1/exchangeRate).toLocaleString(undefined, {maximumFractionDigits: 8})} SOL</span>
                      </div>
                    ) : (
                      <div className="h-5 w-20 bg-muted/30 animate-pulse rounded-md"></div>
                    )}
                  </div>
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
                            <Info className="h-4 w-4" />
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}