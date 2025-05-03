import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useToast } from '@/hooks/use-toast';

// Admin wallet address for Solana devnet
const ADMIN_WALLET_ADDRESS = "AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ";

interface AdminAuthContextType {
  isAdmin: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const { wallet, connected, publicKey } = useWallet();
  const { toast } = useToast();

  // Check if current wallet is the admin wallet
  useEffect(() => {
    if (connected && publicKey) {
      const isAuthorized = publicKey.toString() === ADMIN_WALLET_ADDRESS;
      setIsAdmin(isAuthorized);
      
      if (isAuthorized) {
        console.log('Admin wallet connected:', publicKey.toString());
      }
    } else {
      setIsAdmin(false);
    }
  }, [connected, publicKey]);

  const login = async (): Promise<boolean> => {
    try {
      if (connected) {
        if (publicKey?.toString() === ADMIN_WALLET_ADDRESS) {
          setIsAdmin(true);
          toast({
            title: "Admin Access Granted",
            description: "You are now authenticated as an administrator.",
          });
          return true;
        } else {
          toast({
            title: "Unauthorized",
            description: "The connected wallet is not authorized for admin access.",
            variant: "destructive",
          });
          return false;
        }
      } else {
        toast({
          title: "Connection Required",
          description: "Please connect your admin wallet first.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Admin authentication error:", error);
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate as admin. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = () => {
    setIsAdmin(false);
    toast({
      title: "Logged Out",
      description: "You have been logged out of admin access.",
    });
  };

  return (
    <AdminAuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}