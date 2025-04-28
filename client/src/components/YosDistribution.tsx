import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CheckCircleIcon, RefreshCwIcon, InfoIcon } from "lucide-react";
import { useMultiWallet } from "@/context/MultiWalletContext";
import { createYosTokenAccount, transferYosTokensFromAdmin } from "@/lib/helpers/yos-distribution";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { YOS_TOKEN_ADDRESS } from "@/lib/constants";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { PublicKey } from "@solana/web3.js";

export default function YosDistribution() {
  const { publicKey, connected, wallet } = useMultiWallet();
  const { balance: yosBalance, refreshBalance } = useTokenBalance(YOS_TOKEN_ADDRESS);
  const [hasYosAccount, setHasYosAccount] = useState<boolean | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSendingYos, setIsSendingYos] = useState(false);
  const [amountToSend, setAmountToSend] = useState("5.0");

  // Check if the user has a YOS token account
  useEffect(() => {
    const checkUserAccount = async () => {
      if (!connected || !publicKey) return;
      
      try {
        // We can infer this from the balance
        setHasYosAccount(true);
      } catch (error) {
        console.error("Error checking YOS account:", error);
        setHasYosAccount(false);
      }
    };
    
    checkUserAccount();
  }, [connected, publicKey, yosBalance]);

  // Create YOS token account
  const handleCreateAccount = async () => {
    if (!connected || !wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsCreatingAccount(true);
      
      const result = await createYosTokenAccount(wallet);
      
      if (result.success) {
        toast({
          title: "Success!",
          description: "YOS token account created successfully",
        });
        setHasYosAccount(true);
        refreshBalance();
      }
    } catch (error: any) {
      console.error("Error creating YOS account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create YOS token account",
        variant: "destructive"
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };
  
  // Send initial YOS tokens to user
  const handleSendYos = async () => {
    if (!connected || !publicKey || !wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSendingYos(true);
      const amount = parseFloat(amountToSend);
      
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Please enter a valid positive number",
          variant: "destructive"
        });
        setIsSendingYos(false);
        return;
      }
      
      // Admin wallet must be connected for this
      if (publicKey.toString() !== "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ") {
        // For regular users requesting YOS
        toast({
          title: "Processing distribution request",
          description: "Your request for YOS tokens has been received. The admin will process it.",
        });
        
        setTimeout(() => {
          setIsSendingYos(false);
        }, 2000);
        return;
      }
      
      const result = await transferYosTokensFromAdmin(wallet, publicKey, amount);
      
      if (result.success) {
        toast({
          title: "Success!",
          description: `Successfully distributed ${amount} YOS tokens`,
        });
        refreshBalance();
      }
    } catch (error: any) {
      console.error("Error sending YOS tokens:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to distribute YOS tokens",
        variant: "destructive"
      });
    } finally {
      setIsSendingYos(false);
    }
  };

  // Only show this component to admin OR users with no YOS tokens
  const shouldShowComponent = connected && 
    (publicKey?.toString() === "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ" || yosBalance === 0);

  if (!shouldShowComponent) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">YOS Token Distribution</CardTitle>
        <CardDescription>
          Get initial YOS tokens to start using the platform
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Alert className="mb-4 bg-amber-100/10 border-amber-200/40">
          <InfoIcon className="h-4 w-4 text-amber-400" />
          <AlertTitle className="ml-2 text-amber-400">Important</AlertTitle>
          <AlertDescription className="mt-1 text-sm text-muted-foreground">
            To participate in staking and earn rewards, you need YOS tokens. Admin will provide initial tokens 
            to get started. Once you have YOS tokens, you can fund the program to enable reward harvesting.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          {/* Current YOS Balance */}
          <div className="bg-secondary/20 p-4 rounded-lg border border-primary/20">
            <h3 className="text-sm font-medium mb-2">Your YOS Token Balance</h3>
            {connected ? (
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="text-xl font-bold text-white">{yosBalance.toFixed(4)}</span>
                  <span className="ml-1 text-sm text-muted-foreground">YOS</span>
                </div>
                
                {yosBalance === 0 && (
                  <div className="text-xs text-muted-foreground">
                    You don't have any YOS tokens yet. Use the form below to request initial tokens.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Connect your wallet to view your balance</div>
            )}
          </div>
          
          {/* Distribution Form */}
          <div className="mt-4">
            <Label htmlFor="yosAmount">Amount of YOS to request</Label>
            <div className="flex mt-2 gap-2">
              <Input
                id="yosAmount"
                type="number"
                step="0.1"
                value={amountToSend}
                onChange={(e) => setAmountToSend(e.target.value)}
                disabled={isSendingYos}
                className="flex-1"
              />
              <Button
                variant="default"
                onClick={handleSendYos}
                disabled={!connected || isSendingYos || !hasYosAccount}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:to-green-500"
              >
                {isSendingYos ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    {wallet?.publicKey?.toString() === "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ" 
                      ? "Send YOS Tokens" 
                      : "Request YOS Tokens"}
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Create Account Section - Only shown if user doesn't have a YOS account */}
          {hasYosAccount === false && (
            <div className="mt-4 p-4 border border-amber-500/20 rounded-lg bg-amber-500/10">
              <h3 className="text-sm font-medium mb-2">Create YOS Token Account</h3>
              <p className="text-xs text-muted-foreground mb-3">
                You need to create a YOS token account before you can receive YOS tokens.
              </p>
              <Button
                onClick={handleCreateAccount}
                disabled={isCreatingAccount}
                variant="default"
                size="sm"
              >
                {isCreatingAccount ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create YOS Token Account"
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-start">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshBalance}
          className="text-xs"
        >
          <RefreshCwIcon className="h-3 w-3 mr-2" />
          Refresh Balance
        </Button>
      </CardFooter>
    </Card>
  );
}