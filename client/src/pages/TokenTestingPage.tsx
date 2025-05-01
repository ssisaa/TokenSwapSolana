import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TestTokenTransfer from '@/components/MultiHubSwap/TestTokenTransfer';
import PoolLiquidityTable from '@/components/MultiHubSwap/PoolLiquidityTable';
import LiquidityPoolsChecker from '@/components/MultiHubSwap/LiquidityPoolsChecker';

export default function TokenTestingPage() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Token Testing Tools</h1>
      
      <Tabs defaultValue="transfer">
        <TabsList className="mb-4">
          <TabsTrigger value="transfer">Token Transfer</TabsTrigger>
          <TabsTrigger value="pools">Liquidity Pools</TabsTrigger>
          <TabsTrigger value="routes">Pool Status</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transfer" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="mx-auto w-full max-w-2xl">
              <TestTokenTransfer />
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border">
              <h3 className="text-lg font-medium mb-4">Test Token Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>MTA:</strong> MTAwhynnxuZPWeRaKdZNgCiLgv8qTzhMV7SE6cuvjLf</p>
                <p><strong>SAMX:</strong> SAMXtxdXUeRHkeFp3JbCJcDtVPM18tqcEFmhsJtUYU7</p>
                <p><strong>XAR:</strong> XARMztsUvnKamdA2TgSEEib7H7zCUwF3jgChMGHXXSp</p>
                <p><strong>XMP:</strong> XMPuiiydZfyYNSXY894NucMmFZyEwuK7i1uHLmDyDN1</p>
                <p><strong>RAMX:</strong> RAMXriMbBGpXU8FMj2Y7WEcTXNfWGhkmkYdgZZ26i5F</p>
                <p><strong>TRAXX:</strong> TRAXXapnMX3NYpuYpXuRJjpH7Vop8YZtxRrPEAVTJhY</p>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  These are test tokens created on Solana devnet for testing multi-hop swaps. 
                  Use this page to transfer test tokens to your wallet for testing.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="pools">
          <PoolLiquidityTable />
        </TabsContent>
        
        <TabsContent value="routes">
          <LiquidityPoolsChecker />
        </TabsContent>
      </Tabs>
    </div>
  );
}