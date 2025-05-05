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
import ProgramFundingPage from "@/pages/admin-page";
import TestPage from "@/pages/TestPage";
import TokenTestingPage from "@/pages/TokenTestingPage";
import MultiHubSwapPage from "@/pages/MultiHubSwapPage";
import CashbackSwapPage from "@/pages/CashbackSwapPage";
import AdvancedSwapPage from "@/pages/AdvancedSwapPage";
import TransactionDebugPage from "@/pages/TransactionDebugPage";
import FixedSwapTestPage from "@/pages/FixedSwapTestPage";
import MultihubV3AdminPage from "@/pages/MultihubV3AdminPage";
import Analytics from "@/pages/Analytics";
import WalletPage from "@/pages/WalletPage";
import SettingsPage from "@/pages/SettingsPage";
import AffiliatePage from "@/pages/AffiliatePage";
import LandingPage from "@/pages/LandingPage";
import MockSwapPage from "@/pages/MockSwapPage"; // Our new reliable mock swap page
import SimpleSwapPage from "@/pages/SimpleSwapPage"; // Pure demo swap page with no Solana dependencies
import FixedSwapPage from "@/pages/FixedSwapPage"; // Our optimized swap page that handles crypto module issues
import MultihubAdminPage from "@/pages/MultihubAdminPage"; // Admin page with program initialization
import Home from "@/pages/Home"; // Keep for compatibility with existing routes
import MultihubV3DebugPanel from "@/components/MultihubV3DebugPanel"; // Debug panel for program authority verification

// Routes that should use the dashboard layout
const dashboardRoutes = [
  '/',
  '/dashboard',
  '/swap',
  '/multi-hub-swap',
  '/cashback-swap',
  '/mock-swap',     // Our new mock swap page
  '/advanced-swap',
  '/tx-debug',
  '/stake',
  '/staking',
  '/liquidity',
  '/pool',
  '/analytics',
  '/wallet',
  '/admin',
  '/multihub-v3-admin',
  '/multihub-v3-debug', // Debug panel for program authority verification
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

        <Route path="/fixed-swap">
          <DashboardLayout>
            <FixedSwapPage />
          </DashboardLayout>
        </Route>

        <Route path="/multihub-v3-admin">
          <DashboardLayout>
            <MultihubV3AdminPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/multihub-v3-debug">
          <DashboardLayout>
            <div className="container mx-auto px-4 py-8">
              <h1 className="text-2xl font-bold mb-6">MultihubSwap V3 Debug Panel</h1>
              <MultihubV3DebugPanel />
            </div>
          </DashboardLayout>
        </Route>
        
        <Route path="/multihub-admin">
          <DashboardLayout>
            <MultihubAdminPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/program-funding">
          <DashboardLayout>
            <ProgramFundingPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/mock-swap">
          <DashboardLayout>
            <MockSwapPage />
          </DashboardLayout>
        </Route>
        
        <Route path="/simple-swap">
          <DashboardLayout>
            <SimpleSwapPage />
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
  const { connect, connecting, connected, wallets } = useMultiWallet();
  
  useEffect(() => {
    console.log("Auto-connect effect running");
    
    if (!connected && !connecting) {
      // Check for available wallets first
      const availableWallets = wallets.filter(w => w.installed);
      
      if (availableWallets.length > 0) {
        // Prefer Phantom wallet if installed, otherwise use the first available wallet
        const preferredWallet = availableWallets.find(w => w.name === "Phantom") || availableWallets[0];
        console.log(`Attempting to auto-connect to ${preferredWallet.name}`);
        
        connect(preferredWallet.name).catch((err: Error) => {
          console.log(`Auto-connect to ${preferredWallet.name} failed:`, err.message);
        });
      } else {
        console.log("No wallets detected for auto-connect. Please install Phantom or another Solana wallet.");
      }
    }
  }, [connect, connecting, connected, wallets]);
  
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
