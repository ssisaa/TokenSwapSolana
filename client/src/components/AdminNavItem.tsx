import React from 'react';
import { Link } from 'wouter';
import { LockKeyhole } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminNavItem() {
  const { isAdmin } = useAdminAuth();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/multihub-admin">
            <a className={`flex items-center space-x-3 rounded-md px-3 py-2 text-sm ${
              isAdmin 
                ? 'text-amber-400 hover:bg-amber-500/10' 
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}>
              <LockKeyhole className="h-5 w-5" />
              <span>Admin</span>
              {isAdmin && (
                <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" />
              )}
            </a>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{isAdmin ? 'Admin access granted' : 'MultiHub Swap Admin Tools'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}