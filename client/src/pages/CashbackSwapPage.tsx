import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useSwap } from "@/hooks/useSwap";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRightLeft, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { SOL_SYMBOL, YOT_SYMBOL } from "@/lib/constants";

export default function CashbackSwapPage() {
  const { connected, connect } = useWallet();
  const swap = useSwap();
  
  // Local state for UI enhancements
  const [isCashbackTooltipOpen, setIsCashbackTooltipOpen] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("0");
  
  // Calculate cashback amount (5% of transaction)
  useEffect(() => {
    if (swap.toAmount && typeof swap.toAmount === 'number') {
      const cashback = swap.toAmount * 0.05; // 5% cashback
      setCashbackAmount(cashback.toFixed(6));
    } else {
      setCashbackAmount("0");
    }
  }, [swap.toAmount]);
  
  const handleExecuteSwap = async () => {
    try {
      await swap.executeSwap();
      setSwapSuccess(true);
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSwapSuccess(false);
      }, 5000);
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };
  
  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Cashback Swap
        </h1>
        <p className="text-muted-foreground mt-2">
          Swap tokens with 5% cashback in YOS tokens
        </p>
      </div>
      
      <Card className="border-2 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ArrowRightLeft className="h-5 w-5 mr-2" />
            <span>Swap with Cashback</span>
            <Badge variant="secondary" className="ml-auto flex items-center gap-1">
              <Percent className="h-3 w-3" />
              5% YOS Cashback
            </Badge>
          </CardTitle>
          <CardDescription>
            Get instant 5% cashback in YOS tokens on all your swaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connected ? (
            <div className="flex flex-col items-center justify-center p-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-center mb-4">Connect your wallet to start swapping with cashback</p>
              <Button onClick={connect} size="lg">
                Connect Wallet
              </Button>
            </div>
          ) : (
            <>
              {/* From Token Section */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>From</span>
                  <span>
                    Balance: {swap.fromBalance > 0 
                      ? formatCurrency(swap.fromBalance, 4) 
                      : "0"} {swap.fromToken}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={swap.fromAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        swap.setFromAmount(value);
                        if (value && !isNaN(parseFloat(value))) {
                          swap.calculateToAmount(parseFloat(value));
                        } else {
                          swap.setToAmount("");
                        }
                      }}
                      className="text-right text-lg"
                    />
                  </div>
                  
                  <Select
                    value={swap.fromToken}
                    onValueChange={(value) => {
                      swap.setFromToken(value);
                      if (swap.toToken === value) {
                        swap.setToToken(swap.fromToken);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SOL_SYMBOL}>SOL</SelectItem>
                      <SelectItem value={YOT_SYMBOL}>YOT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Switch Button */}
              <div className="flex justify-center my-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={swap.switchTokens}
                  className="rounded-full h-8 w-8 bg-muted"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>
              
              {/* To Token Section */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>To</span>
                  <span>
                    Balance: {swap.toBalance > 0 
                      ? formatCurrency(swap.toBalance, 4) 
                      : "0"} {swap.toToken}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={swap.toAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        swap.setToAmount(value);
                        if (value && !isNaN(parseFloat(value))) {
                          swap.calculateFromAmount(parseFloat(value));
                        } else {
                          swap.setFromAmount("");
                        }
                      }}
                      className="text-right text-lg"
                    />
                  </div>
                  
                  <Select
                    value={swap.toToken}
                    onValueChange={(value) => {
                      swap.setToToken(value);
                      if (swap.fromToken === value) {
                        swap.setFromToken(swap.toToken);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SOL_SYMBOL}>SOL</SelectItem>
                      <SelectItem value={YOT_SYMBOL}>YOT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Exchange Rate Display */}
              <div className="text-sm text-muted-foreground mt-2 mb-4">
                Rate: {swap.exchangeRate}
              </div>
              
              <Separator className="my-4" />
              
              {/* Cashback Information */}
              <div className="bg-secondary/30 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Percent className="h-4 w-4 mr-2 text-primary" />
                    <span className="font-medium">Cashback Reward</span>
                  </div>
                  <span className="text-primary font-medium">{cashbackAmount} YOS</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  5% of your swap amount will be automatically sent to your wallet as YOS tokens
                </p>
              </div>
              
              {/* Success Message */}
              {swapSuccess && (
                <Alert className="mb-4 bg-green-500/10 text-green-500 border-green-500/20">
                  <AlertDescription className="flex items-center">
                    Swap completed successfully! Cashback has been sent to your wallet.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Swap Button */}
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                size="lg"
                disabled={!swap.fromAmount || swap.isPending || parseFloat(String(swap.fromAmount)) <= 0}
                onClick={handleExecuteSwap}
              >
                {swap.isPending ? "Processing..." : "Swap with 5% Cashback"}
              </Button>
              
              {/* Error Display */}
              {swap.error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertDescription>
                    {swap.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}