import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

import { testWalletTransaction, executeSimpleTransfer } from '@/lib/transaction-test';

export default function TransactionDebugPage() {
  const { toast } = useToast();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; signature?: string } | null>(null);
  const [transferDestination, setTransferDestination] = useState('');
  const [transferAmount, setTransferAmount] = useState('0.001');
  const [transferResult, setTransferResult] = useState<{ success: boolean; signature?: string; error?: string } | null>(null);

  // Run wallet transaction test
  const runWalletTest = async () => {
    if (!wallet.connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to test transaction signing",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const result = await testWalletTransaction(wallet);
      setTestResult(result);
      
      toast({
        title: result.success ? "Test Successful" : "Test Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error("Error running wallet test:", error);
      setTestResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      toast({
        title: "Test Error",
        description: "Unexpected error running the test",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Execute simple transfer
  const runSimpleTransfer = async () => {
    if (!wallet.connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to execute a transfer",
        variant: "destructive"
      });
      return;
    }

    if (!transferDestination) {
      toast({
        title: "Missing destination",
        description: "Please enter a destination address",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setTransferResult(null);

    try {
      const result = await executeSimpleTransfer(wallet, transferDestination, amount);
      setTransferResult(result);
      
      if (result.success) {
        toast({
          title: "Transfer Successful",
          description: `Successfully sent ${amount} SOL`,
          variant: "default"
        });
      } else {
        toast({
          title: "Transfer Failed",
          description: result.error || "Unknown error",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error executing transfer:", error);
      setTransferResult({
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      toast({
        title: "Transfer Error",
        description: "Unexpected error executing the transfer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold">Wallet Transaction Debug</CardTitle>
        <CardDescription>
          Test wallet transaction signing capability and diagnose issues
        </CardDescription>
      </CardHeader>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Wallet Connection Test</CardTitle>
          <CardDescription>
            Test if your wallet can sign and send simple transactions
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {!wallet.connected ? (
              <div className="flex justify-center">
                <WalletMultiButton className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg px-4 py-2" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">Connected Wallet</div>
                  <div className="text-sm break-all mt-1">
                    {wallet.publicKey?.toString()}
                  </div>
                </div>
                
                <Button
                  onClick={runWalletTest}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Run Simple Transaction Test"
                  )}
                </Button>
              </div>
            )}
            
            {testResult && (
              <Alert
                variant={testResult.success ? "default" : "destructive"}
                className={testResult.success ? "bg-green-50 border-green-200" : undefined}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{testResult.success ? "Success" : "Error"}</AlertTitle>
                <AlertDescription>
                  {testResult.message}
                  {testResult.signature && (
                    <div className="mt-2">
                      <div className="font-medium text-sm">Transaction Signature:</div>
                      <div className="text-xs break-all mt-1">
                        <a
                          href={`https://solscan.io/tx/${testResult.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {testResult.signature}
                        </a>
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Simple SOL Transfer</CardTitle>
          <CardDescription>
            Test sending a small amount of SOL to an address
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {!wallet.connected ? (
              <div className="flex justify-center">
                <WalletMultiButton className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg px-4 py-2" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Address</Label>
                  <Input
                    id="destination"
                    value={transferDestination}
                    onChange={(e) => setTransferDestination(e.target.value)}
                    placeholder="Enter Solana address"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (SOL)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.001"
                    step="0.001"
                    min="0.000001"
                  />
                  <div className="text-xs text-muted-foreground">
                    Enter a small amount for testing purposes
                  </div>
                </div>
                
                <Button
                  onClick={runSimpleTransfer}
                  disabled={loading || !transferDestination}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send SOL"
                  )}
                </Button>
              </div>
            )}
            
            {transferResult && (
              <Alert
                variant={transferResult.success ? "default" : "destructive"}
                className={transferResult.success ? "bg-green-50 border-green-200" : undefined}
              >
                {transferResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{transferResult.success ? "Transfer Successful" : "Transfer Failed"}</AlertTitle>
                <AlertDescription>
                  {transferResult.success ? (
                    <div>
                      Successfully sent {transferAmount} SOL to {transferDestination}
                    </div>
                  ) : (
                    <div>{transferResult.error || "Unknown error"}</div>
                  )}
                  
                  {transferResult.signature && (
                    <div className="mt-2">
                      <div className="font-medium text-sm">Transaction Signature:</div>
                      <div className="text-xs break-all mt-1">
                        <a
                          href={`https://solscan.io/tx/${transferResult.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {transferResult.signature}
                        </a>
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col pt-0">
          <div className="text-center text-xs text-muted-foreground mt-4">
            <p>
              This page is for diagnostic purposes only. Use minimal amounts for testing.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}