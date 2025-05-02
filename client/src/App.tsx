import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/context/WalletContext";
import { MultiWalletProvider, useMultiWallet } from "@/context/MultiWalletContext";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { useEffect } from "react";

// Solana wallet adapter
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { SOLANA_CLUSTER } from "@/lib/constants";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Swap from "@/pages/Swap";
import Stake from "@/pages/Stake";
import Liquidity from "@/pages/Liquidity";
import Memes from "@/pages/Memes";
import Integration from "@/pages/Integration";
import AdminPage from "@/pages/AdminPage";
import TestPage from "@/pages/TestPage";
import TokenTestingPage from "@/pages/TokenTestingPage";
import MultiHubSwapPage from "@/pages/MultiHubSwapPage";
import CashbackSwapPage from "@/pages/CashbackSwapPage";
import AdvancedSwapPage from "@/pages/AdvancedSwapPage";
import TransactionDebugPage from "@/pages/TransactionDebugPage";
import Analytics from "@/pages/Analytics";
import WalletPage from "@/pages/WalletPage";
import SettingsPage from "@/pages/SettingsPage";
import AffiliatePage from "@/pages/AffiliatePage";
import LandingPage from "@/pages/LandingPage";
import Home from "@/pages/Home"; // Keep for compatibility with existing routes

// Routes that should use the dashboard layout
const dashboardRoutes = [
  '/',
  '/dashboard',
  '/swap',
  '/multi-hub-swap',
  '/cashback-swap',
  '/advanced-swap',
  '/tx-debug',
  '/stake',
  '/staking',
  '/liquidity',
  '/pool',
  '/analytics',
  '/wallet',
  '/admin',
  '/settings',
  '/affiliate',
  '/memes'
];

function Router() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Switch>
        {/* Dashboard Layout Routes */}
        <Route path="/">
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </Route>
        <Route path="/swap">
          <DashboardLayout>
            <Swap />
          </DashboardLayout>
        </Route>
        <Route path="/multi-hub-swap">
          <DashboardLayout>
            <MultiHubSwapPage />
          </DashboardLayout>
        </Route>
        <Route path="/cashback-swap">
          <DashboardLayout>
            <CashbackSwapPage />
          </DashboardLayout>
        </Route>
        <Route path="/stake">
          <DashboardLayout>
            <Stake />
          </DashboardLayout>
        </Route>
        <Route path="/staking">
          <DashboardLayout>
            <Stake />
          </DashboardLayout>
        </Route>
        <Route path="/liquidity">
          <DashboardLayout>
            <Liquidity />
          </DashboardLayout>
        </Route>
        <Route path="/pool">
          <DashboardLayout>
            <Liquidity />
          </DashboardLayout>
        </Route>
        <Route path="/memes">
          <DashboardLayout>
            <Memes />
          </DashboardLayout>
        </Route>
        <Route path="/admin">
          <DashboardLayout>
            <AdminPage />
          </DashboardLayout>
        </Route>
        <Route path="/test">
          <DashboardLayout>
            <TestPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/token-testing">
          <DashboardLayout>
            <TokenTestingPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/analytics">
          <DashboardLayout>
            <Analytics />
          </DashboardLayout>
        </Route>
        
        <Route path="/wallet">
          <DashboardLayout>
            <WalletPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/settings">
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/affiliate">
          <DashboardLayout>
            <AffiliatePage />
          </DashboardLayout>
        </Route>

        <Route path="/advanced-swap">
          <DashboardLayout>
            <AdvancedSwapPage />
          </DashboardLayout>
        </Route>

        <Route path="/tx-debug">
          <DashboardLayout>
            <TransactionDebugPage />
          </DashboardLayout>
        </Route>
        
        {/* Landing page as root, with dashboard accessible via /dashboard */}
        <Route path="/landing">
          <LandingPage />
        </Route>

        {/* Legacy routes without dashboard layout */}
        <Route path="/home">
          <Home />
        </Route>
        <Route path="/integration">
          <Integration />
        </Route>
        
        {/* 404 Route */}
        <Route>
          <DashboardLayout>
            <NotFound />
          </DashboardLayout>
        </Route>
      </Switch>
    </div>
  );
}

function AutoConnectWallet() {
  const { connect, connecting, connected } = useMultiWallet();
  
  useEffect(() => {
    console.log("Auto-connect effect running");
    
    if (!connected && !connecting) {
      // Try to auto-connect to the demo wallet for testing
      console.log("Attempting to auto-connect to Demo Wallet");
      connect("Demo Wallet").catch((err: Error) => {
        console.error("Auto-connect error:", err);
      });
    }
  }, [connect, connecting, connected]);
  
  return null;
}

function App() {
  // Set up Solana connection
  const network = SOLANA_CLUSTER; // "devnet" or "mainnet-beta"
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  
  // Set up supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Standard Solana wallet adapter context */}
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            {/* Custom wallet contexts */}
            <MultiWalletProvider>
              <WalletProvider>
                <AdminAuthProvider>
                  <TooltipProvider>
                    <Toaster />
                    <AutoConnectWallet />
                    <Router />
                  </TooltipProvider>
                </AdminAuthProvider>
              </WalletProvider>
            </MultiWalletProvider>
          </WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}

export default App;
