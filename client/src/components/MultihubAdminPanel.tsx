import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, RefreshCw } from "lucide-react";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useToast } from "@/hooks/use-toast";

// Import multihub client
import * as multiHubClient from "@/lib/multihub-client-safe";

export function MultihubAdminPanel() {
  const { wallet, connected, connect } = useWallet();
  const { toast } = useToast();
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [initSuccess, setInitSuccess] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string>("");
  
  // Initialize the MultiHub Swap Program
  const handleInitialize = async () => {
    if (!wallet || !connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsInitializing(true);
      setInitSuccess(false);
      setInitError(null);
      
      // Show toast for initialization starting
      toast({
        title: "Initializing MultiHub Swap Program",
        description: "Please approve the transaction in your wallet.",
      });
      
      // Call the initialization function from our client
      const signature = await multiHubClient.initializeProgram(wallet);
      
      setTransactionSignature(signature);
      setInitSuccess(true);
      
      // Show success toast
      toast({
        title: "Program Initialized Successfully",
        description: (
          <div>
            <p>The MultiHub Swap Program has been initialized.</p>
            <a 
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View on Solana Explorer
            </a>
          </div>
        ),
        variant: "default",
      });
    } catch (error: any) {
      console.error("Program initialization failed:", error);
      setInitError(error);
      
      // Show error toast
      toast({
        title: "Initialization Failed",
        description: error.message || "Failed to initialize the program. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto bg-gradient-to-br from-amber-500/5 to-amber-700/10 border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-amber-700">
          MultiHub Swap Program Admin
        </CardTitle>
        <CardDescription>
          Initialize and manage the MultiHub Swap Program
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!connected && (
          <div className="mb-4">
            <Button onClick={() => connect("Phantom")} variant="default">
              Connect Wallet
            </Button>
          </div>
        )}
        
        {initSuccess && (
          <Alert className="mb-4 bg-green-50 border-green-200 text-green-700">
            <Check className="h-5 w-5" />
            <AlertTitle>Program Initialized Successfully</AlertTitle>
            <AlertDescription>
              The MultiHub Swap Program has been initialized and is ready to use.
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
        
        {initError && (
          <Alert className="mb-4 bg-red-50 border-red-200 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Initialization Failed</AlertTitle>
            <AlertDescription>
              {initError.message || "There was an error initializing the program."}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <div className="bg-black/10 p-4 rounded-md">
            <h3 className="font-medium mb-2">Program Initialization</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Initialize the MultiHub Swap Program on the Solana devnet. This is required before any swaps can be executed.
              Only the admin wallet can perform this action.
            </p>
            
            <Button 
              onClick={handleInitialize} 
              disabled={isInitializing || !connected}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isInitializing ? (
                <div className="flex items-center">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </div>
              ) : "Initialize Program"}
            </Button>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="text-xs text-muted-foreground border-t border-border/40 pt-4">
        Admin actions can only be performed by authorized wallets. Program ID: Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L
      </CardFooter>
    </Card>
  );
}

export default MultihubAdminPanel;