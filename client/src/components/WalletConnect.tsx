import { Button } from "@/components/ui/button";
import { WalletIcon } from "lucide-react";
import { useWallet } from "@/hooks/useSolanaWallet";

export default function WalletConnect() {
  const { connected, connect, disconnect } = useWallet();

  return (
    <Button
      className="bg-gradient-to-r from-primary-600 to-blue-700 hover:from-primary-700 hover:to-blue-800 text-white font-medium py-3 px-6 rounded-lg transition duration-200 flex items-center shadow-lg"
      onClick={connected ? disconnect : connect}
    >
      <WalletIcon className="h-5 w-5 mr-2" />
      <span className="text-lg">{connected ? "Disconnect" : "Connect Wallet"}</span>
    </Button>
  );
}
