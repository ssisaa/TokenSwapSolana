import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { swapSolToYot } from '@/lib/simplifiedSwap';
import { ArrowDownUp, CheckCircle2, RefreshCw, Wallet } from 'lucide-react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Connection } from '@solana/web3.js';
import { 
  SOLANA_NETWORK, 
  getRpcEndpoint, 
  DEFAULT_SLIPPAGE_PERCENTAGE,
  YOT_DISTRIBUTION_RATIO,
  YOS_CASHBACK_PERCENTAGE,
  SOL_DISTRIBUTION_RATIO
} from '@/lib/configConstants';

interface SimplifiedSwapButtonProps {
  solAmount: number;
  estimatedYotAmount: number;
  slippagePercentage?: number;
  disabled?: boolean;
  onSuccess?: (signature: string) => void;
  onError?: (error: any) => void;
}

const SimplifiedSwapButton = ({
  solAmount,
  estimatedYotAmount,
  slippagePercentage = DEFAULT_SLIPPAGE_PERCENTAGE,
  disabled = false,
  onSuccess,
  onError,
}: SimplifiedSwapButtonProps) => {
  const { wallet, publicKey, connected, connecting, setShowWalletSelector } = useMultiWallet();
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
        description: `Swapping ${solAmount} SOL for at least ${minYotAmount} YOT (${slippagePercentage}% slippage).
${SOL_DISTRIBUTION_RATIO}% of SOL goes to pool, ${YOT_DISTRIBUTION_RATIO}% of YOT goes to you, with ${YOS_CASHBACK_PERCENTAGE}% YOS cashback.`,
      });

      // Create connection to Solana devnet using our configured endpoint
      const connection = new Connection(getRpcEndpoint(), 'confirmed');

      // Show a warning about missing accounts if the operation fails
      const warningToastId = 'missing-accounts-warning';
      
      let swapSignature = '';
      try {
        // Execute the swap
        swapSignature = await swapSolToYot(
          wallet,
          solAmount,
          minYotAmount,
          connection
        );
        
        // Continue with success path
      } catch (error: any) {
        // Check if this is a token account error
        if (error.message && (
          error.message.includes('missing token account') || 
          error.message.includes('invalid account data') ||
          error.message.includes('Common wallet') ||
          error.message.includes('account may be missing'))) {
          
          // Show a more specific error message with guidance
          toast({
            title: 'Token Account Missing',
            description: "This transaction requires token accounts that need to be created by the admin. Please use the Admin Tools to create all required token accounts before trying again.",
            variant: 'destructive',
            duration: 10000 // Show for longer
          });
          throw error;
        }
        throw error;
      }

      // Show success message
      toast({
        title: 'Swap successful!',
        description: (
          <div className="flex flex-col space-y-1">
            <span>Swapped {solAmount} SOL for YOT</span>
            <span className="text-sm text-muted-foreground">{YOT_DISTRIBUTION_RATIO}% of YOT to you, {100-YOT_DISTRIBUTION_RATIO}% to common wallet</span>
            <span className="text-sm text-green-600">+{YOS_CASHBACK_PERCENTAGE}% YOS cashback reward</span>
            <a 
              href={`https://explorer.solana.com/tx/${swapSignature}?cluster=${SOLANA_NETWORK}`} 
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
      if (onSuccess) onSuccess(swapSignature);

      // Reset the button after 3 seconds
      setTimeout(() => {
        setSwapComplete(false);
      }, 3000);
    } catch (error: unknown) {
      console.error('Swap error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Prepare a more user-friendly error message
      let userFriendlyMessage = errorMessage;
      let errorTitle = 'Swap failed';
      
      // Check for specific error types we know about and provide friendly messages
      if (errorMessage.includes('invalid account data')) {
        userFriendlyMessage = 'There was a problem with one of the token accounts needed for the swap. The system will try to create these accounts automatically.';
        errorTitle = 'Account error';
      } else if (errorMessage.includes('insufficient funds')) {
        userFriendlyMessage = 'You don\'t have enough SOL to complete this transaction. Make sure you have enough SOL for both the swap amount and transaction fees.';
        errorTitle = 'Insufficient funds';
      } else if (errorMessage.includes('User rejected')) {
        userFriendlyMessage = 'You cancelled the transaction in your wallet.';
        errorTitle = 'Transaction cancelled';
      } else if (errorMessage.includes('Transaction simulation failed')) {
        // Clean up simulation errors for better display
        userFriendlyMessage = 'The transaction couldn\'t be processed. This might be because of network congestion or an issue with the Solana program.';
        if (errorMessage.includes('Account validation error')) {
          userFriendlyMessage = 'One of the required token accounts may not exist. The system will try to create these accounts for you automatically.';
        }
        errorTitle = 'Transaction error';
      }
      
      toast({
        title: errorTitle,
        description: userFriendlyMessage,
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
  
  // Handle the wallet connection or swap based on the current connection state
  const handleClick = async () => {
    if (!connected) {
      // Use MultiWalletContext's method to show the wallet selector modal
      try {
        // Show the wallet selector modal
        setShowWalletSelector(true);
        
        toast({
          title: "Select Wallet",
          description: "Please select and connect a wallet to continue",
          variant: "default",
          duration: 3000,
        });
      } catch (error) {
        console.error("Error showing wallet selector:", error);
        toast({
          title: "Wallet Connection",
          description: error instanceof Error ? error.message : "Failed to open wallet selector",
          variant: "destructive",
        });
      }
    } else {
      handleSwap();
    }
  };

  if (loading) {
    buttonText = 'Processing Swap...';
    buttonIcon = <RefreshCw className="w-4 h-4 mr-2 animate-spin" />;
  } else if (swapComplete) {
    buttonText = 'Swap Complete';
    buttonIcon = <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />;
  } else if (!connected) {
    buttonText = 'Connect Wallet to Swap';
    buttonIcon = <Wallet className="w-4 h-4 mr-2" />;
  }

  return (
    <Button
      className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
      onClick={handleClick}
      disabled={disabled || loading || swapComplete || connecting || (connected && solAmount <= 0)}
    >
      {buttonIcon}
      {buttonText}
    </Button>
  );
};

export default SimplifiedSwapButton;