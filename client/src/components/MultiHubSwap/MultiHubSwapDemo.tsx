import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownUp, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Transaction } from '@solana/web3.js';
import { sendTransaction } from '@/lib/transaction-helper';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { defaultTokens, type TokenInfo } from '@/lib/token-search-api';

interface MultiHubSwapDemoProps {
  onTokenChange?: (fromToken: TokenInfo, toToken: TokenInfo) => void;
}

export default function MultiHubSwapDemo({ onTokenChange }: MultiHubSwapDemoProps) {
  const { toast } = useToast();
  const { publicKey, connected } = useMultiWallet();
  const [fromToken, setFromToken] = useState<string>("SOL");
  const [toToken, setToToken] = useState<string>("YOT");
  const [fromAmount, setFromAmount] = useState<string>("1.0");
  const [toAmount, setToAmount] = useState<string>("10000");
  const [slippage, setSlippage] = useState<string>("1.0");
  const [isSwapLoading, setIsSwapLoading] = useState<boolean>(false);
  const [swapStatus, setSwapStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Find token objects for selected tokens
  const fromTokenObj = defaultTokens.find(t => t.symbol === fromToken) || defaultTokens[0];
  const toTokenObj = defaultTokens.find(t => t.symbol === toToken) || defaultTokens[1];

  // Calculate output amount when input changes
  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      // Simple price simulation
      let calculatedAmount = parseFloat(fromAmount);
      
      if (fromToken === "SOL" && toToken === "YOT") {
        // 1 SOL ≈ 10,000 YOT
        calculatedAmount = calculatedAmount * 10000;
      } else if (fromToken === "YOT" && toToken === "SOL") {
        // 10,000 YOT ≈ 1 SOL
        calculatedAmount = calculatedAmount / 10000;
      } else if (fromToken === "USDC" && toToken === "YOT") {
        // 1 USDC ≈ 100 YOT
        calculatedAmount = calculatedAmount * 100;
      } else if (fromToken === "YOT" && toToken === "USDC") {
        // 100 YOT ≈ 1 USDC
        calculatedAmount = calculatedAmount / 100;
      } else if (fromToken === "YOS" && toToken === "YOT") {
        // 1 YOS ≈ 2 YOT
        calculatedAmount = calculatedAmount * 2;
      } else if (fromToken === "YOT" && toToken === "YOS") {
        // 2 YOT ≈ 1 YOS
        calculatedAmount = calculatedAmount / 2;
      }
      
      setToAmount(calculatedAmount.toFixed(6));
    }
  }, [fromAmount, fromToken, toToken]);

  // Notify parent about token selection changes for chart updates
  useEffect(() => {
    if (onTokenChange && fromTokenObj && toTokenObj) {
      onTokenChange(fromTokenObj, toTokenObj);
    }
  }, [fromToken, toToken, onTokenChange, fromTokenObj, toTokenObj]);

  // Swap tokens handler
  const handleSwapTokens = () => {
    // Swap from and to tokens
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    
    // Also swap amounts
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // Function to handle the swap action
  const handleSwap = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to perform a swap.",
        variant: "destructive"
      });
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to swap.",
        variant: "destructive"
      });
      return;
    }

    setIsSwapLoading(true);
    setSwapStatus("loading");

    try {
      // In a real implementation, this would be a swap transaction
      const transaction = new Transaction();
      
      // In maintenance mode this will return a simulated signature
      const signature = await sendTransaction(window.phantom?.solana || null, transaction);
      
      // Simulate a successful swap
      setTimeout(() => {
        setIsSwapLoading(false);
        setSwapStatus("success");
        
        toast({
          title: "Swap Successful (Simulated)",
          description: `Successfully swapped ${fromAmount} ${fromToken} to approximately ${toAmount} ${toToken}`,
          variant: "default"
        });
        
        // After 3 seconds, reset the status to idle
        setTimeout(() => {
          setSwapStatus("idle");
        }, 3000);
      }, 2000);
      
      console.log('Swap transaction (simulated)', { signature });

    } catch (error: any) {
      console.error("Swap failed:", error);
      
      setIsSwapLoading(false);
      setSwapStatus("error");
      
      toast({
        title: "Swap Failed",
        description: error.message || "There was an error processing your swap.",
        variant: "destructive"
      });
      
      // After 3 seconds, reset the status to idle
      setTimeout(() => {
        setSwapStatus("idle");
      }, 3000);
    }
  };

  return (
    <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
      <CardHeader className="bg-gradient-to-br from-[#1e2a45] to-[#0f1421] border-b border-[#1e2a45] pb-4">
        <CardTitle className="text-2xl font-bold text-white">
          Swap Tokens
        </CardTitle>
        <CardDescription className="text-[#a3accd]">
          Swap between any token and YOT with liquidity contribution and YOS cashback
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Maintenance Mode Notice */}
        <Alert className="mb-6 bg-amber-900/20 border-amber-700">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Maintenance Mode</AlertTitle>
          <AlertDescription>
            The swap functionality is currently in maintenance mode. Transactions will be simulated but not sent to the blockchain.
          </AlertDescription>
        </Alert>

        {/* From Token */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#a3accd]">From</label>
            <div className="text-xs text-[#a3accd]">
              Balance: {fromToken === "SOL" ? "1.234" : fromToken === "YOT" ? "157,685" : "0.00"} {fromToken}
            </div>
          </div>
          <div className="flex space-x-2">
            <Input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-grow bg-[#1a2338] border-[#252f4a] text-white"
            />
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger className="w-[140px] bg-[#1a2338] border-[#252f4a] text-white">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2338] border-[#252f4a] text-white">
                {defaultTokens.map(token => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <div className="flex items-center">
                      <span className="mr-2">{token.icon || '🪙'}</span>
                      <span>{token.symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Swap Button */}
        <div className="flex justify-center my-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleSwapTokens}
            className="rounded-full border-[#252f4a] hover:bg-[#1a2338]"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>
        
        {/* To Token */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#a3accd]">To (estimated)</label>
            <div className="text-xs text-[#a3accd]">
              Balance: {toToken === "SOL" ? "1.234" : toToken === "YOT" ? "157,685" : "0.00"} {toToken}
            </div>
          </div>
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="flex-grow bg-[#1a2338] border-[#252f4a] text-white"
            />
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger className="w-[140px] bg-[#1a2338] border-[#252f4a] text-white">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2338] border-[#252f4a] text-white">
                {defaultTokens.map(token => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <div className="flex items-center">
                      <span className="mr-2">{token.icon || '🪙'}</span>
                      <span>{token.symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Settings */}
        <div className="bg-[#1a2338] rounded-md p-4 mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Swap Settings</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#a3accd]">Slippage Tolerance</span>
              <div className="flex gap-1">
                <Button
                  variant={slippage === "0.5" ? "default" : "outline"} 
                  size="sm"
                  className="text-xs h-6 px-2 py-0"
                  onClick={() => setSlippage("0.5")}
                >
                  0.5%
                </Button>
                <Button
                  variant={slippage === "1.0" ? "default" : "outline"} 
                  size="sm"
                  className="text-xs h-6 px-2 py-0"
                  onClick={() => setSlippage("1.0")}
                >
                  1.0%
                </Button>
                <Button
                  variant={slippage === "2.0" ? "default" : "outline"} 
                  size="sm"
                  className="text-xs h-6 px-2 py-0"
                  onClick={() => setSlippage("2.0")}
                >
                  2.0%
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#a3accd]">Liquidity Contribution</span>
              <span className="text-xs text-green-400">20%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#a3accd]">YOS Cashback</span>
              <span className="text-xs text-green-400">5%</span>
            </div>
          </div>
        </div>
        
        {/* Swap Button */}
        <Button 
          className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90"
          onClick={handleSwap}
          disabled={isSwapLoading || !connected}
        >
          {isSwapLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
          {!connected && "Connect Wallet to Swap"}
          {connected && swapStatus === "idle" && "Swap Tokens"}
          {connected && swapStatus === "loading" && "Swapping..."}
          {connected && swapStatus === "success" && "Swap Successful"}
          {connected && swapStatus === "error" && "Swap Failed - Try Again"}
        </Button>
      </CardContent>
    </Card>
  );
}