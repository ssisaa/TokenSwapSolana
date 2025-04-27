import { useEffect } from "react";
import TokenCard from "@/components/TokenCard";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useTokenData } from "@/hooks/useTokenData";
import { 
  SOL_SYMBOL, 
  YOT_SYMBOL, 
  YOS_SYMBOL, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS 
} from "@/lib/constants";
import { formatDollarAmount } from "@/lib/utils";

export default function BalanceSection() {
  const { wallet, connected } = useWallet();
  const { balances, fetchBalances } = useTokenData();

  // Fetch token balances when wallet connects or changes
  useEffect(() => {
    if (connected && wallet?.publicKey) {
      fetchBalances(wallet.publicKey.toString());
    }
  }, [connected, wallet, fetchBalances]);

  // Fetch balances periodically
  useEffect(() => {
    if (connected && wallet?.publicKey) {
      const intervalId = setInterval(() => {
        fetchBalances(wallet.publicKey.toString());
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [connected, wallet, fetchBalances]);

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-white">Your Balances</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SOL Token Card */}
        <TokenCard
          symbol={SOL_SYMBOL}
          name="Solana"
          balance={balances.sol}
          additionalInfo={balances.solUsd ? formatDollarAmount(balances.solUsd) : ""}
          gradient="bg-gradient-to-br from-purple-900 to-purple-800"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 32 32" fill="currentColor">
              <path d="M22.6 12l-4.5-2.6l-4.6-2.7l-4.5-2.6V9l4.5 2.6v5.2l4.6 2.6v-5.2l4.5-2.6V12z M22.6 16.1l-4.5 2.6v5.2l4.5-2.6v-5.2z M27.2 14.8l-4.5 2.6v5.2l4.5-2.6v-5.2z M13.5 23.9l4.5 2.6v-5.2l-4.5-2.6v5.2z M9 21.3l4.5 2.6v-5.2L9 16.1v5.2z"></path>
            </svg>
          }
        />
        
        {/* YOT Token Card */}
        <TokenCard
          symbol={YOT_SYMBOL}
          name="YOT Token"
          balance={balances.yot}
          additionalInfo={balances.yotUsd ? formatDollarAmount(balances.yotUsd) : ""}
          address={YOT_TOKEN_ADDRESS}
          gradient="bg-gradient-to-br from-blue-900 to-blue-800"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        
        {/* YOS Token Card */}
        <TokenCard
          symbol={YOS_SYMBOL}
          name="YOS Staking Token"
          balance={balances.yos}
          additionalInfo={balances.yosUsd ? formatDollarAmount(balances.yosUsd) : ""}
          address={YOS_TOKEN_ADDRESS}
          gradient="bg-gradient-to-br from-green-900 to-green-800"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
      </div>
    </section>
  );
}
