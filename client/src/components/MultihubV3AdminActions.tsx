import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MultihubIntegrationV3 } from '@/lib/multihub-integration-v3';
import { Loader2 } from 'lucide-react';

interface MultihubV3AdminActionsProps {
  wallet: any;
}

export function MultihubV3AdminActions({ wallet }: MultihubV3AdminActionsProps) {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
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
      
      const signature = await MultihubIntegrationV3.initializeMultihubSwapV3(wallet);
      
      toast({
        title: 'Program Initialized',
        description: `Transaction signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      
      // Link to Solana Explorer
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      window.open(explorerUrl, '_blank');
      
    } catch (error: any) {
      console.error('Failed to initialize program:', error);
      toast({
        title: 'Failed to initialize program',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
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
      
      const signature = await MultihubIntegrationV3.closeMultihubSwapV3(wallet);
      
      toast({
        title: 'Program Closed',
        description: `Transaction signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      
      // Link to Solana Explorer
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      window.open(explorerUrl, '_blank');
      
    } catch (error: any) {
      console.error('Failed to close program:', error);
      toast({
        title: 'Failed to close program',
        description: error.message || 'Unknown error',
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