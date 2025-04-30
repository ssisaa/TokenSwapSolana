import EnhancedMultiHubSwapCard from "@/components/MultiHubSwap/EnhancedMultiHubSwapCard";

export default function MultiHubSwapPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">MultiHub Swap</h1>
        <p className="text-muted-foreground mb-8">
          Swap any token for YOT with automatic liquidity contribution and YOS cashback rewards.
          20% of your swap automatically strengthens the SOL-YOT pool with 50/50 split.
        </p>
        
        <EnhancedMultiHubSwapCard />
      </div>
    </div>
  );
}