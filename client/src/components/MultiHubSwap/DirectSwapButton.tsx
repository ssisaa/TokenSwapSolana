import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { directSwap, createLiquidityAccountOnly } from '@/lib/directSwap';
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
      // First create liquidity account if needed (non-blocking)
      try {
        console.log("Creating liquidity account (if needed)...");
        await createLiquidityAccountOnly(wallet);
      } catch (error) {
        // If this fails, we still try the direct swap
        console.error("Error creating liquidity account:", error);
      }
      
      // Then do the direct swap
      console.log(`Performing direct swap of ${amountNum} SOL...`);
      const result = await directSwap(wallet, amountNum);
      
      if (result.success) {
        toast({
          title: "Direct swap successful!",
          description: (
            <div className="flex flex-col gap-1">
              <p>SOL sent successfully to the pool.</p>
              <a 
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View on Explorer
              </a>
              <p className="text-amber-500 mt-2">
                Note: YOT tokens must be claimed separately from admin - please contact them.
              </p>
            </div>
          ),
        });
      } else {
        toast({
          title: "Swap failed",
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