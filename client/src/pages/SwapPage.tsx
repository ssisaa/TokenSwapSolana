import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMultiWallet } from "@/context/MultiWalletContext";
import { ArrowDownUp, RefreshCw, Info, AlertCircle, Check } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Transaction } from "@solana/web3.js";
import { sendTransaction } from "@/lib/transaction-helper";

export default function SwapPage() {
  const { toast } = useToast();
  const { publicKey, connected } = useMultiWallet();
  const [fromToken, setFromToken] = useState("SOL");
  const [toToken, setToToken] = useState("YOT");
  const [fromAmount, setFromAmount] = useState("1.0");
  const [toAmount, setToAmount] = useState("0");
  const [slippage, setSlippage] = useState("1.0");
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [liquidityContribution, setLiquidityContribution] = useState("20%");
  const [cashbackReward, setCashbackReward] = useState("5%");

  // Token options
  const tokenOptions = [
    { value: "SOL", label: "SOL", icon: "🌟" },
    { value: "YOT", label: "YOT", icon: "🪙" },
    { value: "USDC", label: "USDC", icon: "💵" },
    { value: "YOS", label: "YOS", icon: "🌱" },
  ];

  // Simulate price calculation
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

  // Token swap handler
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
      // Create a dummy transaction - in a real implementation, this would be a swap transaction
      const transaction = new Transaction();
      
      // In maintenance mode this will return a simulated signature
      const signature = await sendTransaction(window.xnft?.solana || null, transaction);
      
      // Simulate a successful swap
      setTimeout(() => {
        setIsSwapLoading(false);
        setSwapStatus("success");
        
        toast({
          title: "Swap Successful",
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
    <div className="container max-w-4xl mx-auto py-8">
      <h2 className="text-3xl font-bold text-white mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
        Multi-Hub Swap
      </h2>
      
      <Card className="bg-[#161b2b] border-[#232e47] shadow-lg">
        <CardHeader>
          <CardTitle className="text-white">Swap Tokens</CardTitle>
          <CardDescription>
            Swap between YOT and any other token with automatic liquidity contribution and cashback
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Maintenance Mode Notice */}
          <Alert className="mb-6 bg-amber-900/20 border-amber-700">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-500">Maintenance Mode</AlertTitle>
            <AlertDescription>
              The swap functionality is currently in maintenance mode. Transactions will be simulated but not sent to the blockchain.
            </AlertDescription>
          </Alert>

          {/* From Token */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">From</label>
              <div className="text-xs text-gray-500">
                Balance: {fromToken === "SOL" ? "1.234" : fromToken === "YOT" ? "157,685" : "0.00"} {fromToken}
              </div>
            </div>
            <div className="flex space-x-2">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="flex-grow bg-[#1e2a45] border-[#232e47]"
              />
              <Select value={fromToken} onValueChange={setFromToken}>
                <SelectTrigger className="w-[140px] bg-[#1e2a45] border-[#232e47]">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2a45] border-[#232e47]">
                  {tokenOptions.map(token => (
                    <SelectItem key={token.value} value={token.value}>
                      <div className="flex items-center">
                        <span className="mr-2">{token.icon}</span>
                        <span>{token.label}</span>
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
              className="rounded-full border-[#232e47] hover:bg-[#1e2a45]"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>
          
          {/* To Token */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">To (estimated)</label>
              <div className="text-xs text-gray-500">
                Balance: {toToken === "SOL" ? "1.234" : toToken === "YOT" ? "157,685" : "0.00"} {toToken}
              </div>
            </div>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="flex-grow bg-[#1e2a45] border-[#232e47]"
              />
              <Select value={toToken} onValueChange={setToToken}>
                <SelectTrigger className="w-[140px] bg-[#1e2a45] border-[#232e47]">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2a45] border-[#232e47]">
                  {tokenOptions.map(token => (
                    <SelectItem key={token.value} value={token.value}>
                      <div className="flex items-center">
                        <span className="mr-2">{token.icon}</span>
                        <span>{token.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Settings Section */}
          <div className="rounded-md bg-[#1a2236] p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Swap Settings</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Slippage Tolerance</span>
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
                <span className="text-xs text-gray-400">Liquidity Contribution</span>
                <span className="text-xs text-green-400">{liquidityContribution}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">YOS Cashback</span>
                <span className="text-xs text-green-400">{cashbackReward}</span>
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
            {connected && swapStatus === "success" && (
              <>
                <Check className="mr-2 h-4 w-4" />
                Swap Successful
              </>
            )}
            {connected && swapStatus === "error" && "Swap Failed - Try Again"}
          </Button>
          
          {/* Info Section */}
          <div className="mt-6 text-xs text-gray-500 space-y-2">
            <div className="flex items-center justify-between">
              <span>Rate</span>
              <span>
                1 {fromToken} ≈ {fromToken === "SOL" && toToken === "YOT" ? "10,000" : 
                  fromToken === "YOT" && toToken === "SOL" ? "0.0001" : 
                  fromToken === "USDC" && toToken === "YOT" ? "100" : 
                  fromToken === "YOT" && toToken === "USDC" ? "0.01" : "1"} {toToken}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Minimum Received</span>
              <span>{(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Network Fee</span>
              <span>~ 0.000005 SOL</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Additional Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="bg-[#161b2b] border-[#232e47] shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white">Liquidity Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400">
              20% of each swap is automatically contributed to the SOL-YOT liquidity pool, 
              helping increase market depth and reduce price impact for all traders.
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161b2b] border-[#232e47] shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white">YOS Cashback Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400">
              Receive 5% cashback in YOS tokens on every swap. YOS tokens can be staked 
              to earn even more rewards, or used for governance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}