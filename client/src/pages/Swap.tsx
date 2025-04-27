import DashboardLayout from "@/components/layout/DashboardLayout";
import SwapSection from "@/components/SwapSection";
import TokenInfo from "@/components/TokenInfo";
import TransactionHistory from "@/components/TransactionHistory";

export default function Swap() {
  return (
    <DashboardLayout title="Swap (Buy/Sell)">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SwapSection />
            <TransactionHistory />
          </div>
          <div className="space-y-6">
            <TokenInfo />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}