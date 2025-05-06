import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'wouter';
import { AlertCircle, CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { COMMON_WALLET_THRESHOLD_SOL, FORMATTED_RATES } from '@/lib/config';
import { YOT_MINT, YOS_MINT, COMMON_WALLET_ADDRESS, SIMPLIFIED_SWAP_PROGRAM_ID } from '@/lib/configConstants';
import { checkCommonWalletThreshold, addLiquidityFromCommonWallet } from '@/lib/commonWalletSwap';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';
import { getRpcEndpoint } from '@/lib/configConstants';

export default function CommonWalletManager() {
  const { toast } = useToast();
  const { wallet, connected } = useMultiWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [tokenAccountsLoading, setTokenAccountsLoading] = useState(false);
  const [tokenAccountStatus, setTokenAccountStatus] = useState<{
    yotAccountExists: boolean;
    yosAccountExists: boolean;
    yotAccount?: string;
    yosAccount?: string;
    checked: boolean;
  }>({
    yotAccountExists: false,
    yosAccountExists: false,
    checked: false
  });
  const [walletStatus, setWalletStatus] = useState<{
    readyToAddLiquidity: boolean;
    currentBalance: number;
    threshold: number;
    percentage: number;
  }>({
    readyToAddLiquidity: false,
    currentBalance: 0,
    threshold: COMMON_WALLET_THRESHOLD_SOL,
    percentage: 0
  });
  
  // Function to check if token accounts exist for the common wallet
  const checkTokenAccounts = async () => {
    if (!connected || !wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your admin wallet to check token accounts",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setTokenAccountsLoading(true);
      const connection = new Connection(getRpcEndpoint(), 'confirmed');
      const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
      
      // Get token account addresses
      const yotMintPubkey = new PublicKey(YOT_MINT);
      const yosMintPubkey = new PublicKey(YOS_MINT);
      
      const yotTokenAccount = await getAssociatedTokenAddress(yotMintPubkey, commonWalletPubkey);
      const yosTokenAccount = await getAssociatedTokenAddress(yosMintPubkey, commonWalletPubkey);
      
      // Check if accounts exist
      let yotExists = false;
      let yosExists = false;
      
      try {
        await getAccount(connection, yotTokenAccount);
        yotExists = true;
      } catch (error) {
        console.log('YOT token account does not exist for common wallet');
      }
      
      try {
        await getAccount(connection, yosTokenAccount);
        yosExists = true;
      } catch (error) {
        console.log('YOS token account does not exist for common wallet');
      }
      
      setTokenAccountStatus({
        yotAccountExists: yotExists,
        yosAccountExists: yosExists,
        yotAccount: yotTokenAccount.toString(),
        yosAccount: yosTokenAccount.toString(),
        checked: true
      });
      
      return { yotExists, yosExists, yotTokenAccount, yosTokenAccount };
      
    } catch (error) {
      console.error('Error checking token accounts:', error);
      toast({
        title: 'Error Checking Token Accounts',
        description: 'Failed to check token accounts: ' + (error instanceof Error ? error.message : String(error)),
        variant: 'destructive'
      });
    } finally {
      setTokenAccountsLoading(false);
    }
  };
  
  // Function to create missing token accounts
  const createTokenAccounts = async () => {
    if (!connected || !wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your admin wallet to create token accounts",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setTokenAccountsLoading(true);
      
      // First check which accounts need to be created
      const accountStatus = await checkTokenAccounts();
      if (!accountStatus) return;
      
      const { yotExists, yosExists, yotTokenAccount, yosTokenAccount } = accountStatus;
      
      // If all accounts exist, nothing to do
      if (yotExists && yosExists) {
        toast({
          title: 'All Token Accounts Exist',
          description: 'The common wallet already has all required token accounts.',
          variant: 'default'
        });
        return;
      }
      
      const connection = new Connection(getRpcEndpoint(), 'confirmed');
      const transaction = new Transaction();
      const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
      
      if (!yotExists) {
        console.log('Creating YOT token account for common wallet');
        const yotMintPubkey = new PublicKey(YOT_MINT);
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            yotTokenAccount,
            commonWalletPubkey,
            yotMintPubkey
          )
        );
      }
      
      if (!yosExists) {
        console.log('Creating YOS token account for common wallet');
        const yosMintPubkey = new PublicKey(YOS_MINT);
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            yosTokenAccount,
            commonWalletPubkey,
            yosMintPubkey
          )
        );
      }
      
      if (transaction.instructions.length === 0) {
        toast({
          title: 'No Accounts To Create',
          description: 'All required token accounts already exist.',
          variant: 'default'
        });
        return;
      }
      
      // Send transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      let signature;
      try {
        if (wallet.signTransaction) {
          const signedTx = await wallet.signTransaction(transaction);
          signature = await connection.sendRawTransaction(signedTx.serialize());
        } else {
          signature = await wallet.sendTransaction(transaction, connection);
        }
        
        await connection.confirmTransaction(signature, 'confirmed');
        
        toast({
          title: 'Token Accounts Created',
          description: 'Successfully created the required token accounts for the common wallet.',
          variant: 'default'
        });
        
        // Refresh account status
        await checkTokenAccounts();
        
      } catch (error) {
        console.error('Error sending transaction:', error);
        toast({
          title: 'Transaction Failed',
          description: 'Failed to create token accounts: ' + (error instanceof Error ? error.message : String(error)),
          variant: 'destructive'
        });
      }
      
    } catch (error) {
      console.error('Error creating token accounts:', error);
      toast({
        title: 'Error Creating Token Accounts',
        description: 'Failed to create token accounts: ' + (error instanceof Error ? error.message : String(error)),
        variant: 'destructive'
      });
    } finally {
      setTokenAccountsLoading(false);
    }
  };
  
  // Check token accounts on component mount
  useEffect(() => {
    if (connected && wallet) {
      checkTokenAccounts();
    }
  }, [connected, wallet]);

  // Fetch common wallet status
  const { data, isLoading: isStatusLoading, refetch } = useQuery({
    queryKey: ['commonWalletStatus'],
    queryFn: async () => {
      const status = await checkCommonWalletThreshold();
      setWalletStatus(status);
      return status;
    },
    refetchInterval: 20000 // Refresh every 20 seconds
  });

  // Mutation for adding liquidity
  const addLiquidityMutation = useMutation({
    mutationFn: async () => {
      if (!wallet || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }
      return await addLiquidityFromCommonWallet(wallet);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Liquidity Added',
          description: `Successfully added ${data.amount?.toFixed(4)} SOL to liquidity pool`,
          variant: 'default',
        });
        refetch();
      } else {
        toast({
          title: 'Failed to Add Liquidity',
          description: data.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const handleAddLiquidity = async () => {
    if (!connected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your admin wallet to add liquidity.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    addLiquidityMutation.mutate();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Common Wallet Manager
          <Badge variant={walletStatus.readyToAddLiquidity ? 'destructive' : 'outline'}>
            {walletStatus.readyToAddLiquidity ? 'Ready to Add Liquidity' : 'Collecting Funds'}
          </Badge>
        </CardTitle>
        <CardDescription>
          The Common Wallet receives {FORMATTED_RATES.distributionRates.liquidityPool} of every swap transaction. 
          When it reaches {COMMON_WALLET_THRESHOLD_SOL} SOL, funds can be added to the liquidity pool.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Balance:</span>
            <span className="font-bold">{walletStatus.currentBalance.toFixed(4)} SOL</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Threshold:</span>
            <span className="font-medium">{walletStatus.threshold} SOL</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progress:</span>
            <span className="font-medium">{walletStatus.percentage.toFixed(1)}%</span>
          </div>
          <Progress value={walletStatus.percentage} className="h-2" />
        </div>
        
        <Separator className="my-4" />
        
        {/* Token Account Status Section */}
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-semibold flex items-center">
            <ShieldAlert className="w-4 h-4 mr-1" /> Required Token Accounts
          </h4>
          
          {tokenAccountStatus.checked ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">YOT Token Account:</span>
                <Badge variant={tokenAccountStatus.yotAccountExists ? "outline" : "destructive"} className={tokenAccountStatus.yotAccountExists ? "bg-green-100 text-green-700 hover:bg-green-100 hover:text-green-700" : ""}>
                  {tokenAccountStatus.yotAccountExists ? (
                    <span className="flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Exists
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" /> Missing
                    </span>
                  )}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">YOS Token Account:</span>
                <Badge variant={tokenAccountStatus.yosAccountExists ? "outline" : "destructive"} className={tokenAccountStatus.yosAccountExists ? "bg-green-100 text-green-700 hover:bg-green-100 hover:text-green-700" : ""}>
                  {tokenAccountStatus.yosAccountExists ? (
                    <span className="flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Exists
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" /> Missing
                    </span>
                  )}
                </Badge>
              </div>
              
              {(!tokenAccountStatus.yotAccountExists || !tokenAccountStatus.yosAccountExists) && (
                <Alert className="mt-2" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Missing Token Accounts</AlertTitle>
                  <AlertDescription>
                    One or more required token accounts for the common wallet are missing. 
                    These accounts are needed for the swap functionality to work correctly.
                    Click the button below to create them.
                  </AlertDescription>
                </Alert>
              )}
              
              <Button
                className="w-full mt-2"
                variant={
                  (!tokenAccountStatus.yotAccountExists || !tokenAccountStatus.yosAccountExists) 
                  ? "destructive" 
                  : "outline"
                }
                disabled={tokenAccountsLoading || !connected || (tokenAccountStatus.yotAccountExists && tokenAccountStatus.yosAccountExists)}
                onClick={createTokenAccounts}
              >
                {tokenAccountsLoading 
                  ? "Creating Token Accounts..." 
                  : (tokenAccountStatus.yotAccountExists && tokenAccountStatus.yosAccountExists)
                    ? "All Token Accounts Exist"
                    : "Create Missing Token Accounts"
                }
              </Button>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <span className="text-sm text-muted-foreground">
                {tokenAccountsLoading 
                  ? "Checking token accounts..." 
                  : connected 
                  ? "Click to check token accounts" 
                  : "Connect wallet to check token accounts"}
              </span>
            </div>
          )}
        </div>
        
        <Separator className="my-4" />
        
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Common Wallet Mechanism:</h4>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Collects {FORMATTED_RATES.distributionRates.liquidityPool} of all swaps</li>
            <li>When threshold is reached, funds are split 50-50 (SOL-YOT)</li>
            <li>Added to liquidity pool to improve swap rates for all users</li>
            <li>Only admin wallets can trigger liquidity addition</li>
          </ul>
          
          <div className="mt-4 text-sm">
            <Button variant="link" asChild className="p-0 h-auto text-primary font-medium flex items-center gap-1">
              <Link href="/admin/tools">
                Advanced Token Account Management <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={!walletStatus.readyToAddLiquidity || isLoading || !connected}
          onClick={handleAddLiquidity}
        >
          {isLoading ? 'Processing...' : 'Add Liquidity to Pool'}
        </Button>
      </CardFooter>
    </Card>
  );
}