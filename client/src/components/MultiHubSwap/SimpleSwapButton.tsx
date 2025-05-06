import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { executeSimpleSwap } from '@/lib/simpleSwap';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { YOT_MINT } from '@/lib/config';

interface SimpleSwapButtonProps {
  wallet: any;
  solAmount: number;
  onSuccess?: (signature: string) => void;
  onError?: (error: any) => void;
  onTokenAccountNeeded?: () => void;
}

export function SimpleSwapButton({
  wallet,
  solAmount,
  onSuccess,
  onError,
  onTokenAccountNeeded
}: SimpleSwapButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Function to create token account if needed
  const createTokenAccount = async (
    userYotAccount: PublicKey,
    yotMint: PublicKey
  ) => {
    try {
      const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
      
      // Create the instruction
      const createAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        userYotAccount, // associated token account to create
        wallet.publicKey, // owner of the new account
        yotMint // token mint
      );
      
      // Create and send the transaction
      const transaction = new Transaction().add(createAccountIx);
      transaction.feePayer = wallet.publicKey;
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      const signature = await wallet.sendTransaction(transaction, connection);
      
      toast({
        title: "Token Account Created",
        description: "Your YOT token account was created successfully. You can now complete the swap.",
      });
      
      return signature;
    } catch (error) {
      console.error("Error creating token account:", error);
      toast({
        title: "Error Creating Token Account",
        description: "There was an error creating your YOT token account.",
        variant: "destructive"
      });
      throw error;
    }
  };

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
      const result = await executeSimpleSwap(wallet, solAmount);
      
      // Handle token account creation if needed
      if (result.needsTokenAccount) {
        toast({
          title: "Token Account Needed",
          description: "You need a YOT token account to receive tokens. Creating one now...",
        });
        
        if (onTokenAccountNeeded) {
          onTokenAccountNeeded();
        }
        
        await createTokenAccount(result.userYotAccount, result.yotMint);
        
        // Try swap again after creating token account
        const retryResult = await executeSimpleSwap(wallet, solAmount);
        
        if (retryResult.success) {
          toast({
            title: "Swap Successful",
            description: `Successfully swapped ${solAmount} SOL for YOT tokens.`,
          });
          
          if (onSuccess) {
            onSuccess(retryResult.signature);
          }
        } else {
          throw retryResult.error;
        }
      } else if (result.success) {
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

  return (
    <Button 
      onClick={handleSwap} 
      disabled={isLoading || !wallet || solAmount <= 0}
      className="w-full mt-4"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        `Swap ${solAmount} SOL → YOT`
      )}
    </Button>
  );
}