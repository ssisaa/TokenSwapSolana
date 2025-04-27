import { useEffect } from "react";
import Header from "@/components/Header";
import BalanceSection from "@/components/BalanceSection";
import SwapSection from "@/components/SwapSection";
import TransactionHistory from "@/components/TransactionHistory";
import TokenInfo from "@/components/TokenInfo";
import NetworkStatus from "@/components/NetworkStatus";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useTokenData } from "@/hooks/useTokenData";

export default function Home() {
  const { wallet, connect } = useWallet();
  const { fetchTokenInfo } = useTokenData();

  useEffect(() => {
    // Fetch token info when component mounts
    fetchTokenInfo();
  }, [fetchTokenInfo]);

  return (
    <div style={{ backgroundColor: "var(--dark-200)" }} className="text-white min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Header />
        
        <NetworkStatus />
        
        <BalanceSection />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SwapSection />
          <TransactionHistory />
        </div>
        
        <TokenInfo />
      </div>
    </div>
  );
}
