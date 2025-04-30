import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PageLayout } from '@/components/layout/PageLayout';
import MultiHubSwapDemo from '@/components/MultiHubSwap/MultiHubSwapDemo';

export default function MultiHubSwapPage() {
  return (
    <PageLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Multi-Hub Token Swap</h1>
            <p className="text-muted-foreground mt-2">
              Swap tokens with automatic 20% contribution to SOL-YOT liquidity pool and earn 5% YOS cashback rewards
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <WalletMultiButton />
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 flex justify-center">
            <MultiHubSwapDemo />
          </div>
          
          <div className="flex-1 bg-card rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">About Multi-Hub Swap</h2>
            <div className="space-y-4">
              <p>
                Our Multi-Hub Swap technology intelligently routes your transactions through
                multiple liquidity sources to ensure the best rates and highest success probability.
              </p>
              
              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-semibold mb-2">Key Benefits</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Automatic 20% contribution to SOL-YOT liquidity pool</li>
                  <li>5% YOS token cashback on every swap</li>
                  <li>75% of tokens go directly to you</li>
                  <li>Smart routing through multiple DEXs</li>
                  <li>Weekly YOS rewards distribution at 100% APR</li>
                </ul>
              </div>
              
              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-semibold mb-2">How It Works</h3>
                <p>Each swap is processed through our secure smart contract, which:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Routes 75% of tokens directly to your wallet</li>
                  <li>Adds 20% to the SOL-YOT liquidity pool (10% SOL, 10% YOT)</li>
                  <li>Allocates 5% as YOS token rewards</li>
                  <li>Tracks your contributions for weekly YOS rewards</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}