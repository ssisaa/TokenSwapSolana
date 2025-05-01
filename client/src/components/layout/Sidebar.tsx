import { Link, useLocation } from 'wouter';
import { 
  Home,
  ChevronRight,
  ArrowRightLeft,
  BarChart3,
  Wallet,
  Database,
  Settings,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useState } from 'react';

export default function Sidebar() {
  const [location] = useLocation();
  const { connected: walletConnected, connect } = useMultiWallet();
  const [collapsed, setCollapsed] = useState(false);
  
  const handleConnectWallet = () => {
    if (typeof connect === 'function') {
      connect();
    }
  };
  
  const menuItems = [
    { href: '/', icon: Home, label: 'Dashboard' },
    { href: '/swap', icon: ArrowRightLeft, label: 'Multi-Hub Swap' },
    { href: '/staking', icon: Landmark, label: 'Staking' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/wallet', icon: Wallet, label: 'Wallet' },
    { href: '/pool', icon: Database, label: 'Liquidity Pool' },
    { href: '/admin', icon: ShieldCheck, label: 'Admin' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-[#0f1421] border-r border-[#1e2a45] transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* App Logo */}
      <div className="flex items-center h-16 px-4 border-b border-[#1e2a45]">
        <div className="flex items-center space-x-2">
          <div className="bg-gradient-to-br from-primary to-[#7043f9] p-2 rounded-lg">
            <ArrowRightLeft className="h-5 w-5 text-white" />
          </div>
          {!collapsed && <span className="text-xl font-bold text-white">YOT Swap</span>}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="ml-auto text-[#a3accd] hover:text-white hover:bg-[#1e2a45]"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronRight className={cn(
            "h-5 w-5 transition-transform",
            collapsed ? "rotate-180" : ""
          )} />
        </Button>
      </div>
      
      {/* Sidebar Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md text-[#a3accd] hover:bg-[#1e2a45] hover:text-white transition-colors",
                location === item.href && "bg-[#1e2a45] text-white font-medium"
              )}>
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Wallet Connect Button */}
      <div className="p-4 border-t border-[#1e2a45]">
        {!walletConnected ? (
          <Button 
            className={cn(
              "w-full bg-gradient-to-r from-primary to-[#7043f9] text-white",
              collapsed && "p-2"
            )}
            onClick={handleConnectWallet}
          >
            <Wallet className="h-4 w-4 mr-2" />
            {!collapsed && <span>Connect Wallet</span>}
          </Button>
        ) : (
          <div className={cn(
            "flex items-center text-[#a3accd] py-2 px-3 rounded-md bg-[#1e2a45]",
            collapsed && "justify-center"
          )}>
            <Wallet className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2 text-sm">Connected</span>}
          </div>
        )}
      </div>
    </div>
  );
}