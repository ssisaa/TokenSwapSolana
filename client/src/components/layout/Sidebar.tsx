import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, BarChart2, RefreshCw, Coins, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
  subLabel?: string;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: <Home className="h-5 w-5" />,
    href: "/",
  },
  {
    label: "Swap",
    icon: <RefreshCw className="h-5 w-5" />,
    href: "/swap",
    subLabel: "buy/sell",
  },
  {
    label: "Stake",
    icon: <BarChart2 className="h-5 w-5" />,
    href: "/stake",
  },
  {
    label: "Liquidity",
    icon: <Coins className="h-5 w-5" />,
    href: "/liquidity",
  },
  {
    label: "Memes",
    icon: <MessageCircle className="h-5 w-5" />,
    href: "/memes",
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div 
      className={cn(
        "bg-dark-200 h-screen transition-all duration-300 flex flex-col border-r border-dark-400",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 flex items-center">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
            YOT
          </div>
          {!collapsed && (
            <div className="ml-3">
              <h1 className="text-lg font-bold text-white">YOT/YOS</h1>
              <p className="text-xs text-gray-400">Your Own Token, Your Own Story</p>
            </div>
          )}
        </div>
        <button 
          className="ml-auto text-gray-400 hover:text-white"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-8 flex-1">
        <ul className="space-y-2 px-4">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                <a className={cn(
                  "flex items-center p-3 rounded-lg",
                  location === item.href 
                    ? "bg-primary-900/40 text-primary-400" 
                    : "text-gray-400 hover:bg-dark-300 hover:text-white"
                )}>
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <div className="ml-3">
                      <span className="font-medium">{item.label}</span>
                      {item.subLabel && (
                        <span className="text-xs text-gray-500 ml-1">({item.subLabel})</span>
                      )}
                    </div>
                  )}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Meet YOTy */}
      <div className={cn(
        "m-4 p-4 bg-dark-300 rounded-lg transition-all",
        collapsed ? "hidden" : "block"
      )}>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs">
            YOTy
          </div>
          <h3 className="text-sm font-medium text-white ml-2">Meet YOTy</h3>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Your guide to the YOT ecosystem
        </p>
        <p className="mt-2 text-xs italic text-gray-400">
          "Did you know? YOT's liquidity mechanism attempts pool growth with each transaction!"
        </p>
      </div>
    </div>
  );
}