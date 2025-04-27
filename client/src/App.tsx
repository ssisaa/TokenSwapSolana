import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/context/WalletContext";
import { MultiWalletProvider } from "@/context/MultiWalletContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Integration from "@/pages/Integration";
import ConnectionStatusBar from "@/components/ConnectionStatusBar";

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <ConnectionStatusBar />
      <div className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/integration" component={Integration} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MultiWalletProvider>
        <WalletProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </WalletProvider>
      </MultiWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
