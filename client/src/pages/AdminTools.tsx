import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { YOT_MINT, YOS_MINT, COMMON_WALLET_ADDRESS } from "@/lib/configConstants";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AdminTools() {
  const { user, isLoading } = useAdminAuth();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);

  // Only founder can access this page
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user?.isFounder) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Only the founder can access this page.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const createCommonWalletTokenAccounts = async () => {
    try {
      setIsCreatingAccounts(true);
      setResult(null);

      // Ensure wallet is connected
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected or doesn't support signing");
      }

      // Create a transaction to create token accounts for the common wallet
      const transaction = new Transaction();
      const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
      
      console.log("Creating common wallet token accounts...");
      console.log(`Common wallet address: ${commonWalletPubkey.toBase58()}`);

      // Add YOT token account
      try {
        const yotMintPubkey = new PublicKey(YOT_MINT);
        const commonWalletYotAccount = await getAssociatedTokenAddress(
          yotMintPubkey,
          commonWalletPubkey
        );
        
        console.log(`Common wallet YOT account: ${commonWalletYotAccount.toBase58()}`);
        
        // Check if the account already exists
        try {
          await connection.getTokenAccountBalance(commonWalletYotAccount);
          console.log("Common wallet YOT account already exists");
        } catch (error) {
          console.log("Creating common wallet YOT account...");
          transaction.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              commonWalletYotAccount, // associated token account
              commonWalletPubkey, // owner
              yotMintPubkey // mint
            )
          );
        }
      } catch (error) {
        console.error("Error with YOT account:", error);
      }

      // Add YOS token account
      try {
        const yosMintPubkey = new PublicKey(YOS_MINT);
        const commonWalletYosAccount = await getAssociatedTokenAddress(
          yosMintPubkey,
          commonWalletPubkey
        );
        
        console.log(`Common wallet YOS account: ${commonWalletYosAccount.toBase58()}`);
        
        // Check if the account already exists
        try {
          await connection.getTokenAccountBalance(commonWalletYosAccount);
          console.log("Common wallet YOS account already exists");
        } catch (error) {
          console.log("Creating common wallet YOS account...");
          transaction.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              commonWalletYosAccount, // associated token account
              commonWalletPubkey, // owner
              yosMintPubkey // mint
            )
          );
        }
      } catch (error) {
        console.error("Error with YOS account:", error);
      }

      // If no instructions were added, all accounts already exist
      if (transaction.instructions.length === 0) {
        setResult({
          success: true,
          message: "All common wallet token accounts already exist."
        });
        setIsCreatingAccounts(false);
        return;
      }

      // Add recent blockhash and fee payer
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign and send transaction
      console.log(`Sending transaction with ${transaction.instructions.length} instructions`);
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log(`Transaction sent: ${signature}`);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
      }

      setResult({
        success: true,
        message: `Successfully created common wallet token accounts. Transaction signature: ${signature}`
      });
    } catch (error) {
      console.error("Error creating common wallet token accounts:", error);
      setResult({
        success: false,
        message: `Error creating common wallet token accounts: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setIsCreatingAccounts(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Admin Tools</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Common Wallet Setup</CardTitle>
              <CardDescription>
                Create token accounts for the common wallet address. 
                This is required for the swap functionality.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                disabled={isCreatingAccounts || !wallet.connected} 
                onClick={createCommonWalletTokenAccounts}
                className="w-full"
              >
                {isCreatingAccounts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                    Creating Accounts...
                  </>
                ) : (
                  "Create Common Wallet Token Accounts"
                )}
              </Button>
              
              {!wallet.connected && (
                <p className="text-sm text-red-500 mt-2">
                  Please connect your wallet first.
                </p>
              )}
              
              {result && (
                <Alert 
                  variant={result.success ? "default" : "destructive"}
                  className="mt-4"
                >
                  <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}