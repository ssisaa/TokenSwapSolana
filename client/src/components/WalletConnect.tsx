import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";
import { useWallet } from "@/hooks/useSolanaWallet";

export default function WalletConnect() {
  const { connected, connect, disconnect } = useWallet();

  return (
    <Button
      className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center"
      onClick={connected ? disconnect : connect}
    >
      <span>{connected ? "Disconnect" : "Connect Wallet"}</span>
      <ArrowRightIcon className="h-5 w-5 ml-2" />
    </Button>
  );
}
