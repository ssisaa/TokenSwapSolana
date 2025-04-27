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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/integration" component={Integration} />
      <Route component={NotFound} />
    </Switch>
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
