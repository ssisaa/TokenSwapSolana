import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMultiWallet } from "@/context/MultiWalletContext";
import { shortenAddress } from "@/lib/utils";
import { multiHubSwapClient } from "@/lib/multihub-contract";

export default function TransactionDebugPage() {
  const wallet = useWallet();
  const multiWallet = useMultiWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("0.001");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initResult, setInitResult] = useState<string | null>(null);

  // Test basic wallet signature without sending any transaction
  const testWalletSignature = async () => {
    // Try to use both wallet contexts to ensure we have a wallet connection
    if ((!wallet.connected || !wallet.publicKey) && (!multiWallet.connected || !multiWallet.publicKey)) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    // Prefer the wallet from @solana/wallet-adapter-react, but fall back to multiWallet if needed
    const activeWallet = wallet.connected && wallet.publicKey ? wallet : multiWallet.wallet;

    setIsTestLoading(true);
    setTestResult(null);
    setError(null);
    
    try {
      // Get the public key from the active wallet
      if (!activeWallet || !activeWallet.publicKey) {
        throw new Error("No public key available in the connected wallet");
      }
      const publicKey = activeWallet.publicKey;

      // Create a minimal transaction that just requires a signature
      // Here we'll create a transaction that transfers 0 SOL to ourselves, which doesn't cost anything
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey,
          lamports: 0
        })
      );
      
      // Get a recent blockhash to include in the transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // First simulate the transaction to make sure it would succeed
      console.log("Simulating signature test transaction...");
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      
      // Request the wallet to sign the transaction
      console.log("Requesting wallet signature...");
      
      // Handle both API patterns (signTransaction may return Transaction or Promise<Transaction>)
      const signedTransaction = await activeWallet.signTransaction!(transaction);
      
      console.log("Transaction signed successfully");
      
      // We don't need to send this transaction, just verify it was signed
      setTestResult("Wallet signature test passed! Your wallet can successfully sign transactions.");
      
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

  // Initialize the MultiHub Swap program
  const initializeProgram = async () => {
    // Try to use both wallet contexts to ensure we have a wallet connection
    if ((!wallet.connected || !wallet.publicKey) && (!multiWallet.connected || !multiWallet.publicKey)) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    // Prefer the wallet from @solana/wallet-adapter-react, but fall back to multiWallet if needed
    const activeWallet = wallet.connected && wallet.publicKey ? wallet : multiWallet.wallet;

    setIsInitializing(true);
    setInitResult(null);
    setError(null);
    
    try {
      // Call the initialization function
      console.log("Initializing MultiHub Swap program...");
      
      // There could be multiple failure scenarios:
      // 1. Transaction rejected by wallet (user cancellation)
      // 2. Transaction failed at simulation stage (wallet shows warning)
      // 3. Transaction sent but failed on chain
      // 4. Successful signature but failed to create accounts properly
      
      const signature = await multiHubSwapClient.initializeProgram(activeWallet);
      
      if (signature === "Already initialized") {
        setInitResult("Program is already initialized, state account exists");
        toast({
          title: "Already initialized",
          description: "The MultiHub Swap program was already initialized",
        });
      } else {
        // Wait a moment for blockchain state to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify the program state actually exists by validating on-chain
        const { Connection } = await import('@solana/web3.js');
        const { ENDPOINT } = await import('@/lib/constants');
        const { validateProgramInitialization } = await import('@/lib/multihub-contract');
        
        const connection = new Connection(ENDPOINT);
        const validation = await validateProgramInitialization(connection);
        
        if (validation.initialized) {
          setInitResult(`Program initialization successful! Signature: ${signature}`);
          toast({
            title: "Initialization successful",
            description: "The MultiHub Swap program has been properly initialized and verified",
          });
        } else {
          // Something went wrong - we have a signature but program isn't initialized
          setInitResult(null);
          setError(`Transaction completed but program state is not valid. Error: ${validation.error}`);
          
          toast({
            title: "Validation Failed",
            description: "Transaction was sent but the program initialization could not be verified. Please check the Solana explorer for details.",
            variant: "destructive"
          });
        }
      }
    } catch (err: any) {
      console.error("Program initialization error:", err);
      
      // Try to provide more specific error messages based on common scenarios
      let errorMessage = err.message || 'Unknown error';
      
      if (errorMessage.includes("User rejected")) {
        errorMessage = "Transaction was rejected by the wallet. Please try again.";
      } else if (errorMessage.includes("Simulation failed") || errorMessage.includes("reverted")) {
        errorMessage = "Transaction simulation failed. This usually indicates a configuration issue with the program or insufficient funds.";
      } else if (errorMessage.includes("Transaction was not confirmed")) {
        errorMessage = "Transaction was sent but not confirmed by the network. Please check the Solana Explorer for details.";
      }
      
      setError(`Program initialization failed: ${errorMessage}`);
      
      toast({
        title: "Initialization failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsInitializing(false);
    }
  };
  
  // Send a simple SOL transfer
  const sendTransaction = async () => {
    // Try to use both wallet contexts to ensure we have a wallet connection
    if ((!wallet.connected || !wallet.publicKey) && (!multiWallet.connected || !multiWallet.publicKey)) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    // Prefer the wallet from @solana/wallet-adapter-react, but fall back to multiWallet if needed
    const activeWallet = wallet.connected && wallet.publicKey ? wallet : multiWallet.wallet;

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
      
      // Get the public key from the active wallet
      if (!activeWallet || !activeWallet.publicKey) {
        throw new Error("No public key available in the connected wallet");
      }
      const publicKey = activeWallet.publicKey;

      // Create the transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: toPublicKey,
          lamports
        })
      );
      
      // Get recent blockhash with more parameters for better reliability
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      console.log("Sending transaction...");

      // Sign and send transaction using the active wallet
      const signature = await activeWallet.sendTransaction(transaction, connection);
      
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
          <CardTitle>MultiHub Program Initialization</CardTitle>
          <CardDescription>
            Initialize the MultiHub Swap program's state accounts on-chain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will initialize the MultiHub Swap program with the following parameters:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 pl-4">
              <li>Liquidity Contribution: 20%</li>
              <li>Admin Fee: 1%</li>
              <li>YOS Cashback: 5%</li>
            </ul>
            
            <div className="mt-6">
              <Button 
                onClick={initializeProgram}
                disabled={((!wallet.connected || !wallet.publicKey) && (!multiWallet.connected || !multiWallet.publicKey)) || isInitializing}
                className="w-full"
                size="lg"
                variant="destructive"
              >
                {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize MultiHub Swap Program
              </Button>
            </div>
            
            {initResult && (
              <Alert className="mt-4 bg-green-50 border-green-500">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{initResult}</p>
                  <p className="text-sm text-green-700">
                    The program state has been verified on-chain and is ready to use.
                  </p>
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert className="mt-4 bg-destructive/10 border-destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Initialization Error</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{error}</p>
                  
                  {error.includes("simulation failed") || error.includes("reverted") ? (
                    <div className="rounded-md bg-destructive/5 p-3 text-sm mt-2">
                      <p className="font-semibold text-destructive mb-1">Important Wallet Warning</p>
                      <p>
                        If your wallet shows a red warning message about "transaction reverted during simulation",
                        the transaction will fail even if you approve it. This typically indicates a program
                        configuration issue.
                      </p>
                    </div>
                  ) : null}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Wallet Connection Test</CardTitle>
          <CardDescription>
            Test if your wallet can sign and send simple transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <WalletMultiButton />
              
              {wallet.connected && (
                <span>Connected: {shortenAddress(wallet.publicKey?.toString() || "")}</span>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={multiWallet.connected ? "success" : "secondary"}>
                  {multiWallet.connected ? "Connected to MultiWallet" : "Not connected to MultiWallet"}
                </Badge>
                
                {multiWallet.connected && multiWallet.publicKey && (
                  <span className="text-sm">
                    {shortenAddress(multiWallet.publicKey.toString())}
                  </span>
                )}
              </div>
              
              <Button 
                size="sm" 
                variant="outline"
                disabled={multiWallet.connecting} 
                onClick={() => multiWallet.connected ? multiWallet.disconnect() : multiWallet.connect()}
              >
                {multiWallet.connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : multiWallet.connected ? (
                  "Disconnect Multi"
                ) : (
                  "Connect Multi"
                )}
              </Button>
            </div>
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={testWalletSignature}
              disabled={((!wallet.connected || !wallet.publicKey) && (!multiWallet.connected || !multiWallet.publicKey)) || isTestLoading}
              className="w-full"
              size="lg"
              variant="default"
            >
              {isTestLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Simple Transaction Test
            </Button>
          </div>
          
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
            disabled={((!wallet.connected || !wallet.publicKey) && (!multiWallet.connected || !multiWallet.publicKey)) || isLoading || !destinationAddress}
            className="w-full"
            size="lg"
            variant="default"
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