import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MultihubIntegrationV3 } from '@/lib/multihub-integration-v3';
import { fundProgramAuthority } from '@/lib/multihub-contract-v3';
import { Loader2 } from 'lucide-react';
import MultihubV3DebugPanel from './MultihubV3DebugPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Connection, clusterApiUrl } from '@solana/web3.js';

interface MultihubV3AdminActionsProps {
  wallet: any;
}

export function MultihubV3AdminActions({ wallet }: MultihubV3AdminActionsProps) {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("0.05");
  
  const handleInitialize = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsInitializing(true);
      
      // Check if wallet address matches expected admin wallet
      const adminWalletAddress = "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ";
      const currentWalletAddress = wallet.publicKey.toString();
      
      if (currentWalletAddress !== adminWalletAddress) {
        toast({
          title: 'Admin Wallet Required',
          description: `Please connect with the admin wallet (${adminWalletAddress.slice(0, 6)}...${adminWalletAddress.slice(-6)})`,
          variant: 'destructive',
        });
        setIsInitializing(false);
        return;
      }
      
      toast({
        title: 'Preparing Transaction',
        description: 'Please approve the transaction in your wallet...',
      });
      
      const signature = await MultihubIntegrationV3.initializeMultihubSwapV3(wallet);
      
      toast({
        title: 'Program Initialized Successfully',
        description: `Transaction signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      
      // Link to Solana Explorer
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      window.open(explorerUrl, '_blank');
      
    } catch (error: any) {
      console.error('Failed to initialize program:', error);
      
      // Extract meaningful error message
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Transaction simulation failed')) {
        errorMessage = 'Transaction simulation failed. The program may already be initialized.';
      } else if (errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by the user.';
      }
      
      toast({
        title: 'Failed to initialize program',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
    }
  };
  
  const handleFundAuthority = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsFunding(true);
      
      // Convert input value to number
      const amountToSend = parseFloat(fundAmount);
      
      // Validate amount
      if (isNaN(amountToSend) || amountToSend <= 0) {
        toast({
          title: 'Invalid amount',
          description: 'Please enter a valid SOL amount greater than 0.',
          variant: 'destructive',
        });
        setIsFunding(false);
        return;
      }
      
      toast({
        title: 'Preparing Transaction',
        description: 'Please approve the transaction in your wallet...',
      });
      
      // Create a Solana connection to the devnet
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      
      // Fund the program authority account
      const signature = await fundProgramAuthority(
        connection,
        wallet,
        amountToSend
      );
      
      toast({
        title: 'Program Authority Funded Successfully',
        description: `Sent ${amountToSend} SOL to program authority. Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      
      // Link to Solana Explorer
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      window.open(explorerUrl, '_blank');
      
    } catch (error: any) {
      console.error('Failed to fund program authority:', error);
      
      // Extract meaningful error message
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by the user.';
      }
      
      toast({
        title: 'Failed to fund program authority',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsFunding(false);
    }
  };

  const handleClose = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsClosing(true);
      
      // Check if wallet address matches expected admin wallet
      const adminWalletAddress = "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ";
      const currentWalletAddress = wallet.publicKey.toString();
      
      if (currentWalletAddress !== adminWalletAddress) {
        toast({
          title: 'Admin Wallet Required',
          description: `Please connect with the admin wallet (${adminWalletAddress.slice(0, 6)}...${adminWalletAddress.slice(-6)})`,
          variant: 'destructive',
        });
        setIsClosing(false);
        return;
      }
      
      toast({
        title: 'Preparing Transaction',
        description: 'Please approve the transaction in your wallet...',
      });
      
      const signature = await MultihubIntegrationV3.closeMultihubSwapV3(wallet);
      
      toast({
        title: 'Program Closed Successfully',
        description: `Transaction signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      
      // Link to Solana Explorer
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      window.open(explorerUrl, '_blank');
      
    } catch (error: any) {
      console.error('Failed to close program:', error);
      
      // Extract meaningful error message
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Transaction simulation failed')) {
        errorMessage = 'Transaction simulation failed. The program may already be closed or the wallet is not authorized.';
      } else if (errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by the user.';
      }
      
      toast({
        title: 'Failed to close program',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsClosing(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Multihub Swap V3 Admin Actions</CardTitle>
        <CardDescription>
          Initialize or reset the Multihub Swap V3 program
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">
          Program ID: <code className="bg-muted p-1 rounded">{MultihubIntegrationV3.PROGRAM_ID_V3}</code>
        </p>
        
        {/* Debug Panel - shows program state and PDA information */}
        <div className="mb-6">
          <MultihubV3DebugPanel />
        </div>
        
        <Separator className="my-6" />
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Initialize Program</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Set up the program with default parameters:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside mb-2">
              <li>LP Contribution: 20%</li>
              <li>Admin Fee: 0.1%</li>
              <li>YOS Cashback: 3%</li>
              <li>Swap Fee: 0.3%</li>
              <li>Referral Fee: 0.5%</li>
            </ul>
            <Button 
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Initialize Program'
              )}
            </Button>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-medium mb-1">Fund Program Authority</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Fund the program authority to fix "InsufficientFunds" errors in swap operations
            </p>
            <div className="flex items-center space-x-2 mb-2">
              <Label htmlFor="fundAmount" className="sr-only">
                Amount (SOL)
              </Label>
              <Input
                id="fundAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="SOL amount"
                className="w-full"
              />
            </div>
            <Button 
              onClick={handleFundAuthority}
              disabled={isFunding}
              variant="outline"
              className="w-full bg-amber-100 hover:bg-amber-200 border-amber-300"
            >
              {isFunding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Funding...
                </>
              ) : (
                'Fund Program Authority'
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              This action sends SOL to the program authority account to allow it to create token accounts and perform swaps.
            </p>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-medium mb-1">Close Program</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Reset the program state (admin only)
            </p>
            <Button 
              onClick={handleClose}
              disabled={isClosing}
              variant="destructive"
              className="w-full"
            >
              {isClosing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                'Close Program'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          Only the admin wallet can perform these actions.
        </p>
      </CardFooter>
    </Card>
  );
}

export default MultihubV3AdminActions;