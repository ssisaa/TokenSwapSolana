import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { swapSolToYot } from '@/lib/simplifiedSwap';
import { ArrowDownUp, CheckCircle2, RefreshCw } from 'lucide-react';
import { Connection, clusterApiUrl } from '@solana/web3.js';

interface SimplifiedSwapButtonProps {
  solAmount: number;
  estimatedYotAmount: number;
  slippagePercentage?: number;
  onSuccess?: (signature: string) => void;
  onError?: (error: any) => void;
}

const SimplifiedSwapButton = ({
  solAmount,
  estimatedYotAmount,
  slippagePercentage = 5,
  onSuccess,
  onError,
}: SimplifiedSwapButtonProps) => {
  const { wallet, publicKey, connected, connecting } = useWallet();
  const [loading, setLoading] = useState(false);
  const [swapComplete, setSwapComplete] = useState(false);
  const { toast } = useToast();

  // Calculate minimum YOT amount based on slippage
  const minYotAmount = Math.floor(estimatedYotAmount * (1 - slippagePercentage / 100));

  const handleSwap = async () => {
    if (!connected || !publicKey || !wallet) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to continue',
        variant: 'destructive',
      });
      return;
    }

    if (solAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid SOL amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      toast({
        title: 'Processing swap',
        description: `Swapping ${solAmount} SOL for at least ${minYotAmount} YOT (${slippagePercentage}% slippage)`,
      });

      // Create connection to Solana devnet
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

      // Execute the swap
      const signature = await swapSolToYot(
        wallet,
        solAmount,
        minYotAmount,
        connection
      );

      // Show success message
      toast({
        title: 'Swap successful!',
        description: (
          <div className="flex flex-col">
            <span>Swapped {solAmount} SOL for YOT with 5% YOS cashback</span>
            <a 
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline text-sm mt-1"
            >
              View on Solana Explorer
            </a>
          </div>
        ),
        variant: 'default',
      });

      setSwapComplete(true);
      if (onSuccess) onSuccess(signature);

      // Reset the button after 3 seconds
      setTimeout(() => {
        setSwapComplete(false);
      }, 3000);
    } catch (error) {
      console.error('Swap error:', error);
      toast({
        title: 'Swap failed',
        description: `Error: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  // Determine button state and text
  let buttonText = 'Swap SOL to YOT';
  let buttonIcon = <ArrowDownUp className="w-4 h-4 mr-2" />;

  if (loading) {
    buttonText = 'Processing Swap...';
    buttonIcon = <RefreshCw className="w-4 h-4 mr-2 animate-spin" />;
  } else if (swapComplete) {
    buttonText = 'Swap Complete';
    buttonIcon = <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />;
  } else if (!connected) {
    buttonText = 'Connect Wallet to Swap';
  }

  return (
    <Button
      className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
      onClick={handleSwap}
      disabled={loading || swapComplete || !connected || connecting || solAmount <= 0}
    >
      {buttonIcon}
      {buttonText}
    </Button>
  );
};

export default SimplifiedSwapButton;