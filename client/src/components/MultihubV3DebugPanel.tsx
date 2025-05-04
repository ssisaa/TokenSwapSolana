import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/useSolanaWallet";
import { connection } from "@/lib/solana";
import multihubContract from "@/lib/multihub-contract-v3";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useToast } from "@/hooks/use-toast";
import { type PublicKey } from '@solana/web3.js';

export default function MultihubV3DebugPanel() {
  // Get wallet context - we need to support both types of wallet contexts
  const walletContextObj = useWallet();
  
  // Extract the properties we need regardless of wallet context type
  const wallet = 'wallet' in walletContextObj ? walletContextObj.wallet : walletContextObj;
  const publicKey = 'publicKey' in walletContextObj ? walletContextObj.publicKey : null;
  
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const { toast } = useToast();

  // Function to run debug info
  const runDebugInfo = async () => {
    if (!connection || !publicKey) return;
    
    setIsDebugLoading(true);
    setDebugInfo("");
    
    try {
      // Override console.log to capture output
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalConsoleLog(...args);
      };
      
      // Run debug function
      await multihubContract.debugProgramIDs();
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      // Update state with captured logs
      setDebugInfo(logs.join('\n'));
      
      toast({
        title: "Debug Complete",
        description: "Debug information collected successfully",
      });
    } catch (error) {
      console.error("Error running debug:", error);
      setDebugInfo(`Error: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Debug Failed",
        description: "Failed to collect debug information",
        variant: "destructive",
      });
    } finally {
      setIsDebugLoading(false);
    }
  };
  
  // Function to verify and fund the program authority
  const verifyProgramAuthority = async () => {
    if (!connection || !publicKey) return;
    
    setIsVerifyLoading(true);
    
    try {
      // Override console.log to capture output
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalConsoleLog(...args);
      };
      
      // Run the verification function
      const result = await multihubContract.verifyProgramAuthority(connection, wallet);
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      // Update debug info with new logs
      setDebugInfo(prevLogs => prevLogs + '\n\n=== PROGRAM AUTHORITY VERIFICATION ===\n' + logs.join('\n'));
      
      if (result) {
        toast({
          title: "Verification Successful",
          description: "Program authority verified and funded if needed",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: "Failed to verify program authority",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error verifying program authority:", error);
      setDebugInfo(prevLogs => prevLogs + `\n\nError verifying: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Verification Failed",
        description: "Error verifying program authority",
        variant: "destructive",
      });
    } finally {
      setIsVerifyLoading(false);
    }
  };

  return (
    <Card className="w-full mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-bold">MultiHub V3 Program Debug Panel</CardTitle>
        <CardDescription>
          Diagnose and fix program ID and PDA issues that can cause initialization errors
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Alert className="mb-4 bg-amber-50 dark:bg-amber-950">
          <AlertTitle className="text-amber-600 dark:text-amber-400">Initialization Error Diagnosis</AlertTitle>
          <AlertDescription>
            This panel helps diagnose the "Custom:0" error that occurs during initialization due to PDA mismatches.
            The problem happens because the program has a hardcoded program ID that doesn't match the deployed ID.
            The fix is to derive PDAs using the hardcoded ID rather than the actual deployed ID.
          </AlertDescription>
        </Alert>
        
        <div className="flex flex-wrap gap-4 mb-4">
          <Button 
            onClick={runDebugInfo}
            disabled={!walletContext.publicKey || isDebugLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDebugLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Run Debug Info
          </Button>
          
          <Button
            onClick={verifyProgramAuthority}
            disabled={!walletContext.publicKey || isVerifyLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isVerifyLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Verify & Fund Program Authority
          </Button>
        </div>
        
        <Separator className="my-4" />
        
        {debugInfo && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Debug Output:</h3>
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs overflow-auto max-h-[400px] whitespace-pre-wrap">
              {debugInfo}
            </pre>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-gray-500">
          Connected Wallet: {walletContext.publicKey ? walletContext.publicKey.toString() : "Not connected"}
        </p>
      </CardFooter>
    </Card>
  );
}