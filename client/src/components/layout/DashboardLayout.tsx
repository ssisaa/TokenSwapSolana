import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import MultiWalletConnect from "@/components/MultiWalletConnect";
import HeaderWalletDisplay from "@/components/HeaderWalletDisplay";
import { useMultiWallet } from "@/context/MultiWalletContext";

type DashboardLayoutProps = {
  children: ReactNode;
  title?: string;
};

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { connected } = useMultiWallet();

  return (
    <div className="flex h-screen bg-dark-100">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Wallet Balance Bar */}
        {connected && <HeaderWalletDisplay />}
        
        {/* Top Bar */}
        <header className="bg-dark-200 border-b border-dark-400 py-3 px-6 flex items-center justify-between">
          {title && (
            <h1 className="text-xl font-semibold text-white">{title}</h1>
          )}
          <div className="ml-auto">
            <MultiWalletConnect />
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-dark-100 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}