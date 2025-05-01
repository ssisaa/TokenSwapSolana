import React from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { TokenInfo } from '@/lib/token-search-api';
import { SwapProvider } from '@/lib/multi-hub-swap';

interface RouteInfo {
  label?: string;
  ammId?: string;
  marketId?: string;
  percent?: number;
  inputMint?: string;
  outputMint?: string;
  marketName?: string;
  poolData?: any;
}

interface RouteDisplayProps {
  fromToken?: TokenInfo;
  toToken?: TokenInfo;
  swapEstimate: any;
}

export function RouteDisplay({ fromToken, toToken, swapEstimate }: RouteDisplayProps) {
  // If no route array exists but we have tokens, show a direct route
  const hasRouteArray = swapEstimate?.route && Array.isArray(swapEstimate.route) && swapEstimate.route.length > 0;
  
  // Format provider name
  const getProviderName = (providerId?: number) => {
    switch (providerId) {
      case SwapProvider.Contract: return 'Multi-hub Contract';
      case SwapProvider.Raydium: return 'Raydium DEX';
      case SwapProvider.Jupiter: return 'Jupiter Aggregator';
      default: return 'Auto';
    }
  };
  
  return (
    <div className="p-3 bg-[#141c2f] rounded-md border border-[#1e2a45]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-[#a3accd]">Swap Route:</div>
        <div className="text-xs text-[#7d8ab1] bg-[#1e2a45] px-2 py-0.5 rounded-md">
          via {getProviderName(swapEstimate?.provider)}
        </div>
      </div>
      
      {hasRouteArray ? (
        // Display route tokens with arrows between them
        <div className="flex items-center flex-wrap gap-2">
          {swapEstimate.route.map((address: string, index: number) => {
            // Find token symbol
            const tokenSymbol = address === fromToken?.address ? fromToken.symbol : 
                              address === toToken?.address ? toToken.symbol : 
                              address === 'So11111111111111111111111111111111111111112' ? 'SOL' : 
                              address.slice(0, 4) + '...' + address.slice(-4);
                              
            return (
              <div key={index} className="flex items-center">
                <div className="bg-[#1e2a45] text-[#a3accd] px-2 py-1 rounded-md text-xs flex items-center">
                  {tokenSymbol}
                  <a 
                    href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-[#7d8ab1] hover:text-primary"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                {index < swapEstimate.route.length - 1 && (
                  <ArrowRight className="h-3 w-3 mx-1 text-[#7d8ab1]" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // If no route but we have from and to tokens, show a simple display
        <div className="flex items-center flex-wrap gap-2">
          {fromToken && toToken && (
            <>
              <div className="bg-[#1e2a45] text-[#a3accd] px-2 py-1 rounded-md text-xs flex items-center">
                {fromToken.symbol}
                <a 
                  href={`https://explorer.solana.com/address/${fromToken.address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-[#7d8ab1] hover:text-primary"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <ArrowRight className="h-3 w-3 mx-1 text-[#7d8ab1]" />
              <div className="bg-[#1e2a45] text-[#a3accd] px-2 py-1 rounded-md text-xs flex items-center">
                {toToken.symbol}
                <a 
                  href={`https://explorer.solana.com/address/${toToken.address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-[#7d8ab1] hover:text-primary"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Additional route information */}
      {swapEstimate?.routeInfo && Array.isArray(swapEstimate.routeInfo) && swapEstimate.routeInfo.length > 0 && (
        <div className="mt-3 space-y-2">
          {swapEstimate.routeInfo.map((route: RouteInfo, index: number) => (
            <div key={index} className="bg-[#1a2338] p-2 rounded border border-[#1e2a45] flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center text-[#a3accd]">
                  <span className="text-xs">{route.label || "AMM Pool"}</span>
                  {route.percent && route.percent !== 100 && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-[#1e2a45] rounded-full">
                      {route.percent}%
                    </span>
                  )}
                </div>
                {route.ammId && (
                  <div className="flex items-center space-x-1 mt-1">
                    <a 
                      href={`https://explorer.solana.com/address/${route.ammId}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#7d8ab1] hover:text-primary"
                    >
                      AMM: {route.ammId.substring(0, 8)}...
                    </a>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-end text-xs">
                <span className="text-[#a3accd]">{route.marketName || "Direct Exchange"}</span>
                {route.inputMint && route.outputMint && (
                  <div className="flex items-center mt-1">
                    <a 
                      href={`https://explorer.solana.com/address/${route.inputMint}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#7d8ab1] hover:text-primary"
                    >
                      In: {route.inputMint.substring(0, 4)}...
                    </a>
                    <ArrowRight className="mx-1 h-2 w-2 text-[#7d8ab1]" />
                    <a 
                      href={`https://explorer.solana.com/address/${route.outputMint}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#7d8ab1] hover:text-primary"
                    >
                      Out: {route.outputMint.substring(0, 4)}...
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Price impact and fee information */}
      <div className="mt-2 text-xs text-[#7d8ab1] flex justify-between">
        <span>Price Impact: {swapEstimate?.priceImpact ? (swapEstimate.priceImpact * 100).toFixed(2) : '0.00'}%</span>
        <span>Fee: {swapEstimate?.liquidityFee ? (swapEstimate.liquidityFee * 100).toFixed(2) : '0.30'}%</span>
      </div>
    </div>
  );
}