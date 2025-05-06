import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { simpleSwap } from '@/lib/simplifiedSwap';

interface SimpleSwapTestProps {
  wallet: any;
}

export function SimpleSwapTest({ wallet }: SimpleSwapTestProps) {
  const [amount, setAmount] = useState<string>('0.01');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<string | null>(null);
  
  const { toast } = useToast();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handleSwap = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setIsSwapping(true);
    setSwapResult(null);

    try {
      const result = await simpleSwap(wallet, parsedAmount);
      
      if (result.success) {
        toast({
          title: 'Swap successful',
          description: `Transaction sent with signature: ${result.signature}`,
        });
        setSwapResult(`Success! TX: ${result.signature}`);
      } else {
        toast({
          title: 'Swap failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
        setSwapResult(`Failed: ${result.error}`);
      }
    } catch (error: any) {
      toast({
        title: 'Swap error',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
      setSwapResult(`Error: ${error.message}`);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <Card className="bg-card shadow-md">
      <CardHeader>
        <CardTitle>Simple SOL to YOT Swap</CardTitle>
        <CardDescription>
          Direct SOL to YOT swap with minimal complexity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">SOL Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              placeholder="Enter SOL amount"
              min="0.001"
              step="0.001"
              disabled={isSwapping}
            />
          </div>
          
          {swapResult && (
            <div className="mt-2 text-sm font-medium">
              <p className={swapResult.startsWith('Success') ? 'text-green-500' : 'text-red-500'}>
                {swapResult}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSwap} 
          disabled={isSwapping || !wallet?.publicKey}
          className="w-full"
        >
          {isSwapping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Swapping...
            </>
          ) : (
            'Swap SOL for YOT'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}