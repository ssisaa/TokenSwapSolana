import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TestTokenTransfer from '@/components/MultiHubSwap/TestTokenTransfer';
import LiquidityPoolsChecker from '@/components/MultiHubSwap/LiquidityPoolsChecker';
import PoolLiquidityTable from '@/components/MultiHubSwap/PoolLiquidityTable';
import TokenBalanceMonitor from '@/components/MultiHubSwap/TokenBalanceMonitor';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ENDPOINT, TEST_TOKENS } from '@/lib/constants';

export default function TokenTestingPage() {
  const [activeTab, setActiveTab] = useState("token-transfer");
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
    <DashboardLayout>
      <div className="flex flex-col space-y-8 p-8">
        <div>
          <h2 className="text-3xl font-bold">Token Testing Tools</h2>
          <p className="text-muted-foreground mt-2">
            Tools for testing the token swap functionality with devnet tokens
          </p>
        </div>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            These tools are intended for testing the multi-hub swap functionality on Solana devnet.
            The tokens created are for testing purposes only.
          </AlertDescription>
        </Alert>
        
        <Tabs defaultValue="token-transfer" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 md:w-[400px]">
            <TabsTrigger value="token-transfer">Token Transfer</TabsTrigger>
            <TabsTrigger value="pool-checker">Pool Checker</TabsTrigger>
            <TabsTrigger value="pool-liquidity">Pool Liquidity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="token-transfer" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TestTokenTransfer />
              
              <Card>
                <CardHeader>
                  <CardTitle>Token Testing Instructions</CardTitle>
                  <CardDescription>
                    How to test the multi-hub swap functionality
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ol className="list-decimal list-inside space-y-3">
                      <li>Connect your wallet using the wallet button in the top right</li>
                      <li>Use the Token Transfer tab to send test tokens to your wallet</li>
                      <li>Check the Pool Checker tab to verify liquidity pools are available</li>
                      <li>Go to the Multi-Hub Swap page to test token swaps</li>
                    </ol>
                    
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Important: You need SOL in your wallet to pay for transaction fees. Use the Solana Devnet faucet to get some SOL.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="pt-4">
                      <h4 className="font-medium mb-2">Available Test Tokens:</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.keys(TEST_TOKENS).map(token => (
                          <div key={token} className="bg-secondary rounded p-2 text-center">
                            {token}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="pool-checker" className="mt-6">
            <LiquidityPoolsChecker />
          </TabsContent>
          
          <TabsContent value="pool-liquidity" className="mt-6">
            <PoolLiquidityTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}