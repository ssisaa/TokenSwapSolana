import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { LockKeyhole } from 'lucide-react';
import MultihubAdminPanel from '@/components/MultihubAdminPanel';

export default function MultihubAdminPage() {
  const { isAdmin, login } = useAdminAuth();
  
  return (
    <div className="container max-w-5xl py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            MultiHub Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and configure the MultiHub Swap protocol
          </p>
        </div>
      </div>
      
      {/* Admin Authentication */}
      {!isAdmin && (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="bg-card border rounded-xl p-8 max-w-md">
            <LockKeyhole className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground mb-6">
              This area is restricted to administrators only. Please authenticate with an admin wallet to access these controls.
            </p>
            <Button onClick={() => login()} size="lg" className="w-full">
              Authenticate as Admin
            </Button>
          </div>
        </div>
      )}
      
      {/* Admin Content */}
      {isAdmin && (
        <Tabs defaultValue="program" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="program">Program Management</TabsTrigger>
            <TabsTrigger value="tokens">Token Management</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="program" className="mt-6">
            <MultihubAdminPanel />
          </TabsContent>
          
          <TabsContent value="tokens" className="mt-6">
            <div className="bg-card border rounded-lg p-6 text-center text-muted-foreground">
              <p>Token management features will be available in a future update.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <div className="bg-card border rounded-lg p-6 text-center text-muted-foreground">
              <p>System settings configuration will be available in a future update.</p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}