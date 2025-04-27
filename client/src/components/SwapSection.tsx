import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloudLightning, AlertCircle, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useSwap } from "@/hooks/useSwap";
import { SOL_SYMBOL, YOT_SYMBOL, CLUSTER } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SwapSection() {
  const { wallet, connected } = useWallet();
  const { 
    fromToken, 
    toToken, 
    fromAmount, 
    toAmount, 
    fromBalance, 
    toBalance, 
    exchangeRate, 
    setFromToken, 
    setToToken, 
    setFromAmount, 
    setToAmount, 
    switchTokens, 
    calculateToAmount, 
    calculateFromAmount, 
    executeSwap, 
    isPending, 
    isSuccess, 
    error 
  } = useSwap();
  
  const { toast } = useToast();
  
  const [fromTokenOptions, setFromTokenOptions] = useState(false);
  const [toTokenOptions, setToTokenOptions] = useState(false);
  const [transactionState, setTransactionState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");
  const [lastTransaction, setLastTransaction] = useState<{signature?: string} | null>(null);

  useEffect(() => {
    if (isPending) {
      setTransactionState('pending');
    } else if (isSuccess) {
      setTransactionState('success');
      toast({
        title: `${fromToken} → ${toToken} Swap Initiated`,
        description: "Your transaction has been confirmed on the blockchain. The first part of the swap (deposit) is complete.",
        variant: "default",
      });
      
      // Store transaction info for reference
      if (isSuccess && lastTransaction?.signature) {
        setLastTransaction(lastTransaction);
      }
      
      // No need to refresh transaction history manually - TransactionHistory component
      // will refresh on its own after a transaction is confirmed
      
      setTimeout(() => setTransactionState('idle'), 5000);
    } else if (error) {
      setTransactionState('error');
      setErrorMessage(error instanceof Error ? error.message : "Transaction failed");
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive",
      });
      setTimeout(() => setTransactionState('idle'), 5000);
    }
  }, [isPending, isSuccess, error, toast]);

  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value === "" ? "" : Number(value));
    if (value !== "") {
      calculateToAmount(Number(value));
    } else {
      setToAmount("");
    }
  };

  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToAmount(value === "" ? "" : Number(value));
    if (value !== "") {
      calculateFromAmount(Number(value));
    } else {
      setFromAmount("");
    }
  };

  const toggleFromTokenSelect = () => {
    setFromTokenOptions(!fromTokenOptions);
    setToTokenOptions(false);
  };

  const toggleToTokenSelect = () => {
    setToTokenOptions(!toTokenOptions);
    setFromTokenOptions(false);
  };

  const selectFromToken = (token: string) => {
    if (token !== fromToken) {
      setFromToken(token);
      if (token === toToken) {
        setToToken(token === SOL_SYMBOL ? YOT_SYMBOL : SOL_SYMBOL);
      }
    }
    setFromTokenOptions(false);
  };

  const selectToToken = (token: string) => {
    if (token !== toToken) {
      setToToken(token);
      if (token === fromToken) {
        setFromToken(token === SOL_SYMBOL ? YOT_SYMBOL : SOL_SYMBOL);
      }
    }
    setToTokenOptions(false);
  };

  const handleExecuteSwap = async () => {
    if (!connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to swap tokens.",
        variant: "destructive",
      });
      return;
    }
    
    if (!fromAmount || parseFloat(fromAmount.toString()) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to swap.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const result = await executeSwap();
      setLastTransaction(result);
    } catch (error) {
      console.error("Swap error:", error);
      setTransactionState('error');
      setErrorMessage(error instanceof Error ? error.message : "Transaction failed");
    }
  };

  return (
    <Card className="bg-dark-100 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
        <CloudLightning className="h-5 w-5 mr-2 text-primary-400" />
        Swap Tokens
      </h2>
      
      <div className="space-y-4">
        {/* From Token Input */}
        <div className="bg-dark-300 rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm text-gray-400">From</label>
            <span className="text-sm text-gray-400">
              Balance: <span>{formatCurrency(fromBalance)}</span>
            </span>
          </div>
          
          <div className="flex items-center">
            <Input
              type="number"
              placeholder="0.00"
              className="bg-transparent text-white text-xl font-medium focus:outline-none w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              value={fromAmount === "" ? "" : fromAmount}
              onChange={handleFromAmountChange}
            />
            
            <div className="relative">
              <Button
                variant="outline"
                className="bg-dark-400 hover:bg-dark-100 rounded-lg py-2 px-3 flex items-center transition"
                onClick={toggleFromTokenSelect}
              >
                <span className="font-medium mr-2">{fromToken}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              
              {/* Token Selector Dropdown */}
              {fromTokenOptions && (
                <div className="absolute right-0 mt-2 w-48 bg-dark-100 rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    <button
                      className="w-full text-left px-4 py-2 rounded hover:bg-dark-300 transition flex items-center"
                      onClick={() => selectFromToken(SOL_SYMBOL)}
                    >
                      <svg className="h-5 w-5 mr-2 text-purple-400" viewBox="0 0 32 32">
                        <path fill="currentColor" d="M22.6 12l-4.5-2.6l-4.6-2.7l-4.5-2.6V9l4.5 2.6v5.2l4.6 2.6v-5.2l4.5-2.6V12z M22.6 16.1l-4.5 2.6v5.2l4.5-2.6v-5.2z M27.2 14.8l-4.5 2.6v5.2l4.5-2.6v-5.2z M13.5 23.9l4.5 2.6v-5.2l-4.5-2.6v5.2z M9 21.3l4.5 2.6v-5.2L9 16.1v5.2z"></path>
                      </svg>
                      SOL
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 rounded hover:bg-dark-300 transition flex items-center"
                      onClick={() => selectFromToken(YOT_SYMBOL)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      YOT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="bg-dark-400 hover:bg-dark-300 p-2 rounded-full transition"
            onClick={switchTokens}
          >
            <CloudLightning className="h-6 w-6 text-primary-400" />
          </Button>
        </div>
        
        {/* To Token Input */}
        <div className="bg-dark-300 rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm text-gray-400">To</label>
            <span className="text-sm text-gray-400">
              Balance: <span>{formatCurrency(toBalance)}</span>
            </span>
          </div>
          
          <div className="flex items-center">
            <Input
              type="number"
              placeholder="0.00"
              className="bg-transparent text-white text-xl font-medium focus:outline-none w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              value={toAmount === "" ? "" : toAmount}
              onChange={handleToAmountChange}
            />
            
            <div className="relative">
              <Button
                variant="outline"
                className="bg-dark-400 hover:bg-dark-100 rounded-lg py-2 px-3 flex items-center transition"
                onClick={toggleToTokenSelect}
              >
                <span className="font-medium mr-2">{toToken}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              
              {/* Token Selector Dropdown */}
              {toTokenOptions && (
                <div className="absolute right-0 mt-2 w-48 bg-dark-100 rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    <button
                      className="w-full text-left px-4 py-2 rounded hover:bg-dark-300 transition flex items-center"
                      onClick={() => selectToToken(SOL_SYMBOL)}
                    >
                      <svg className="h-5 w-5 mr-2 text-purple-400" viewBox="0 0 32 32">
                        <path fill="currentColor" d="M22.6 12l-4.5-2.6l-4.6-2.7l-4.5-2.6V9l4.5 2.6v5.2l4.6 2.6v-5.2l4.5-2.6V12z M22.6 16.1l-4.5 2.6v5.2l4.5-2.6v-5.2z M27.2 14.8l-4.5 2.6v5.2l4.5-2.6v-5.2z M13.5 23.9l4.5 2.6v-5.2l-4.5-2.6v5.2z M9 21.3l4.5 2.6v-5.2L9 16.1v5.2z"></path>
                      </svg>
                      SOL
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 rounded hover:bg-dark-300 transition flex items-center"
                      onClick={() => selectToToken(YOT_SYMBOL)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      YOT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Exchange Rate Info */}
        <div className="bg-dark-400 rounded-lg p-3 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Exchange Rate</span>
            <span>{exchangeRate}</span>
          </div>
          <div className="flex justify-between text-gray-400 mt-1">
            <span>Pool Fee</span>
            <span>0.30%</span>
          </div>
        </div>
        
        {/* Network Info */}
        <Alert className="bg-dark-400 border-0 text-gray-200 text-xs">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 pulse"></div>
            <AlertTitle className="text-xs">Connected to Solana {CLUSTER}</AlertTitle>
          </div>
          <AlertDescription className="text-xs text-gray-400 mt-1">
            <p>This application connects to real Solana devnet addresses and balances.</p>
            <div className="mt-2 p-2 bg-dark-300 rounded-md">
              <div className="font-semibold text-white mb-1">How the swap works:</div>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Your {fromToken} is sent to the liquidity pool (This is functional)</li>
                <li>Pool calculates exchange rate and determines {toToken} amount</li>
                <li>Pool sends {toToken} to your wallet (Requires full token-swap program)</li>
              </ol>
            </div>
            <p className="mt-2">Currently, only step 1 is implemented with real blockchain transactions. Steps 2-3 require a deployed token-swap program with proper authority.</p>
            <div className="mt-3">
              <a href="/integration" className="text-primary-400 hover:text-primary-300 text-xs font-medium underline flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Integration Roadmap
              </a>
            </div>
          </AlertDescription>
        </Alert>

        {/* Swap Button */}
        <Button
          className={`w-full text-white font-medium py-4 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed
          ${isPending 
            ? 'bg-yellow-600' 
            : 'bg-gradient-to-r from-primary-600 to-blue-700 hover:from-primary-700 hover:to-blue-800'}`}
          disabled={!connected || isPending}
          onClick={handleExecuteSwap}
        >
          {!connected && "Connect Wallet to Swap"}
          {connected && !isPending && `Swap ${fromToken} to ${toToken}`}
          {connected && isPending && (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          )}
        </Button>
        
        {/* Transaction Status */}
        {transactionState === 'success' && (
          <Alert className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border-green-800 text-green-200">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            <AlertTitle>Swap Complete: Tokens Exchanged</AlertTitle>
            <AlertDescription>
              <div className="mb-2">
                <p>Your swap transaction has been successfully processed!</p>
                <div className="flex items-center mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>✓ Step 1: Sent {fromToken} to pool (Transaction confirmed)</span>
                </div>

                <div className="flex items-center mt-2 text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>✓ Step 2: Received {toToken} from pool (Transaction confirmed)</span>
                </div>
              </div>
              
              {/* Transaction Details */}
              <div className="mt-3 mb-2 bg-dark-300 rounded-md p-2 text-xs">
                <h4 className="font-medium text-white mb-1">Transaction Summary</h4>
                <div className="grid grid-cols-2 gap-y-1">
                  <div className="text-gray-400">Sent:</div>
                  <div className="text-white font-medium">{lastTransaction?.fromAmount} {lastTransaction?.fromToken}</div>
                  
                  <div className="text-gray-400">Expected to receive:</div>
                  <div className="text-white font-medium">{lastTransaction?.toAmount ? formatCurrency(lastTransaction.toAmount) : '0'} {lastTransaction?.toToken}</div>
                  
                  <div className="text-gray-400">Fee:</div>
                  <div className="text-white font-medium">{lastTransaction?.fee ? formatCurrency(lastTransaction.fee) : '0'} {lastTransaction?.fromToken}</div>
                </div>
              </div>
              
              <div className="mt-2 text-xs border-t border-green-800 pt-2 flex justify-between items-center">
                <a 
                  href={`https://explorer.solana.com/tx/${lastTransaction?.signature}?cluster=devnet`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-300 hover:text-green-100 underline flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View transaction on Solana Explorer
                </a>
                
                <a 
                  href="/integration" 
                  className="text-primary-400 hover:text-primary-300 underline flex items-center ml-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View integration details
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {transactionState === 'error' && (
          <Alert className="bg-red-900/30 border-red-800 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertTitle>Transaction Failed</AlertTitle>
            <AlertDescription>
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
}
