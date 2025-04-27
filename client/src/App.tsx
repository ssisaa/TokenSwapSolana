import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/context/WalletContext";
import { MultiWalletProvider } from "@/context/MultiWalletContext";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Swap from "@/pages/Swap";
import Stake from "@/pages/Stake";
import Liquidity from "@/pages/Liquidity";
import Memes from "@/pages/Memes";
import Integration from "@/pages/Integration";
import AdminPage from "@/pages/AdminPage";
import Home from "@/pages/Home"; // Keep for compatibility with existing routes

function Router() {
  return (
    <div className="min-h-screen bg-dark-100">
      <Switch>
        {/* New Dashboard Routes */}
        <Route path="/" component={Dashboard} />
        <Route path="/swap" component={Swap} />
        <Route path="/stake" component={Stake} />
        <Route path="/liquidity" component={Liquidity} />
        <Route path="/memes" component={Memes} />
        
        {/* Admin route */}
        <Route path="/admin" component={AdminPage} />
        
        {/* Keep original routes for backward compatibility */}
        <Route path="/home" component={Home} />
        <Route path="/integration" component={Integration} />
        
        <Route component={NotFound} />
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
