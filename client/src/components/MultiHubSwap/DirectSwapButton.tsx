import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { twoPhaseSwap } from '@/lib/twoPhaseSwap';
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
      // Use two-phase swap for proper on-chain functionality
      console.log(`Performing two-phase swap of ${amountNum} SOL...`);
      const result = await twoPhaseSwap(wallet, amountNum);
      
      if (result.success) {
        toast({
          title: "Smart Contract Swap Complete!",
          description: (
            <div className="flex flex-col gap-1">
              <p>SOL swapped successfully via smart contract!</p>
              <a 
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View on Explorer
              </a>
              <p className="text-green-500 mt-2">
                The swap was processed entirely on-chain with 80% to you, 20% to liquidity, and 5% YOS cashback.
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
          Smart Contract Swap
        </>
      )}
    </Button>
  );
}