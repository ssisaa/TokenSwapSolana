import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMultiWallet } from '@/context/MultiWalletContext';
import { uiToRawTokenAmount, getWalletAdjustedYosAmount } from '@/lib/solana-staking';
import { 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS,
  YOT_DECIMALS,
  YOS_DECIMALS
} from '@/lib/constants';
import { createTransferInstruction } from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { connection } from '@/lib/solana-staking';
import { toast } from '@/hooks/use-toast';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// This component creates a test transaction to verify wallet display amounts
export function TestTokenDisplay() {
  const { wallet, connected } = useMultiWallet();
  const [yotAmount, setYotAmount] = useState('1000');
  const [yosAmount, setYosAmount] = useState('100');
  const [displayDivisor, setDisplayDivisor] = useState('17000');
  const [testResult, setTestResult] = useState<string>('');
  
  // Create a transaction with display-only instructions (source = destination)
  // This will show in the wallet confirmation screen but not actually transfer tokens
  const testWalletDisplay = async () => {
    if (!wallet || !connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setTestResult('');
      
      const walletPublicKey = wallet.publicKey;
      const divisor = parseInt(displayDivisor);
      
      if (!walletPublicKey) {
        throw new Error('Wallet not connected');
      }
      
      // Convert amounts
      const yotValue = parseFloat(yotAmount);
      const yosValue = parseFloat(yosAmount);
      
      // Create transaction
      const transaction = new Transaction();
      
      // For YOT token (integer display)
      try {
        const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
        const userYotATA = await getAssociatedTokenAddress(yotMint, walletPublicKey);
        
        // EMERGENCY FIX FOR 1000.01 ISSUE
        // ABSOLUTELY NO DECIMAL CONVERSION, USE DIRECT INTEGER VALUE
        // Convert to a string integer, then to BigInt with direct multiplication
        const integerYotValue = Math.floor(yotValue);
        
        // DIRECT BIGINT CONVERSION: 1000 → 1000000000000
        // YOT has 9 decimals, so we multiply by 10^9
        const rawDecimals = 1000000000; // 10^9 (9 decimals)
        const yotTokenAmount = BigInt(integerYotValue) * BigInt(rawDecimals);
        
        console.log(`FIXED YOT DISPLAY: Using proper decimal conversion: ${yotValue} YOT → ${yotTokenAmount} (with ${YOT_DECIMALS} decimals)`);
        
        // Create a "display-only" instruction (source = destination = user ATA)
        const yotDisplayInstruction = createTransferInstruction(
          userYotATA,           // source (user)
          userYotATA,           // destination (same user - no actual transfer)
          walletPublicKey,      // owner (user can sign)
          yotTokenAmount,      // EXACT INTEGER AMOUNT - NO DECIMALS
          [],                   // multisigners
          TOKEN_PROGRAM_ID      // programId
        );
        
        transaction.add(yotDisplayInstruction);
        console.log(`YOT Display FIXED: ${yotValue} → raw amount ${yotTokenAmount} (direct integer)`);
        
        setTestResult(prev => prev + `\nTest YOT display (FIXED): ${yotValue} → ${yotTokenAmount} (direct integer value)`);
      } catch (e) {
        console.error("YOT display instruction failed:", e);
        setTestResult(prev => prev + `\nYOT failed: ${e}`);
      }
      
      // For YOS token (using our new wallet display adjustment utility)
      try {
        const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
        const userYosATA = await getAssociatedTokenAddress(yosMint, walletPublicKey);
        
        // Method 1: Manual adjustment (legacy approach)
        const yosTokenAmount = uiToRawTokenAmount(yosValue, YOS_DECIMALS);
        const adjustedYosAmount = BigInt(Number(yosTokenAmount) / divisor);
        
        // Method 2: Using our new utility function (recommended approach)
        const walletAdjustedAmount = getWalletAdjustedYosAmount(yosValue);
        
        // Use the utility function result for the actual transaction
        const yosDisplayInstruction = createTransferInstruction(
          userYosATA,           // source (user)
          userYosATA,           // destination (same user - no actual transfer)
          walletPublicKey,      // owner (user can sign)
          walletAdjustedAmount, // amount from our specialized utility function
          [],                   // multisigners
          TOKEN_PROGRAM_ID      // programId
        );
        
        transaction.add(yosDisplayInstruction);
        console.log(`YOS Display with new utility: ${yosValue} → ${walletAdjustedAmount}`);
        
        setTestResult(prev => prev + `
Test YOS display:
- Original amount: ${yosValue} YOS
- Raw token amount: ${yosTokenAmount}
- Manual adjusted (1/${divisor}): ${adjustedYosAmount}
- Using new utility: ${walletAdjustedAmount}
`);
      } catch (e) {
        console.error("YOS display instruction failed:", e);
        setTestResult(prev => prev + `\nYOS failed: ${e}`);
      }
      
      // Sign and send the transaction
      if (transaction.instructions.length > 0) {
        setTestResult(prev => prev + "\n\nSending transaction to wallet...");
        
        const signature = await wallet.sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');
        
        setTestResult(prev => prev + `\nTransaction confirmed: ${signature}`);
      } else {
        setTestResult("No display instructions could be added.");
      }
    } catch (error: any) {
      console.error('Error testing wallet display:', error);
      setTestResult(`Error: ${error.message || 'Unknown error'}`);
      
      toast({
        title: "Test failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="p-6 border rounded-lg max-w-lg mx-auto space-y-4">
      <h3 className="text-xl font-bold">Test Token Display in Wallet</h3>
      <p className="text-sm text-muted-foreground">
        This tool creates a test transaction that doesn't actually transfer any tokens,
        but shows how amounts will appear in the wallet confirmation screen.
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">YOT Amount</label>
          <Input
            type="number"
            value={yotAmount}
            onChange={e => setYotAmount(e.target.value)}
            placeholder="YOT amount (e.g. 1000)"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium">YOS Amount</label>
          <Input
            type="number"
            value={yosAmount}
            onChange={e => setYosAmount(e.target.value)}
            placeholder="YOS amount (e.g. 100)"
          />
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">YOS Display Divisor</label>
        <Input
          type="number"
          value={displayDivisor}
          onChange={e => setDisplayDivisor(e.target.value)}
          placeholder="Divisor (default: 17000)"
        />
        <p className="text-xs text-muted-foreground mt-1">
          This divides the YOS token amount to fix million display issue.
          Higher values = smaller display amounts. Current: 1/{displayDivisor}
        </p>
      </div>
      
      <Button 
        onClick={testWalletDisplay}
        disabled={!connected}
        className="w-full"
      >
        Test Wallet Display
      </Button>
      
      {testResult && (
        <pre className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap">
          {testResult}
        </pre>
      )}
    </div>
  );
}