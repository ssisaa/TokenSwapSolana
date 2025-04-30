import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link, useLocation } from "wouter";

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <Link href="/">
              <a className="text-xl font-bold">YOT Ecosystem</a>
            </Link>
            
            <nav className="hidden md:flex space-x-4">
              <NavLink href="/" isActive={location === "/"}>
                Home
              </NavLink>
              <NavLink href="/swap" isActive={location === "/swap"}>
                Swap
              </NavLink>
              <NavLink href="/staking" isActive={location === "/staking"}>
                Staking
              </NavLink>
              <NavLink href="/liquidity" isActive={location === "/liquidity"}>
                Liquidity
              </NavLink>
            </nav>
          </div>
          
          <WalletMultiButton />
        </div>
      </header>
      
      <main className="flex-1 bg-background">
        {children}
      </main>
      
      <footer className="bg-background border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 YOT Ecosystem. All rights reserved.</p>
          <p className="mt-2">
            <a 
              href="https://solana.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Built on Solana
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

interface NavLinkProps {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}

function NavLink({ href, isActive, children }: NavLinkProps) {
  return (
    <Link href={href}>
      <a className={`px-3 py-2 rounded-md transition-colors ${
        isActive 
          ? 'bg-primary/10 text-primary' 
          : 'text-foreground hover:bg-muted hover:text-foreground'
      }`}>
        {children}
      </a>
    </Link>
  );
}