import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TestTokenTransfer from '@/components/MultiHubSwap/TestTokenTransfer';
import TokenBalanceMonitor from '@/components/MultiHubSwap/TokenBalanceMonitor';
import LiquidityPoolsChecker from '@/components/MultiHubSwap/LiquidityPoolsChecker';
import PoolLiquidityTable from '@/components/MultiHubSwap/PoolLiquidityTable';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { WalletContext } from "@/components/MultiWalletContext";

// Mock wallet for testing purposes
const mockWallet = {
  publicKey: { toString: () => "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ" },
  connected: true,
  connecting: false,
  connect: async () => console.log("Connected"),
  disconnect: async () => console.log("Disconnected"),
  signTransaction: async (tx: any) => {
    console.log("Mock sign transaction", tx);
    return tx;
  }
};

export default function TokenTestingPage() {
  const [activeTab, setActiveTab] = useState("token-transfer");
  
  return (
    <WalletContext.Provider value={{
      wallet: mockWallet,
      connected: true,
      connecting: false,
      connect: async () => console.log("Connected"),
      disconnect: async () => console.log("Disconnected")
    }}>
      <div className="container py-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
          Token Testing Utilities
        </h1>
        <p className="text-muted-foreground mb-6">
          Tools for testing token transfers, monitoring balances, and checking liquidity pools
        </p>
        
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-800" />
          <AlertTitle className="text-amber-800">Testing Mode</AlertTitle>
          <AlertDescription className="text-amber-700">
            These tools are provided for testing purposes only. They operate on Solana devnet with test tokens.
            Admin wallet: AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ | Test wallet: AZqjcFDjZRTHwsSmEtGtP4dKrCyusLb9BYXzq34BaPrn
          </AlertDescription>
        </Alert>
        
        <Tabs 
          defaultValue="token-transfer" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="token-transfer">Token Transfer</TabsTrigger>
            <TabsTrigger value="balance-monitor">Balance Monitor</TabsTrigger>
            <TabsTrigger value="liquidity-pools">Liquidity Pools</TabsTrigger>
            <TabsTrigger value="routes">Multi-Hub Routes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="token-transfer">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-1">
                <TestTokenTransfer />
              </div>
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Token Transfer Guide</CardTitle>
                    <CardDescription>
                      How to use the token transfer utility
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">1. Enter Recipient Address</h3>
                      <p className="text-muted-foreground">
                        Enter the Solana wallet address that will receive the tokens.
                        You can use the admin wallet or test wallet provided above.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">2. Select Tokens</h3>
                      <p className="text-muted-foreground">
                        Choose which test tokens to send. These tokens are set up for
                        testing swap routes with our multi-hub infrastructure.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">3. Set Amount</h3>
                      <p className="text-muted-foreground">
                        Specify how many tokens to send. The default of 1000 tokens
                        should be sufficient for testing. Larger amounts may be used
                        for stress testing.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Test Token Addresses</h3>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>MTA: MTAwpfGYQbnJkjB2iHUNpGV4yxkpJpgAQNHpg3ZJXKd</li>
                        <li>SAMX: SAMXjJJa4XShbsyK3ZK1qUKgHs45u8YUySGBbKctwKX</li>
                        <li>XAR: XAR18RSUr4pRGnmmM5Zz9vAz3EXmvWPx7cMuFB8mvCh</li>
                        <li>XMP: XMP9SXVv3Kj6JcnJEyLaQzYEuWEGsHjhJNpkha2Vk5M</li>
                        <li>RAMX: RAMXd3mgY5XFyWbfgNh9LT7BcuW5w7jqRFgNkwZEhhsu</li>
                        <li>TRAXX: TRXXpN1Y4tAYcfp3QxCKLeVDvUnjGWQvA2HTQ5VTytA</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="balance-monitor">
            <TokenBalanceMonitor />
          </TabsContent>
          
          <TabsContent value="liquidity-pools">
            <PoolLiquidityTable />
          </TabsContent>
          
          <TabsContent value="routes">
            <LiquidityPoolsChecker />
          </TabsContent>
        </Tabs>
      </div>
    </WalletContext.Provider>
  );
}