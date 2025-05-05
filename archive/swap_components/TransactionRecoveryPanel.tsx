import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { connectionManager } from '@/lib/connection-manager';
import { config } from '@/lib/config';
import { refundFailedSwap } from '@/lib/multihub-recovery';

interface TransactionRecoveryPanelProps {
  walletAddress?: PublicKey;
  connected: boolean;
  wallet: any;
}

interface FailedTransaction {
  signature: string;
  timestamp: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  status: 'pending' | 'refunded' | 'failed';
}

const TOKEN_NAMES: { [key: string]: string } = {
  'So11111111111111111111111111111111111111112': 'SOL',
  [config.tokens.YOT]: 'YOT',
  [config.tokens.YOS]: 'YOS',
};

export default function TransactionRecoveryPanel({ walletAddress, connected, wallet }: TransactionRecoveryPanelProps) {
  const [failedTransactions, setFailedTransactions] = useState<FailedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const { toast } = useToast();

  // Mock function to check for failed transactions in local storage
  // In a production environment, this would query a backend service
  const checkForFailedTransactions = async () => {
    if (!connected || !walletAddress) return;
    
    setIsLoading(true);
    try {
      // Attempt to load failed transactions from localStorage
      const storedTransactions = localStorage.getItem(`failed_transactions_${walletAddress.toString()}`);
      if (storedTransactions) {
        setFailedTransactions(JSON.parse(storedTransactions));
      }
      
      // In a real implementation, we would check the blockchain for unprocessed transactions
      // For this prototype, we'll just use what's in localStorage
    } catch (error) {
      console.error('Error checking for failed transactions:', error);
      toast({
        title: 'Error',
        description: 'Could not check for failed transactions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle refunding a failed transaction
  const handleRefund = async (transaction: FailedTransaction) => {
    if (!connected || !wallet) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to process refunds',
        variant: 'destructive',
      });
      return;
    }
    
    setIsRefunding(true);
    try {
      // Determine if this was a SOL→YOT or YOT→SOL swap
      const isSolToYot = transaction.tokenIn === 'So11111111111111111111111111111111111111112';
      const isYotToSol = transaction.tokenOut === 'So11111111111111111111111111111111111111112';
      
      // Call the appropriate refund function
      const signature = await refundFailedSwap(
        connectionManager.getConnection(),
        wallet,
        transaction.signature,
        isSolToYot,
        transaction.amountIn
      );
      
      if (signature) {
        // Update the transaction status in the list
        const updatedTransactions = failedTransactions.map(tx => 
          tx.signature === transaction.signature 
            ? { ...tx, status: 'refunded' as const } 
            : tx
        );
        
        setFailedTransactions(updatedTransactions);
        
        // Update localStorage
        localStorage.setItem(
          `failed_transactions_${walletAddress!.toString()}`, 
          JSON.stringify(updatedTransactions)
        );
        
        toast({
          title: 'Refund successful',
          description: `Your ${isSolToYot ? 'SOL' : 'YOT'} has been refunded. Transaction: ${signature}`,
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.error('Error processing refund:', error);
      toast({
        title: 'Refund failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsRefunding(false);
    }
  };

  // Function to manually add a failed transaction (for testing/demo purposes)
  const addMockFailedTransaction = () => {
    if (!walletAddress) return;
    
    const newTransaction: FailedTransaction = {
      signature: `mock_${Date.now()}`,
      timestamp: Date.now(),
      tokenIn: 'So11111111111111111111111111111111111111112', // SOL
      tokenOut: config.tokens.YOT, // YOT
      amountIn: 0.2, // 0.2 SOL
      status: 'pending',
    };
    
    const updatedTransactions = [...failedTransactions, newTransaction];
    setFailedTransactions(updatedTransactions);
    
    // Store in localStorage
    localStorage.setItem(
      `failed_transactions_${walletAddress.toString()}`, 
      JSON.stringify(updatedTransactions)
    );
    
    toast({
      title: 'Added mock failed transaction',
      description: 'This is for testing the recovery system',
    });
  };

  // Load failed transactions on component mount
  useEffect(() => {
    if (connected && walletAddress) {
      checkForFailedTransactions();
    }
  }, [connected, walletAddress]);

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Recovery</CardTitle>
          <CardDescription>Connect your wallet to check for failed transactions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Transaction Recovery
        </CardTitle>
        <CardDescription>
          Recover funds from failed transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : failedTransactions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No failed transactions found</p>
            
            {/* In development mode, add button to create mock failed transactions */}
            {import.meta.env.DEV && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={addMockFailedTransaction}
              >
                Add Mock Failed Transaction (Dev Only)
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {failedTransactions.map(transaction => (
              <Alert 
                key={transaction.signature}
                variant={transaction.status === 'refunded' ? 'default' : 'destructive'}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <AlertTitle className="flex items-center gap-2">
                      {transaction.status === 'refunded' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      {transaction.status === 'refunded' ? 'Refunded Transaction' : 'Failed Transaction'}
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="grid grid-cols-2 gap-x-4 text-sm">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-medium">{TOKEN_NAMES[transaction.tokenIn] || transaction.tokenIn}</span>
                        
                        <span className="text-muted-foreground">To:</span>
                        <span className="font-medium">{TOKEN_NAMES[transaction.tokenOut] || transaction.tokenOut}</span>
                        
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-medium">{transaction.amountIn} {TOKEN_NAMES[transaction.tokenIn]}</span>
                        
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">{new Date(transaction.timestamp).toLocaleString()}</span>
                      </div>
                      
                      {transaction.status !== 'refunded' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleRefund(transaction)}
                          disabled={isRefunding}
                        >
                          {isRefunding ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing Refund...
                            </>
                          ) : (
                            <>Refund {TOKEN_NAMES[transaction.tokenIn]}</>
                          )}
                        </Button>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}