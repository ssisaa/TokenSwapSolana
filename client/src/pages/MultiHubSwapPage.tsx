import DashboardLayout from "@/components/layout/DashboardLayout";
import EnhancedMultiHubSwapCard from "@/components/MultiHubSwap/EnhancedMultiHubSwapCard";
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
        
        {/* Main swap interface with chart */}
        <EnhancedMultiHubSwapCard />
        
        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Token Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When you swap, your tokens are distributed as follows:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground pl-4 space-y-1">
                <li><span className="font-medium">75%</span> goes directly to your wallet</li>
                <li><span className="font-medium">20%</span> is contributed to the liquidity pool</li>
                <li><span className="font-medium">5%</span> is given as YOS token cashback</li>
                <li><span className="font-medium">0.1%</span> SOL commission to owner wallet</li>
              </ul>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weekly YOS Rewards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For every contribution to liquidity, you'll earn weekly YOS rewards:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground pl-4 space-y-1">
                <li>Rewards are claimable once per week</li>
                <li>100% APR paid weekly in YOS tokens</li>
                <li>Rewards scale with your contribution amount</li>
              </ul>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Multi-Hub Benefits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Our multi-hub system provides these advantages:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground pl-4 space-y-1">
                <li>Auto-switching between Jupiter & Raydium</li>
                <li>Lower slippage with improved liquidity</li>
                <li>Higher success rate on swap transactions</li>
                <li>Everything processed on-chain for security</li>
              </ul>
            </CardContent>
          </Card>
        </div>
        
        {!connected && (
          <div className="bg-muted p-4 rounded-lg mt-6">
            <p className="text-sm font-medium">Connect your wallet to start swapping and earning rewards!</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}