import { useContext } from "react";
import { WalletContext } from "@/context/WalletContext";
import { MultiWalletContext } from "@/context/MultiWalletContext";

export function useWallet() {
  // First, try to get the multi-wallet context
  const multiWalletContext = useContext(MultiWalletContext);
  
  // If multi-wallet context is available, use it
  if (multiWalletContext) {
    return {
      wallet: multiWalletContext.wallet,
      connected: multiWalletContext.connected,
      connecting: multiWalletContext.connecting,
      connect: multiWalletContext.connect,
      disconnect: multiWalletContext.disconnect,
      publicKey: multiWalletContext.publicKey || null
    };
  }
  
  // Fall back to the original wallet context if multi-wallet isn't available
  const context = useContext(WalletContext);
  
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider or MultiWalletProvider");
  }
  
  return context;
}
