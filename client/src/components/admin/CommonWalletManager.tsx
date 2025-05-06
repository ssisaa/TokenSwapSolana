import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { COMMON_WALLET_THRESHOLD_SOL, FORMATTED_RATES } from '@/lib/config';
import { checkCommonWalletThreshold, addLiquidityFromCommonWallet } from '@/lib/commonWalletSwap';
import { useMultiWallet } from '@/context/MultiWalletContext';

export default function CommonWalletManager() {
  const { toast } = useToast();
  const { wallet, connected } = useMultiWallet();
  const [isLoading, setIsLoading] = useState(false);
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
        
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Common Wallet Mechanism:</h4>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Collects {FORMATTED_RATES.distributionRates.liquidityPool} of all swaps</li>
            <li>When threshold is reached, funds are split 50-50 (SOL-YOT)</li>
            <li>Added to liquidity pool to improve swap rates for all users</li>
            <li>Only admin wallets can trigger liquidity addition</li>
          </ul>
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