import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ENDPOINT } from '@/lib/constants';

export default function TokenTestingPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Function to fetch and display token balances
  const fetchTokenBalances = async (address: string) => {
    if (!address) return;
    
    try {
      setLoadingBalances(true);
      const connection = new Connection(ENDPOINT);
      
      // Try to validate the address first
      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(address);
      } catch (e) {
        throw new Error('Invalid wallet address format');
      }
      
      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      
      // For now, just display the SOL balance
      setTokenBalances({
        SOL: solBalance / LAMPORTS_PER_SOL
      });
      
      setWalletAddress(address);
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  return (
    <div className="flex flex-col space-y-8 p-8">
      <div>
        <h2 className="text-3xl font-bold">Token Testing Tools</h2>
        <p className="text-muted-foreground mt-2">
          Tools for testing token functionality with devnet tokens
        </p>
      </div>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Note: The swap functionality has been temporarily disabled for maintenance.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Token Testing Information</CardTitle>
          <CardDescription>
            Testing tools for Solana token operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ol className="list-decimal list-inside space-y-3">
              <li>Connect your wallet using the wallet button in the top right</li>
              <li>Use Solana Devnet faucet to receive test SOL</li>
              <li>View your wallet balances in the Wallet page</li>
            </ol>
            
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Important: You need SOL in your wallet to pay for transaction fees. Use the Solana Devnet faucet to get some SOL.
              </AlertDescription>
            </Alert>
            
            <div className="mt-6">
              <Button
                onClick={() => window.open('https://solfaucet.com/', '_blank')}
                className="w-full"
              >
                Open Solana Devnet Faucet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}