import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import * as MultihubContractV3 from '@/lib/multihub-contract-v3';
import { useConnection } from '@solana/wallet-adapter-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getTokenBalance } from '@/lib/solana';
import { config } from '@/lib/config';
import { Transaction } from '@solana/web3.js';

export default function ProgramSetupPanel() {
  const { toast } = useToast();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState('1000');
  const [isBusy, setIsBusy] = useState(false);
  const [programAuthority, setProgramAuthority] = useState('');
  const [programYotBalance, setProgramYotBalance] = useState('0');
  const [hasTokenAccount, setHasTokenAccount] = useState(false);
  
  // Get YOT token mint from config
  const YOT_TOKEN_MINT = config.tokens.YOT;

  const refreshProgramState = async () => {
    if (!connection || !wallet || !wallet.publicKey) return;

    try {
      // Get program authority PDA
      const [authorityPda] = MultihubContractV3.findProgramAuthorityAddress();
      setProgramAuthority(authorityPda.toBase58());

      // Find the token account for YOT that belongs to the PDA
      const yotMint = new PublicKey(YOT_TOKEN_MINT);
      const tokenAccountAddress = await getAssociatedTokenAddress(
        yotMint,
        authorityPda,
        true // allowOwnerOffCurve for PDAs
      );

      try {
        // Check if token account exists and get its balance
        const balance = await getTokenBalance(connection, tokenAccountAddress);
        setProgramYotBalance(balance.toLocaleString());
        setHasTokenAccount(true);
      } catch (err) {
        console.warn("Token account doesn't exist yet:", err);
        setProgramYotBalance('0');
        setHasTokenAccount(false);
      }
    } catch (err) {
      console.error("Error checking program state:", err);
    }
  };

  useEffect(() => {
    refreshProgramState();
  }, [connection, wallet]);

  const handleCreateTokenAccount = async () => {
    if (!connection || !wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    setIsBusy(true);
    try {
      const [authorityPda] = MultihubContractV3.findProgramAuthorityAddress();
      const yotMint = new PublicKey(YOT_TOKEN_MINT);

      // Create the token account
      const tx = new Transaction();
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // This will create the account if it doesn't exist
      console.log("Creating token account for program authority:", authorityPda.toBase58());
      const pdaTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction
        } as any,
        yotMint,
        authorityPda,
        true // allowOwnerOffCurve
      );

      toast({
        title: "Token Account Created",
        description: `Created token account: ${pdaTokenAccount.address.toBase58()}`,
      });

      await refreshProgramState();
    } catch (err) {
      console.error("Error creating token account:", err);
      toast({
        title: "Error Creating Token Account",
        description: err.message || "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleFundProgram = async () => {
    if (!connection || !wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to send",
        variant: "destructive"
      });
      return;
    }

    setIsBusy(true);
    try {
      const parsedAmount = parseFloat(amount);
      const [authorityPda] = MultihubContractV3.findProgramAuthorityAddress();
      const yotMint = new PublicKey(YOT_TOKEN_MINT);

      // Get sender token account
      const userTokenAccount = await getAssociatedTokenAddress(
        yotMint,
        wallet.publicKey
      );

      // Get program token account
      const pdaTokenAccount = await getAssociatedTokenAddress(
        yotMint,
        authorityPda,
        true // allowOwnerOffCurve
      );

      // Create transaction
      const tx = new Transaction();
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // Calculate token amount with decimals (9 decimals for YOT)
      const amountToSend = BigInt(Math.floor(parsedAmount * Math.pow(10, 9)));

      // Add transfer instruction
      tx.add(
        createTransferInstruction(
          userTokenAccount,
          pdaTokenAccount,
          wallet.publicKey,
          amountToSend
        )
      );

      // Sign and send transaction
      const signature = await wallet.sendTransaction(tx, connection);
      console.log("Transaction sent:", signature);

      toast({
        title: "Funding Successful",
        description: `Sent ${parsedAmount} YOT to the program. Transaction: ${signature.substring(0, 8)}...`,
      });

      // Refresh balance
      await refreshProgramState();
    } catch (err) {
      console.error("Error funding program:", err);
      toast({
        title: "Error Funding Program",
        description: err.message || "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Program Setup</CardTitle>
        <CardDescription>Initialize and fund the program for SOL→YOT swaps</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Program Authority (PDA)</h3>
            <p className="text-xs break-all">{programAuthority || 'Loading...'}</p>
            
            <h3 className="text-sm font-medium mt-3 mb-2">YOT Token Account</h3>
            <p className="text-xs mb-1">{hasTokenAccount ? 'Created ✓' : 'Not created yet'}</p>
            
            <h3 className="text-sm font-medium mt-3 mb-2">Current YOT Balance</h3>
            <p className="text-lg font-bold">{programYotBalance} YOT</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount to Fund (YOT)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter YOT amount"
              disabled={isBusy}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        {!hasTokenAccount && (
          <Button 
            onClick={handleCreateTokenAccount}
            disabled={isBusy}
            className="w-full"
            variant="outline"
          >
            {isBusy ? 'Creating...' : 'Create Token Account'}
          </Button>
        )}
        
        <Button 
          onClick={handleFundProgram}
          disabled={isBusy || !hasTokenAccount}
          className="w-full"
        >
          {isBusy ? 'Funding...' : 'Fund Program'}
        </Button>
      </CardFooter>
    </Card>
  );
}