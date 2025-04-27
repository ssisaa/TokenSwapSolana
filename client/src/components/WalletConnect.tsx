import { useMultiWallet } from "@/context/MultiWalletContext";
import MultiWalletConnect from "@/components/MultiWalletConnect";

// This is a wrapper component that provides compatibility with existing code
// It redirects to our new MultiWalletConnect component
export default function WalletConnect() {
  return <MultiWalletConnect />;
}
