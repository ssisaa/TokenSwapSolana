import { createContext, useContext, useState, ReactNode } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useToast } from '@/hooks/use-toast';

// Admin wallet address
export const ADMIN_WALLET_ADDRESS = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

interface AdminAuthContextType {
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { wallet, connect } = useMultiWallet();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Check if the current wallet is the admin wallet
  const checkAdminStatus = () => {
    if (!wallet?.publicKey) return false;
    
    const currentWalletAddress = wallet.publicKey.toString();
    return currentWalletAddress === ADMIN_WALLET_ADDRESS;
  };
  
  // Try to log in as admin
  const login = async () => {
    try {
      // First try to connect if not already connected
      if (!wallet) {
        await connect();
      }
      
      // Check if current wallet is admin
      const isAdminWallet = checkAdminStatus();
      setIsAdmin(isAdminWallet);
      
      if (isAdminWallet) {
        toast({
          title: 'Admin Access Granted',
          description: 'You are now logged in as admin.',
        });
      } else {
        toast({
          title: 'Admin Access Denied',
          description: `Please connect with the admin wallet (${ADMIN_WALLET_ADDRESS.slice(0, 6)}...${ADMIN_WALLET_ADDRESS.slice(-6)})`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Admin login error:', error);
      toast({
        title: 'Admin Login Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  // Log out
  const logout = () => {
    setIsAdmin(false);
    toast({
      title: 'Logged Out',
      description: 'You are no longer logged in as admin.',
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