import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { executeSimplifiedSwap } from '@/lib/simplifiedSwapClient';
import { initializeSimplifiedSwap } from '@/lib/simplifiedSwapClient'; 
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Connection } from '@solana/web3.js';

interface SimplifiedSwapButtonProps {
  wallet: any;
  solAmount: number;
  isAdmin?: boolean;
  onSuccess?: (signature: string) => void;
  onError?: (error: any) => void;
}

export function SimplifiedSwapButton({
  wallet,
  solAmount,
  isAdmin = false,
  onSuccess,
  onError
}: SimplifiedSwapButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSwap = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to perform a swap.",
        variant: "destructive"
      });
      return;
    }
    
    if (solAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount of SOL to swap.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await executeSimplifiedSwap(wallet, solAmount);
      
      if (result.success) {
        toast({
          title: "Swap Successful",
          description: `Successfully swapped ${solAmount} SOL for YOT tokens.`,
        });
        
        if (onSuccess) {
          onSuccess(result.signature);
        }
      } else {
        throw result.error;
      }
    } catch (error) {
      console.error("Swap error:", error);
      
      toast({
        title: "Swap Failed",
        description: error.message || "There was an error performing the swap.",
        variant: "destructive"
      });
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInit = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to initialize the program.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
      const signature = await initializeSimplifiedSwap(wallet, connection);
      
      toast({
        title: "Initialization Successful",
        description: "The simplified swap program has been initialized.",
      });
      
      if (onSuccess) {
        onSuccess(signature);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      
      toast({
        title: "Initialization Failed",
        description: error.message || "There was an error initializing the program.",
        variant: "destructive"
      });
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isAdmin && (
        <Button 
          onClick={handleInit} 
          disabled={isLoading || !wallet}
          variant="outline"
          className="w-full mb-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : (
            "Initialize Simplified Swap Program"
          )}
        </Button>
      )}
      
      <Button 
        onClick={handleSwap} 
        disabled={isLoading || !wallet || solAmount <= 0}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Simplified Swap: ${solAmount} SOL → YOT`
        )}
      </Button>
    </>
  );
}