import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLiquidityContributionPda } from "@/lib/twoPhaseSwap";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Component that checks and creates a liquidity contribution account
 * This addresses the "account already borrowed" error in Solana SOL-YOT transactions
 */
export function LiquidityAccountChecker() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { toast } = useToast();
  
  const [isChecking, setIsChecking] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  useEffect(() => {
    if (wallet.publicKey) {
      checkAccount();
    } else {
      setAccountExists(false);
    }
  }, [wallet.publicKey]);
  
  // Check if the liquidity contribution account exists
  async function checkAccount() {
    if (!wallet.publicKey) return;
    
    setIsChecking(true);
    try {
      const liquidityPda = getLiquidityContributionPda(wallet.publicKey);
      const accountInfo = await connection.getAccountInfo(liquidityPda);
      setAccountExists(accountInfo !== null);
    } catch (error) {
      console.error('Error checking liquidity account:', error);
    } finally {
      setIsChecking(false);
    }
  }
  
  // Create the liquidity contribution account
  async function createLiquidityAccount() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      // Import only when needed to avoid circular dependencies
      const { twoPhaseSwap } = await import("@/lib/twoPhaseSwap");
      
      // Call the first phase of twoPhaseSwap which creates the account
      const result = await twoPhaseSwap(wallet, 0.0001); // Minimal amount just to create account
      
      if (result.success) {
        toast({
          title: "Account created",
          description: "Liquidity contribution account created successfully",
          variant: "default"
        });
        
        // Verify that the account was created
        await checkAccount();
      } else {
        toast({
          title: "Account creation failed",
          description: result.error || "Unknown error",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error creating account",
        description: error.message || "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  }
  
  // Don't render anything if no wallet is connected
  if (!wallet.publicKey) {
    return null;
  }
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Liquidity Contribution Account</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : accountExists ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm">
              {isChecking 
                ? "Checking account..." 
                : accountExists 
                  ? "Account ready" 
                  : "Account setup required"}
            </span>
          </div>
          
          {!accountExists && !isChecking && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={createLiquidityAccount} 
              disabled={isCreating}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? "Creating..." : "Setup"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}