import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/useSolanaWallet";
import { connection } from "@/lib/solana";
import multihubContract, * as multihubExports from "@/lib/multihub-contract-v3";
import MultihubIntegrationV3 from "@/lib/multihub-integration-v3";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ReloadIcon } from "@radix-ui/react-icons";
import { CircleAlert, CircleCheck, InfoIcon, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PublicKey } from '@solana/web3.js';
import { Badge } from "@/components/ui/badge";

export default function MultihubV3DebugPanel() {
  // Get wallet context - we need to support both types of wallet contexts
  const walletContextObj = useWallet();
  
  // Extract the properties we need regardless of wallet context type
  const wallet = 'wallet' in walletContextObj ? walletContextObj.wallet : walletContextObj;
  const publicKey = 'publicKey' in walletContextObj ? walletContextObj.publicKey : null;
  
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const [isStateCheckLoading, setIsStateCheckLoading] = useState(false);
  const [isTokenAccountsLoading, setIsTokenAccountsLoading] = useState(false);
  const [stateCheckResult, setStateCheckResult] = useState<{
    exists: boolean;
    hasCorrectOwner: boolean;
    hasCorrectSize: boolean;
    details: string;
  } | null>(null);
  const [tokenAccountsResult, setTokenAccountsResult] = useState<{
    programAuthorityAddress: string;
    yotAccount: {
      address: string;
      exists: boolean;
      balance?: number;
    };
    yosAccount: {
      address: string;
      exists: boolean;
      balance?: number;
    };
    solAccount: {
      address: string;
      exists: boolean;
      balance?: number;
    };
  } | null>(null);
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
  
  // Function to check state account
  const checkStateAccount = async () => {
    if (!connection) return;
    
    setIsStateCheckLoading(true);
    setStateCheckResult(null);
    
    try {
      // Override console.log to capture output
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalConsoleLog(...args);
      };
      
      // Run the check state account function
      const result = await multihubContract.checkStateAccount(connection);
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      // Update state with result
      setStateCheckResult(result);
      
      // Update debug info with new logs
      setDebugInfo(prevLogs => {
        const newLogs = prevLogs ? prevLogs + '\n\n=== STATE ACCOUNT VERIFICATION ===\n' : '=== STATE ACCOUNT VERIFICATION ===\n';
        return newLogs + logs.join('\n') + '\n' + result.details;
      });
      
      toast({
        title: "State Account Check Complete",
        description: result.exists 
          ? (result.hasCorrectOwner && result.hasCorrectSize 
              ? "State account exists and is valid" 
              : "State account exists but has issues")
          : "State account doesn't exist yet",
        variant: result.exists && (!result.hasCorrectOwner || !result.hasCorrectSize) ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Error checking state account:", error);
      setDebugInfo(prevLogs => prevLogs + `\n\nError checking state account: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "State Account Check Failed",
        description: "Failed to check program state account",
        variant: "destructive",
      });
    } finally {
      setIsStateCheckLoading(false);
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
      // Fallback to fundProgramAuthority which is an alias for verifyProgramAuthority
      const result = await multihubExports.fundProgramAuthority(connection, wallet, 0.01);
      
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
  
  // Enhanced function to verify token accounts with automatic creation if missing
  const verifyTokenAccounts = async () => {
    if (!connection || !publicKey) return;
    
    setIsTokenAccountsLoading(true);
    setTokenAccountsResult(null);
    
    try {
      // Override console.log to capture output
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalConsoleLog(...args);
      };
      
      // First step: Get the program authority and state addresses
      const [programAuthorityAddress] = multihubContract.findProgramAuthorityAddress();
      const [programStateAddress] = multihubContract.findProgramStateAddress();
      console.log(`Program Authority PDA: ${programAuthorityAddress.toString()}`);
      console.log(`Program State PDA: ${programStateAddress.toString()}`);
      
      // Run the token account verification function from MultihubIntegrationV3
      const result = await MultihubIntegrationV3.verifyProgramTokenAccounts(connection);
      
      // Check if any accounts are missing and need to be created
      const needsTokenAccounts = !result.solAccount.exists || !result.yotAccount.exists || !result.yosAccount.exists;
      
      // Update tokenAccountsResult state with initial check
      setTokenAccountsResult({
        programAuthorityAddress: result.programAuthorityAddress.toString(),
        yotAccount: {
          address: result.yotAccount.address.toString(),
          exists: result.yotAccount.exists,
          balance: result.yotAccount.balance,
        },
        yosAccount: {
          address: result.yosAccount.address.toString(),
          exists: result.yosAccount.exists,
          balance: result.yosAccount.balance,
        },
        solAccount: {
          address: result.solAccount.address.toString(),
          exists: result.solAccount.exists,
          balance: result.solAccount.balance,
        },
      });
      
      if (needsTokenAccounts) {
        console.log("Some token accounts are missing, will attempt to create them...");
        
        try {
          // Import necessary token functions
          const { 
            getAssociatedTokenAddress, 
            createAssociatedTokenAccountInstruction, 
            TOKEN_PROGRAM_ID, 
            ASSOCIATED_TOKEN_PROGRAM_ID 
          } = await import('@solana/spl-token');
          
          const { Transaction } = await import('@solana/web3.js');
          
          // Prepare Transaction
          const tx = new Transaction();
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;
          
          // Get token mint addresses
          const yotMint = new PublicKey(multihubContract.YOT_TOKEN_MINT);
          const yosMint = new PublicKey(multihubContract.YOS_TOKEN_MINT);
          const solMint = new PublicKey('So11111111111111111111111111111111111111112');
          
          let creationInstructionsAdded = false;
          
          // SOL token account (if needed)
          if (!result.solAccount.exists) {
            console.log("Creating SOL token account for program authority...");
            const solTokenAccount = await getAssociatedTokenAddress(
              solMint,
              programAuthorityAddress,
              true,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            const createSolAtaIx = createAssociatedTokenAccountInstruction(
              publicKey,
              solTokenAccount,
              programAuthorityAddress,
              solMint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            tx.add(createSolAtaIx);
            creationInstructionsAdded = true;
            console.log(`Added instruction to create SOL token account: ${solTokenAccount.toString()}`);
          }
          
          // YOT token account (if needed)
          if (!result.yotAccount.exists) {
            console.log("Creating YOT token account for program authority...");
            const yotTokenAccount = await getAssociatedTokenAddress(
              yotMint,
              programAuthorityAddress,
              true,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            const createYotAtaIx = createAssociatedTokenAccountInstruction(
              publicKey,
              yotTokenAccount,
              programAuthorityAddress,
              yotMint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            tx.add(createYotAtaIx);
            creationInstructionsAdded = true;
            console.log(`Added instruction to create YOT token account: ${yotTokenAccount.toString()}`);
          }
          
          // YOS token account (if needed)
          if (!result.yosAccount.exists) {
            console.log("Creating YOS token account for program authority...");
            const yosTokenAccount = await getAssociatedTokenAddress(
              yosMint,
              programAuthorityAddress,
              true,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            const createYosAtaIx = createAssociatedTokenAccountInstruction(
              publicKey,
              yosTokenAccount,
              programAuthorityAddress,
              yosMint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            tx.add(createYosAtaIx);
            creationInstructionsAdded = true;
            console.log(`Added instruction to create YOS token account: ${yosTokenAccount.toString()}`);
          }
          
          // Only send transaction if there are instructions to process
          if (creationInstructionsAdded) {
            console.log("Sending transaction to create missing token accounts...");
            const signature = await wallet.sendTransaction(tx, connection);
            console.log(`Transaction sent: ${signature}`);
            
            // Wait for confirmation
            await connection.confirmTransaction(signature, 'confirmed');
            console.log(`Transaction confirmed: ${signature}`);
            
            // After token creation, verify again to get updated status
            const updatedResult = await MultihubIntegrationV3.verifyProgramTokenAccounts(connection);
            
            // Update tokenAccountsResult state with new result
            setTokenAccountsResult({
              programAuthorityAddress: updatedResult.programAuthorityAddress.toString(),
              yotAccount: {
                address: updatedResult.yotAccount.address.toString(),
                exists: updatedResult.yotAccount.exists,
                balance: updatedResult.yotAccount.balance,
              },
              yosAccount: {
                address: updatedResult.yosAccount.address.toString(),
                exists: updatedResult.yosAccount.exists,
                balance: updatedResult.yosAccount.balance,
              },
              solAccount: {
                address: updatedResult.solAccount.address.toString(),
                exists: updatedResult.solAccount.exists,
                balance: updatedResult.solAccount.balance,
              },
            });
            
            toast({
              title: "Token Accounts Created",
              description: "Missing program token accounts were created successfully",
            });
          }
        } catch (createError) {
          console.error("Error creating token accounts:", createError);
          toast({
            title: "Account Creation Failed",
            description: createError instanceof Error ? createError.message : "Failed to create token accounts",
            variant: "destructive",
          });
        }
      } else {
        console.log("All token accounts exist, no creation needed");
        toast({
          title: "Token Accounts Verified",
          description: "All program token accounts exist and are ready for use",
        });
      }
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      // Update debug info with new logs
      setDebugInfo(prevLogs => {
        const newLogs = prevLogs ? prevLogs + '\n\n=== TOKEN ACCOUNTS VERIFICATION ===\n' : '=== TOKEN ACCOUNTS VERIFICATION ===\n';
        return newLogs + logs.join('\n') + '\n' + JSON.stringify(result, null, 2);
      });
      
    } catch (error) {
      console.error("Error verifying token accounts:", error);
      setDebugInfo(prevLogs => prevLogs + `\n\nError verifying token accounts: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Token Accounts Verification Failed",
        description: "Failed to verify program token accounts",
        variant: "destructive",
      });
    } finally {
      setIsTokenAccountsLoading(false);
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
            The problem happens when there's a mismatch between program ID configuration and the actual deployed ID.
            The fix is to ensure the program ID from app.config.json is used consistently throughout the codebase.
          </AlertDescription>
        </Alert>
        
        <div className="flex flex-wrap gap-4 mb-4">
          <Button 
            onClick={runDebugInfo}
            disabled={!publicKey || isDebugLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDebugLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Run Debug Info
          </Button>
          
          <Button
            onClick={checkStateAccount}
            disabled={isStateCheckLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isStateCheckLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Check State Account
          </Button>
          
          <Button
            onClick={verifyProgramAuthority}
            disabled={!publicKey || isVerifyLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isVerifyLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Verify & Fund Program Authority
          </Button>
          
          <Button
            onClick={verifyTokenAccounts}
            disabled={isTokenAccountsLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isTokenAccountsLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Verify Token Accounts
          </Button>
        </div>
        
        {stateCheckResult && (
          <Alert className="mb-4 bg-gray-50 dark:bg-gray-900">
            <AlertTitle className="flex items-center">
              State Account Status
              {stateCheckResult.exists ? (
                stateCheckResult.hasCorrectOwner && stateCheckResult.hasCorrectSize ? (
                  <Badge className="ml-2 bg-green-500" variant="outline">
                    <CircleCheck className="h-3 w-3 mr-1" /> Valid
                  </Badge>
                ) : (
                  <Badge className="ml-2 bg-red-500" variant="outline">
                    <CircleAlert className="h-3 w-3 mr-1" /> Invalid
                  </Badge>
                )
              ) : (
                <Badge className="ml-2 bg-blue-500" variant="outline">
                  <InfoIcon className="h-3 w-3 mr-1" /> Not Exists
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription>
              <div className="text-xs mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Account Exists:</span>
                  <span className={stateCheckResult.exists ? "text-green-600" : "text-amber-600"}>
                    {stateCheckResult.exists ? "Yes" : "No"}
                  </span>
                </div>
                {stateCheckResult.exists && (
                  <>
                    <div className="flex justify-between">
                      <span>Correct Owner:</span>
                      <span className={stateCheckResult.hasCorrectOwner ? "text-green-600" : "text-red-600"}>
                        {stateCheckResult.hasCorrectOwner ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sufficient Size:</span>
                      <span className={stateCheckResult.hasCorrectSize ? "text-green-600" : "text-red-600"}>
                        {stateCheckResult.hasCorrectSize ? "Yes" : "No"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {tokenAccountsResult && (
          <Alert className="mb-4 bg-gray-50 dark:bg-gray-900">
            <AlertTitle className="flex items-center">
              Program Token Accounts Status
              <Badge className="ml-2 bg-blue-500" variant="outline">
                <InfoIcon className="h-3 w-3 mr-1" /> Error Prevention
              </Badge>
            </AlertTitle>
            <p className="text-xs text-amber-600 mt-1 mb-2">
              This verification checks for token accounts that must exist to avoid the "InvalidAccountData" error during swaps.
              The most critical account is the YOT token account, which must exist and have sufficient balance for SOL→YOT swaps to work.
            </p>
            <AlertDescription>
              <div className="text-xs mt-2 space-y-4">
                <div>
                  <p className="font-semibold mb-1">Program Authority: </p>
                  <p className="text-gray-600 break-all">{tokenAccountsResult.programAuthorityAddress}</p>
                </div>
                
                <div>
                  <div className="flex items-center mb-1">
                    <p className="font-semibold">YOT Token Account: </p>
                    {tokenAccountsResult.yotAccount.exists ? (
                      <Badge className="ml-2 bg-green-500" variant="outline">
                        <CircleCheck className="h-3 w-3 mr-1" /> Exists
                      </Badge>
                    ) : (
                      <Badge className="ml-2 bg-red-500" variant="outline">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Missing
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 break-all">{tokenAccountsResult.yotAccount.address}</p>
                  {tokenAccountsResult.yotAccount.exists && (
                    <p className="mt-1 font-medium">Balance: {tokenAccountsResult.yotAccount.balance?.toLocaleString()} YOT</p>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center mb-1">
                    <p className="font-semibold">YOS Token Account: </p>
                    {tokenAccountsResult.yosAccount.exists ? (
                      <Badge className="ml-2 bg-green-500" variant="outline">
                        <CircleCheck className="h-3 w-3 mr-1" /> Exists
                      </Badge>
                    ) : (
                      <Badge className="ml-2 bg-red-500" variant="outline">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Missing
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 break-all">{tokenAccountsResult.yosAccount.address}</p>
                  {tokenAccountsResult.yosAccount.exists && (
                    <p className="mt-1 font-medium">Balance: {tokenAccountsResult.yosAccount.balance?.toLocaleString()} YOS</p>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center mb-1">
                    <p className="font-semibold">SOL Token Account: </p>
                    {tokenAccountsResult.solAccount.exists ? (
                      <Badge className="ml-2 bg-green-500" variant="outline">
                        <CircleCheck className="h-3 w-3 mr-1" /> Exists
                      </Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-500" variant="outline">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Native SOL
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 break-all">{tokenAccountsResult.solAccount.address}</p>
                  {tokenAccountsResult.solAccount.exists && (
                    <p className="mt-1 font-medium">Balance: {tokenAccountsResult.solAccount.balance?.toLocaleString()} SOL</p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
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
          Connected Wallet: {publicKey ? publicKey.toString() : "Not connected"}
        </p>
      </CardFooter>
    </Card>
  );
}