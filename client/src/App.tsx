import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/context/WalletContext";
import { MultiWalletProvider } from "@/context/MultiWalletContext";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
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
import MultiHubSwapPage from "@/pages/MultiHubSwapPage";
import Home from "@/pages/Home"; // Keep for compatibility with existing routes

// Routes that should use the dashboard layout
const dashboardRoutes = [
  '/',
  '/swap',
  '/multi-hub-swap',
  '/stake',
  '/staking',
  '/liquidity',
  '/pool',
  '/analytics',
  '/wallet',
  '/admin',
  '/settings'
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MultiWalletProvider>
        <WalletProvider>
          <AdminAuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AdminAuthProvider>
        </WalletProvider>
      </MultiWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
