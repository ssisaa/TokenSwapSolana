import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowUpCircleIcon, RefreshCwIcon, ArrowRightCircleIcon } from 'lucide-react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { checkProgramYosBalance, fundProgramYosAccount } from '@/lib/helpers/fund-program';
import { YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProgramFunding() {
  const { wallet, connected } = useMultiWallet();
  const [programInfo, setProgramInfo] = useState<{
    exists: boolean;
    address: string;
    balance: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState('3.0'); // Default to 3 YOS
  
  // Check program YOS balance
  const checkBalance = async () => {
    if (!connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const info = await checkProgramYosBalance();
      setProgramInfo(info);
      
      if (!info.exists) {
        toast({
          title: "Program YOS Account",
          description: `Program YOS account: ${info.address}\nStatus: Not yet created (will be created when funded)`,
          variant: "default"
        });
      } else {
        toast({
          title: "Program YOS Balance",
          description: `Program YOS account: ${info.address}\nBalance: ${info.balance} YOS`,
          variant: info.balance > 0 ? "default" : "destructive"
        });
      }
    } catch (error) {
      console.error("Error checking program balance:", error);
      toast({
        title: "Error",
        description: "Failed to check program YOS account",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fund program YOS account
  const fundProgram = async () => {
    if (!connected || !wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsFunding(true);
      const amount = parseFloat(fundAmount);
      
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Please enter a valid positive number",
          variant: "destructive"
        });
        setIsFunding(false);
        return;
      }
      
      toast({
        title: "Funding Program",
        description: `Sending ${amount} YOS to program account. Please confirm the transaction in your wallet.`,
      });
      
      const result = await fundProgramYosAccount(wallet, amount);
      
      if (result.success) {
        toast({
          title: "Success!",
          description: `Successfully funded program YOS account with ${amount} YOS. New balance: ${result.newBalance} YOS`,
        });
        
        // Update program info
        setProgramInfo({
          exists: true,
          address: result.programYosTokenAccount,
          balance: result.newBalance || 0
        });
      }
    } catch (error: any) {
      console.error("Error funding program account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fund program YOS account",
        variant: "destructive"
      });
    } finally {
      setIsFunding(false);
    }
  };
  
  // Check balance on initial load
  useEffect(() => {
    if (connected) {
      checkBalance();
    }
  }, [connected]);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Program YOS Funding</CardTitle>
        <CardDescription>
          Fund your program's YOS account to enable reward harvesting
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="bg-secondary/20 p-4 rounded-lg border border-primary/20">
            <h3 className="text-sm font-medium mb-2">Program YOS Account Info</h3>
            
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : programInfo ? (
              <div className="space-y-2 text-sm">
                <div className="font-mono text-xs overflow-hidden text-ellipsis">
                  <span className="text-muted-foreground">Address:</span> {programInfo.address}
                </div>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">Status:</span>
                  {programInfo.exists ? (
                    <span className="flex items-center">
                      <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                      Exists
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <span className="h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                      Not created yet
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">Balance:</span>
                  <span className={programInfo.balance > 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                    {programInfo.balance} YOS
                  </span>
                </div>
                
                {/* Status Indicator */}
                <div className="mt-3 p-2 rounded bg-primary/10 border border-primary/20">
                  <div className="flex items-start">
                    <div className={`mt-1 h-3 w-3 rounded-full ${programInfo.balance > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div className="ml-2">
                      <span className="font-medium">Status:</span> {programInfo.balance > 0 ? 'Ready for harvesting' : 'Needs funding'}
                      <p className="text-xs text-muted-foreground mt-1">
                        {programInfo.balance > 0 
                          ? 'Your program has YOS tokens and can pay out rewards. Users can harvest their rewards.' 
                          : 'The program needs YOS tokens to pay rewards. Use the funding form below.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Connect your wallet to view program info</p>
            )}
          </div>
          
          <div className="mt-4">
            <Label htmlFor="fundAmount">Amount to Fund (YOS)</Label>
            <div className="flex mt-2 gap-2">
              <Input
                id="fundAmount"
                type="number"
                step="0.1"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                disabled={isFunding}
                className="flex-1"
              />
              <Button
                variant="default"
                onClick={fundProgram}
                disabled={!connected || isFunding}
                className="bg-gradient-to-r from-primary to-primary/80 hover:to-primary"
              >
                {isFunding ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                    Funding...
                  </>
                ) : (
                  <>
                    <ArrowUpCircleIcon className="h-4 w-4 mr-2" />
                    Fund Program
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You need to fund the program with YOS tokens before users can harvest their staking rewards.
              We recommend funding with at least 3 YOS tokens to start.
            </p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={checkBalance}
          disabled={isLoading || !connected}
        >
          {isLoading ? (
            <RefreshCwIcon className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh Balance</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            toast({
              title: "YOS Token",
              description: `YOS Token Address: ${YOS_TOKEN_ADDRESS}`,
            });
          }}
        >
          <ArrowRightCircleIcon className="h-4 w-4 mr-2" />
          View YOS Token
        </Button>
      </CardFooter>
    </Card>
  );
}