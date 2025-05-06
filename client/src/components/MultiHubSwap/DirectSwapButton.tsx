import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { directSwap } from '@/lib/directSwap';
import { Shield, Loader2 } from 'lucide-react';

interface DirectSwapButtonProps {
  wallet: any;
  amount: string;
  disabled?: boolean;
}

export function DirectSwapButton({ wallet, amount, disabled }: DirectSwapButtonProps) {
  const [isSwapping, setIsSwapping] = useState(false);
  const { toast } = useToast();
  
  const handleDirectSwap = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to perform this action",
        variant: "destructive"
      });
      return;
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid SOL amount",
        variant: "destructive"
      });
      return;
    }
    
    setIsSwapping(true);
    
    try {
      // Skip the liquidity account creation entirely and just do the direct SOL transfer
      console.log(`Performing direct SOL transfer of ${amountNum} SOL...`);
      const result = await directSwap(wallet, amountNum);
      
      if (result.success) {
        toast({
          title: "Direct SOL transfer successful!",
          description: (
            <div className="flex flex-col gap-1">
              <p>SOL sent successfully to the pool!</p>
              <a 
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View on Explorer
              </a>
              <p className="text-amber-500 mt-2">
                Note: The admin will manually distribute YOT tokens to your wallet. 
                This direct transfer method bypasses the on-chain swap to avoid simulation errors.
              </p>
            </div>
          ),
        });
      } else {
        toast({
          title: "Transfer failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error performing swap",
        description: error.message || "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSwapping(false);
    }
  };
  
  return (
    <Button
      className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white mt-2"
      disabled={isSwapping || disabled}
      onClick={handleDirectSwap}
      variant="outline"
    >
      {isSwapping ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Shield className="mr-2 h-4 w-4" />
          Direct SOL Transfer
        </>
      )}
    </Button>
  );
}