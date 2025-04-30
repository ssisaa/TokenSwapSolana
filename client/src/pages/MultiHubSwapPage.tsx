import DashboardLayout from "@/components/layout/DashboardLayout";
import MultiHubSwapCard from "@/components/MultiHubSwap/MultiHubSwapCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMultiWallet } from "@/context/MultiWalletContext";

export default function MultiHubSwapPage() {
  const { connected } = useMultiWallet();
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Multi-Hub Swap</h1>
          <p className="text-muted-foreground">
            Swap tokens with automatic liquidity contribution and earn YOS rewards
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-1">
            <MultiHubSwapCard />
          </div>
          
          <div className="md:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
                <CardDescription>
                  Our multi-hub swap liquidity protocol
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Token Distribution</h3>
                  <p className="text-sm text-muted-foreground">
                    When you swap, your tokens are distributed as follows:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground pl-4 space-y-1">
                    <li><span className="font-medium">75%</span> goes directly to your wallet</li>
                    <li><span className="font-medium">20%</span> is contributed to the liquidity pool</li>
                    <li><span className="font-medium">5%</span> is given as YOS token cashback</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-medium">Weekly YOS Rewards</h3>
                  <p className="text-sm text-muted-foreground">
                    For every contribution to liquidity, you'll earn weekly YOS rewards:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground pl-4 space-y-1">
                    <li>Rewards are claimable once per week</li>
                    <li>100% APR paid weekly in YOS tokens</li>
                    <li>Rewards scale with your contribution amount</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-medium">Liquidity Benefits</h3>
                  <p className="text-sm text-muted-foreground">
                    By participating in this program, you help:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground pl-4 space-y-1">
                    <li>Increase market liquidity and reduce slippage</li>
                    <li>Stabilize token prices during high volume</li>
                    <li>Support the ecosystem's growth</li>
                  </ul>
                </div>
                
                {!connected && (
                  <div className="bg-muted p-4 rounded-lg mt-6">
                    <p className="text-sm font-medium">Connect your wallet to start swapping and earning rewards!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}