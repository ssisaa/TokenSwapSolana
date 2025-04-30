import { createContext, useState, useCallback, useEffect, ReactNode } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletError } from "@solana/wallet-adapter-base";
import { useToast } from "@/hooks/use-toast";
import { SOLANA_CLUSTER } from "@/lib/constants";

interface WalletContextType {
  wallet: PhantomWalletAdapter | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [wallet, setWallet] = useState<PhantomWalletAdapter | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  // Initialize wallet adapter
  useEffect(() => {
    const adapter = new PhantomWalletAdapter();
    setWallet(adapter);

    const onConnect = () => {
      setConnected(true);
      setConnecting(false);
      toast({
        title: "Wallet Connected",
        description: "Your wallet has been connected successfully.",
        variant: "default",
      });
    };

    const onDisconnect = () => {
      setConnected(false);
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
        variant: "default",
      });
    };

    const onError = (error: WalletError) => {
      setConnecting(false);
      toast({
        title: "Wallet Error",
        description: error.message,
        variant: "destructive",
      });
    };

    adapter.on('connect', onConnect);
    adapter.on('disconnect', onDisconnect);
    adapter.on('error', onError);

    return () => {
      adapter.off('connect', onConnect);
      adapter.off('disconnect', onDisconnect);
      adapter.off('error', onError);
      
      // Disconnect the wallet when unmounting
      if (adapter.connected) {
        adapter.disconnect().catch(console.error);
      }
    };
  }, [toast]);

  const connect = useCallback(async () => {
    if (!wallet) {
      toast({
        title: "Wallet Error",
        description: "Wallet adapter not initialized.",
        variant: "destructive",
      });
      return;
    }

    if (wallet.connected) {
      return;
    }

    try {
      setConnecting(true);
      await wallet.connect();
    } catch (error) {
      console.error("Error connecting wallet:", error);
      if (error instanceof Error) {
        toast({
          title: "Connection Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      setConnecting(false);
    }
  }, [wallet, toast]);

  const disconnect = useCallback(async () => {
    if (!wallet) return;

    try {
      await wallet.disconnect();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      if (error instanceof Error) {
        toast({
          title: "Disconnection Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  }, [wallet, toast]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        connected,
        connecting,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
