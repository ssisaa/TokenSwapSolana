import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { config } from "@/lib/config";
import { findProgramAuthorityAddress } from "@/lib/multihub-contract-v3";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

interface MultihubV3FundAccountsProps {
  connection: Connection;
  wallet: any;
}

export default function MultihubV3FundAccounts({ connection, wallet }: MultihubV3FundAccountsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [yotAmount, setYotAmount] = useState("0");
  const [yosAmount, setYosAmount] = useState("0");
  const [balances, setBalances] = useState({
    yot: { program: "Loading...", wallet: "Loading..." },
    yos: { program: "Loading...", wallet: "Loading..." },
  });
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [authority, setAuthority] = useState("");

  useEffect(() => {
    loadProgramAuthority();
    if (wallet?.publicKey) {
      refreshBalances();
    }
  }, [wallet?.publicKey, connection]);

  const loadProgramAuthority = async () => {
    const [programAuthority] = findProgramAuthorityAddress();
    setAuthority(programAuthority.toString());
  };

  const refreshBalances = async () => {
    if (!wallet?.publicKey) return;

    setLoadingBalances(true);
    try {
      const [programAuthority] = findProgramAuthorityAddress();
      
      // Get YOT balances
      const yotMint = new PublicKey(config.tokens.YOT);
      const walletYotAta = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
      const programYotAta = await getAssociatedTokenAddress(
        yotMint, 
        programAuthority,
        true // Allow PDA as owner
      );

      // Get YOS balances
      const yosMint = new PublicKey(config.tokens.YOS);
      const walletYosAta = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
      const programYosAta = await getAssociatedTokenAddress(
        yosMint,
        programAuthority,
        true // Allow PDA as owner
      );

      // Get wallet balances
      let walletYotBalance = "0";
      let walletYosBalance = "0";
      try {
        const yotAccount = await getAccount(connection, walletYotAta);
        walletYotBalance = (Number(yotAccount.amount) / 1e9).toLocaleString();
      } catch (err) {
        console.warn("Wallet YOT account not found:", err);
      }

      try {
        const yosAccount = await getAccount(connection, walletYosAta);
        walletYosBalance = (Number(yosAccount.amount) / 1e9).toLocaleString();
      } catch (err) {
        console.warn("Wallet YOS account not found:", err);
      }

      // Get program balances
      let programYotBalance = "0";
      let programYosBalance = "0";
      try {
        const programAccountInfoYot = await connection.getAccountInfo(programYotAta);
        if (programAccountInfoYot) {
          try {
            const programYotAccount = await getAccount(connection, programYotAta);
            programYotBalance = (Number(programYotAccount.amount) / 1e9).toLocaleString();
          } catch (err) {
            console.warn("Error parsing program YOT account:", err);
          }
        } else {
          programYotBalance = "Not created";
        }
      } catch (err) {
        console.error("Error checking program YOT account:", err);
        programYotBalance = "Error checking";
      }

      try {
        const programAccountInfoYos = await connection.getAccountInfo(programYosAta);
        if (programAccountInfoYos) {
          try {
            const programYosAccount = await getAccount(connection, programYosAta);
            programYosBalance = (Number(programYosAccount.amount) / 1e9).toLocaleString();
          } catch (err) {
            console.warn("Error parsing program YOS account:", err);
          }
        } else {
          programYosBalance = "Not created";
        }
      } catch (err) {
        console.error("Error checking program YOS account:", err);
        programYosBalance = "Error checking";
      }

      setBalances({
        yot: { wallet: walletYotBalance, program: programYotBalance },
        yos: { wallet: walletYosBalance, program: programYosBalance },
      });
    } catch (err) {
      console.error("Error refreshing balances:", err);
      toast({
        variant: "destructive",
        title: "Failed to load balances",
        description: "There was an error loading token balances. Please try again.",
      });
    } finally {
      setLoadingBalances(false);
    }
  };

  const fundYotAccount = async () => {
    if (!wallet?.publicKey) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to fund the program.",
      });
      return;
    }

    if (parseFloat(yotAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0.",
      });
      return;
    }

    setLoading(true);
    try {
      // Load the multihub-contract-v3 module dynamically to avoid circular imports
      const multiHubModule = await import("@/lib/multihub-contract-v3");
      
      // Create the PDA's ATA and transfer tokens from admin wallet
      const amountToTransfer = parseFloat(yotAmount);
      const decimalAmount = amountToTransfer * 1e9; // Convert to lamports (assuming 9 decimals)
      
      const yotMint = new PublicKey(config.tokens.YOT);
      const [programAuthority] = findProgramAuthorityAddress();
      
      // Get admin's YOT ATA
      const walletYotAta = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
      
      // Get or create program authority's YOT ATA
      const programYotAta = await getAssociatedTokenAddress(
        yotMint,
        programAuthority,
        true // Allow PDA as owner
      );
      
      // Transfer tokens directly from admin wallet to program's ATA
      const { transferWithSeedIx } = await import("@solana/spl-token");
      const { Transaction } = await import("@solana/web3.js");
      
      const tx = new Transaction();
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      
      // Check if the program ATA exists, if not create it
      const programAtaInfo = await connection.getAccountInfo(programYotAta);
      if (!programAtaInfo) {
        const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          programYotAta, // ata
          programAuthority, // owner
          yotMint // mint
        );
        tx.add(createAtaIx);
      }
      
      // Add the transfer instruction
      const { createTransferInstruction } = await import("@solana/spl-token");
      const transferIx = createTransferInstruction(
        walletYotAta, // source
        programYotAta, // destination
        wallet.publicKey, // owner
        BigInt(Math.floor(decimalAmount)) // amount
      );
      tx.add(transferIx);
      
      // Send the transaction
      const signature = await wallet.sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      
      toast({
        title: "YOT Transfer Successful",
        description: `Successfully transferred ${amountToTransfer} YOT to the program authority.`,
      });
      
      // Reset the input field
      setYotAmount("0");
      
      // Refresh balances
      refreshBalances();
    } catch (err: any) {
      console.error("Error funding YOT account:", err);
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: err.message || "Failed to transfer YOT tokens. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fundYosAccount = async () => {
    if (!wallet?.publicKey) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to fund the program.",
      });
      return;
    }

    if (parseFloat(yosAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0.",
      });
      return;
    }

    setLoading(true);
    try {
      // Load the multihub-contract-v3 module dynamically to avoid circular imports
      const multiHubModule = await import("@/lib/multihub-contract-v3");
      
      // Create the PDA's ATA and transfer tokens from admin wallet
      const amountToTransfer = parseFloat(yosAmount);
      const decimalAmount = amountToTransfer * 1e9; // Convert to lamports (assuming 9 decimals)
      
      const yosMint = new PublicKey(config.tokens.YOS);
      const [programAuthority] = findProgramAuthorityAddress();
      
      // Get admin's YOS ATA
      const walletYosAta = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
      
      // Get or create program authority's YOS ATA
      const programYosAta = await getAssociatedTokenAddress(
        yosMint,
        programAuthority,
        true // Allow PDA as owner
      );
      
      // Transfer tokens directly from admin wallet to program's ATA
      const { Transaction } = await import("@solana/web3.js");
      
      const tx = new Transaction();
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      
      // Check if the program ATA exists, if not create it
      const programAtaInfo = await connection.getAccountInfo(programYosAta);
      if (!programAtaInfo) {
        const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          programYosAta, // ata
          programAuthority, // owner
          yosMint // mint
        );
        tx.add(createAtaIx);
      }
      
      // Add the transfer instruction
      const { createTransferInstruction } = await import("@solana/spl-token");
      const transferIx = createTransferInstruction(
        walletYosAta, // source
        programYosAta, // destination
        wallet.publicKey, // owner
        BigInt(Math.floor(decimalAmount)) // amount
      );
      tx.add(transferIx);
      
      // Send the transaction
      const signature = await wallet.sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      
      toast({
        title: "YOS Transfer Successful",
        description: `Successfully transferred ${amountToTransfer} YOS to the program authority.`,
      });
      
      // Reset the input field
      setYosAmount("0");
      
      // Refresh balances
      refreshBalances();
    } catch (err: any) {
      console.error("Error funding YOS account:", err);
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: err.message || "Failed to transfer YOS tokens. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!wallet?.publicKey || wallet.publicKey.toString() !== config.admin) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only the admin wallet can access this panel.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Fund Program Token Accounts</span>
          </CardTitle>
          <CardDescription>
            Transfer tokens from admin wallet to program authority accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Program authority:</span>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{authority}</code>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshBalances}
                disabled={loadingBalances}
                className="flex items-center gap-1"
              >
                {loadingBalances ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Refresh Balances
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* YOT Account Funding */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Fund YOT Account</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Current balance:</span>
                  <span className="font-medium">{balances.yot.program} YOT</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Your wallet balance:</span>
                  <span>{balances.yot.wallet} YOT</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  value={yotAmount}
                  min="0"
                  step="1000"
                  onChange={(e) => setYotAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1"
                />
                <Button
                  onClick={fundYotAccount}
                  disabled={loading}
                  className="w-24"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fund"}
                </Button>
              </div>
            </div>

            {/* YOS Account Funding */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Fund YOS Account</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Current balance:</span>
                  <span className="font-medium">{balances.yos.program} YOS</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Your wallet balance:</span>
                  <span>{balances.yos.wallet} YOS</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  value={yosAmount}
                  min="0"
                  step="1000"
                  onChange={(e) => setYosAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1"
                />
                <Button
                  onClick={fundYosAccount}
                  disabled={loading}
                  className="w-24"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fund"}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-sm">
            <h4 className="font-medium mb-2">Usage Instructions</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Enter the amount of tokens you want to transfer to the program</li>
              <li>Click "Fund" to initiate the transfer transaction</li>
              <li>Approve the transaction in your wallet</li>
              <li>Once confirmed, the program's token balance will be updated</li>
            </ol>
            <div className="mt-2 text-amber-500">
              Note: You must have sufficient token balance in your admin wallet to fund the program.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}