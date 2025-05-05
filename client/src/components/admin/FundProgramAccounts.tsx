import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fundProgramYosAccount, checkProgramYosBalance } from '@/lib/helpers/fund-program';
import { Loader2, InfoIcon } from 'lucide-react';

export default function FundProgramAccounts() {
  const { toast } = useToast();
  const { wallet, connected } = useMultiWallet();
  const [amount, setAmount] = useState(5.0);
  const [loading, setLoading] = useState(false);
  const [fundingResult, setFundingResult] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const handleFund = async () => {
    if (!connected || !wallet) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to fund the program accounts.',
        variant: 'destructive'
      });
      return;
    }

    if (amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter an amount greater than 0.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const result = await fundProgramYosAccount(wallet, amount);
      console.log('Funding result:', result);
      setFundingResult(result);
      toast({
        title: 'Program Account Funded',
        description: `Successfully funded program YOS account with ${amount} tokens.`,
      });
    } catch (error: any) {
      console.error('Error funding program account:', error);
      toast({
        title: 'Error Funding Program Account',
        description: error.message || 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBalance = async () => {
    setChecking(true);
    try {
      const balanceResult = await checkProgramYosBalance();
      console.log('Balance result:', balanceResult);
      setBalance(balanceResult);
    } catch (error: any) {
      console.error('Error checking program account balance:', error);
      toast({
        title: 'Error Checking Balance',
        description: error.message || 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Fund Program Accounts</CardTitle>
        <CardDescription>
          Initialize and fund program token accounts after deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-amber-50 border-amber-200">
          <InfoIcon className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Maintenance Notice</AlertTitle>
          <AlertDescription className="text-amber-700">
            The program funding feature is currently in simulation mode for maintenance. Actual blockchain transactions are disabled.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-1">
          <Label htmlFor="amount">YOS Amount to Send</Label>
          <Input
            id="amount"
            type="number"
            step="0.1"
            min="0.1"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
          />
          <p className="text-sm text-muted-foreground">
            How many YOS tokens to send to the program
          </p>
        </div>

        {balance && (
          <Alert className={balance.exists ? 'bg-green-50' : 'bg-yellow-50'}>
            <AlertTitle>Program YOS Account Status</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                <p><strong>Address:</strong> {balance.address}</p>
                <p><strong>Exists:</strong> {balance.exists ? 'Yes' : 'No'}</p>
                {balance.exists && (
                  <p><strong>Balance:</strong> {balance.balance} YOS</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {fundingResult && (
          <Alert className="bg-green-50">
            <AlertTitle>Funding Successful</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                <p><strong>Transaction:</strong> {fundingResult.signature}</p>
                <p><strong>Previous Balance:</strong> {fundingResult.previousBalance} YOS</p>
                <p><strong>New Balance:</strong> {fundingResult.newBalance} YOS</p>
                <p><strong>Account:</strong> {fundingResult.programYosTokenAccount}</p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="space-x-2">
        <Button 
          variant="outline" 
          onClick={handleCheckBalance}
          disabled={checking}
        >
          {checking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Balance'
          )}
        </Button>
        <Button 
          onClick={handleFund}
          disabled={loading || !connected}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Funding...
            </>
          ) : (
            'Fund Program Account'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}