import { useWallet } from "@/hooks/useSolanaWallet";
import { shortenAddress } from "@/lib/utils";
import { CLUSTER } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default function NetworkStatus() {
  const { connected, wallet, disconnect } = useWallet();

  return (
    <div style={{ backgroundColor: "var(--dark-100)" }} className="rounded-lg p-4 mb-6 flex items-center justify-between shadow-md">
      <div className="flex items-center">
        <div className="w-3 h-3 bg-green-500 rounded-full mr-3 pulse"></div>
        <span className="text-sm font-medium text-white">Connected to Solana {CLUSTER}</span>
      </div>
      
      {/* Wallet Info (shown when connected) */}
      {connected && wallet && (
        <div className="flex items-center">
          <span className="text-sm mr-2 text-white">{shortenAddress(wallet.publicKey.toString())}</span>
          <Button 
            variant="outline" 
            className="text-xs text-white border-gray-600 hover:bg-dark-400 py-1 px-2 rounded transition h-auto"
            onClick={disconnect}
          >
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
