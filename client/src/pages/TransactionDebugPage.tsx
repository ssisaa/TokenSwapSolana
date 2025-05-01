import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, SystemProgram, clusterApiUrl, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { shortenAddress } from "@/lib/utils";

export default function TransactionDebugPage() {
  const wallet = useWallet();
  const { toast } = useToast();
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("0.001");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  
  // Connection to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Test basic wallet signature without sending any transaction
  const testWalletSignature = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    setIsTestLoading(true);
    setTestResult(null);
    setError(null);
    
    try {
      // Create a minimal transaction that just requires a signature
      // Here we'll create a transaction that transfers 0 SOL to ourselves, which doesn't cost anything
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: wallet.publicKey,
          lamports: 0
        })
      );
      
      // Get a recent blockhash to include in the transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Request the wallet to sign the transaction
      const signedTransaction = await wallet.signTransaction!(transaction);
      
      // We don't need to send this transaction, just verify it was signed
      setTestResult("Wallet signature test passed! Your wallet can sign transactions.");
      
      toast({
        title: "Success",
        description: "Wallet signature test successful",
      });
    } catch (err: any) {
      console.error("Error testing wallet signature:", err);
      setError(`Wallet signature test failed: ${err.message || 'Unknown error'}`);
      
      toast({
        title: "Signature test failed",
        description: err.message || "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  // Send a simple SOL transfer
  const sendTransaction = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    if (!destinationAddress) {
      toast({
        title: "Missing destination",
        description: "Please enter a destination address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);
    
    try {
      // Validate destination address
      let toPublicKey: PublicKey;
      try {
        toPublicKey = new PublicKey(destinationAddress);
      } catch (err) {
        throw new Error("Invalid destination address");
      }
      
      // Convert amount from SOL to lamports (smallest unit)
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;
      
      if (isNaN(lamports) || lamports <= 0) {
        throw new Error("Invalid amount");
      }
      
      // Create the transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: toPublicKey,
          lamports
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign and send transaction
      const signature = await wallet.sendTransaction(transaction, connection);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      setResult(`Transaction successful! Signature: ${signature}`);
      
      toast({
        title: "Transaction successful",
        description: `Sent ${amount} SOL to ${shortenAddress(destinationAddress)}`,
      });
    } catch (err: any) {
      console.error("Transaction error:", err);
      setError(`Transaction failed: ${err.message || 'Unknown error'}`);
      
      toast({
        title: "Transaction failed",
        description: err.message || "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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
          <div className="flex items-center gap-4 mb-4">
            <WalletMultiButton />
            
            {wallet.connected && (
              <span>Connected: {shortenAddress(wallet.publicKey?.toString() || "")}</span>
            )}
          </div>
          
          <Button 
            onClick={testWalletSignature}
            disabled={!wallet.connected || isTestLoading}
            className="mb-4"
          >
            {isTestLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Simple Transaction Test
          </Button>
          
          {testResult && (
            <Alert className="mt-4 bg-green-50 border-green-500">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{testResult}</AlertDescription>
            </Alert>
          )}
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
          <div className="mb-4">
            <Label htmlFor="destination" className="mb-2 block">Destination Address</Label>
            <Input
              id="destination"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="Enter Solana address"
              className="mb-2"
            />
            <p className="text-sm text-muted-foreground">
              Use your own wallet address to test a self-transfer
            </p>
          </div>
          
          <div className="mb-4">
            <Label htmlFor="amount" className="mb-2 block">Amount (SOL)</Label>
            <Input
              id="amount"
              type="number"
              min="0.000001"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mb-2"
            />
            <p className="text-sm text-muted-foreground">
              This page is for diagnostic purposes only. Use minimal amounts for testing.
            </p>
          </div>
          
          <Button 
            onClick={sendTransaction}
            disabled={!wallet.connected || isLoading || !destinationAddress}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send SOL
          </Button>
          
          {result && (
            <Alert className="mt-4 bg-green-50 border-green-500">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{result}</AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert className="mt-4 bg-red-50 border-red-500">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}