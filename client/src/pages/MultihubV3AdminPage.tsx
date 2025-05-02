import React from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';

import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MultihubV3AdminActions from '@/components/MultihubV3AdminActions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export function MultihubV3AdminPage() {
  const { wallet, connected } = useMultiWallet();
  
  return (
    <div className="container mx-auto p-4">
      <PageHeader
        title="Multihub Swap V3 Admin"
        description="Manage the Multihub Swap V3 program"
      />
      
      {!connected && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Wallet not connected</AlertTitle>
          <AlertDescription>
            Please connect your wallet to access admin functions.
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs defaultValue="program" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="program">Program Management</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>
        
        <TabsContent value="program" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <MultihubV3AdminActions wallet={wallet} />
            </div>
            
            <div>
              <div className="rounded-lg border bg-card p-6 h-full">
                <h3 className="text-lg font-semibold mb-4">How to Use</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm">First Time Setup</h4>
                    <ol className="text-sm text-muted-foreground list-decimal list-inside mt-2 space-y-2">
                      <li>Connect your wallet (must be admin: <span className="font-mono text-xs">AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ</span>)</li>
                      <li>Click "Initialize Program" to set up the program with default parameters</li>
                      <li>Approve the transaction in your wallet</li>
                      <li>Wait for confirmation (you'll see a success toast and a link to the explorer)</li>
                    </ol>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm">Reset the Program</h4>
                    <ol className="text-sm text-muted-foreground list-decimal list-inside mt-2 space-y-2">
                      <li>If you need to reset, click "Close Program"</li>
                      <li>Approve the transaction in your wallet</li>
                      <li>Once completed, you can initialize again</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="monitoring">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Program Monitoring</h3>
            <p className="text-muted-foreground">
              This section will be implemented soon. It will display program state and statistics.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MultihubV3AdminPage;