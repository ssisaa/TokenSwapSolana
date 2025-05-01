import { PublicKey } from '@solana/web3.js';
import { SOL_TOKEN_ADDRESS } from './constants';

/**
 * Interface for Jupiter route configuration
 */
export interface JupiterRouteConfig {
  id: string;
  name: string;
  inputMint: string;
  inputSymbol: string;
  outputMint: string;
  outputSymbol: string;
  marketIds: string[];
  marketLabels: string[];
  fee: number;
  priceImpact: number;
  // Liquidity information for pools
  inputReserve?: number;
  outputReserve?: number;
  volumeUSD?: number;
  liquidityUSD?: number;
  // Routing information
  intermediateTokens?: string[];
  routeType?: 'direct' | 'multi-hop';
}

/**
 * Test routes for Jupiter integration
 * These routes are used for testing the Jupiter integration
 * without relying on actual Jupiter API responses
 */
export const testJupiterRoutes: JupiterRouteConfig[] = [
  // RAMX-SOL Pool
  {
    id: "ramx-sol-route",
    name: "RAMX-SOL",
    inputMint: "RAMXd3mgY5XFyWbfgNh9LT7BcuW5w7jqRFgNkwZEhhsu",
    inputSymbol: "RAMX",
    outputMint: SOL_TOKEN_ADDRESS,
    outputSymbol: "SOL",
    marketIds: ["RAMX-SOL-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.0035,  // 0.35%
    priceImpact: 0.005,  // 0.5%
    // Liquidity information
    inputReserve: 4500000,  // 4.5 million RAMX in pool
    outputReserve: 450,     // 450 SOL in pool
    volumeUSD: 195000,      // $195K daily volume
    liquidityUSD: 1850000   // $1.85M liquidity
  },
  // SOL-RAMX Pool (reverse of above)
  {
    id: "sol-ramx-route",
    name: "SOL-RAMX",
    inputMint: SOL_TOKEN_ADDRESS,
    inputSymbol: "SOL",
    outputMint: "RAMXd3mgY5XFyWbfgNh9LT7BcuW5w7jqRFgNkwZEhhsu",
    outputSymbol: "RAMX",
    marketIds: ["SOL-RAMX-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.0035,  // 0.35%
    priceImpact: 0.005,  // 0.5%
    // Liquidity information (same as above, reversed)
    inputReserve: 450,     // 450 SOL in pool
    outputReserve: 4500000,  // 4.5 million RAMX in pool
    volumeUSD: 195000,      // $195K daily volume
    liquidityUSD: 1850000   // $1.85M liquidity
  },
  // TRAXX-SOL Pool
  {
    id: "traxx-sol-route",
    name: "TRAXX-SOL",
    inputMint: "TRXXpN1Y4tAYcfp3QxCKLeVDvUnjGWQvA2HTQ5VTytA",
    inputSymbol: "TRAXX",
    outputMint: SOL_TOKEN_ADDRESS,
    outputSymbol: "SOL",
    marketIds: ["TRAXX-SOL-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.003,  // 0.3%
    priceImpact: 0.004,  // 0.4%
    // Liquidity information
    inputReserve: 3800000,  // 3.8 million TRAXX in pool
    outputReserve: 380,     // 380 SOL in pool
    volumeUSD: 175000,      // $175K daily volume
    liquidityUSD: 1650000   // $1.65M liquidity
  },
  // SOL-TRAXX Pool (reverse of above)
  {
    id: "sol-traxx-route",
    name: "SOL-TRAXX",
    inputMint: SOL_TOKEN_ADDRESS,
    inputSymbol: "SOL",
    outputMint: "TRXXpN1Y4tAYcfp3QxCKLeVDvUnjGWQvA2HTQ5VTytA",
    outputSymbol: "TRAXX",
    marketIds: ["SOL-TRAXX-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.003,  // 0.3%
    priceImpact: 0.004,  // 0.4%
    // Liquidity information (same as above, reversed)
    inputReserve: 380,      // 380 SOL in pool
    outputReserve: 3800000, // 3.8 million TRAXX in pool
    volumeUSD: 175000,      // $175K daily volume
    liquidityUSD: 1650000   // $1.65M liquidity
  },
  // SAMX-USDC Pool (new)
  {
    id: "samx-usdc-route",
    name: "SAMX-USDC",
    inputMint: "SAMXjJJa4XShbsyK3ZK1qUKgHs45u8YUySGBbKctwKX",
    inputSymbol: "SAMX",
    outputMint: "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U",
    outputSymbol: "USDC",
    marketIds: ["SAMX-USDC-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.003,  // 0.3%
    priceImpact: 0.004,  // 0.4%
    // Liquidity information
    inputReserve: 3000000,  // 3 million SAMX in pool
    outputReserve: 900000,  // 900K USDC in pool
    volumeUSD: 320000,      // $320K daily volume
    liquidityUSD: 1800000   // $1.8M liquidity
  },
  // USDC-SAMX Pool (reverse of above)
  {
    id: "usdc-samx-route",
    name: "USDC-SAMX",
    inputMint: "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U",
    inputSymbol: "USDC",
    outputMint: "SAMXjJJa4XShbsyK3ZK1qUKgHs45u8YUySGBbKctwKX",
    outputSymbol: "SAMX",
    marketIds: ["USDC-SAMX-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.003,  // 0.3%
    priceImpact: 0.004,  // 0.4%
    // Liquidity information (same as above, reversed)
    inputReserve: 900000,   // 900K USDC in pool
    outputReserve: 3000000, // 3 million SAMX in pool
    volumeUSD: 320000,      // $320K daily volume
    liquidityUSD: 1800000   // $1.8M liquidity
  },
  // USDC-SOL Pool (new)
  {
    id: "usdc-sol-route",
    name: "USDC-SOL",
    inputMint: "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U",
    inputSymbol: "USDC",
    outputMint: SOL_TOKEN_ADDRESS,
    outputSymbol: "SOL",
    marketIds: ["USDC-SOL-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.002,  // 0.2%
    priceImpact: 0.003,  // 0.3%
    // Liquidity information
    inputReserve: 2200000,  // 2.2 million USDC in pool
    outputReserve: 15000,   // 15K SOL in pool (large pool)
    volumeUSD: 1200000,     // $1.2M daily volume
    liquidityUSD: 4300000   // $4.3M liquidity
  },
  // SOL-USDC Pool (reverse of above)
  {
    id: "sol-usdc-route",
    name: "SOL-USDC",
    inputMint: SOL_TOKEN_ADDRESS,
    inputSymbol: "SOL",
    outputMint: "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U",
    outputSymbol: "USDC",
    marketIds: ["SOL-USDC-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.002,  // 0.2%
    priceImpact: 0.003,  // 0.3%
    // Liquidity information (same as above, reversed)
    inputReserve: 15000,    // 15K SOL in pool
    outputReserve: 2200000, // 2.2 million USDC in pool
    volumeUSD: 1200000,     // $1.2M daily volume
    liquidityUSD: 4300000   // $4.3M liquidity
  },
  // YOT-SOL Pool
  {
    id: "yot-sol-route",
    name: "YOT-SOL",
    inputMint: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
    inputSymbol: "YOT",
    outputMint: SOL_TOKEN_ADDRESS,
    outputSymbol: "SOL",
    marketIds: ["YOT-SOL-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.0025,  // 0.25%
    priceImpact: 0.003,  // 0.3%
    // Liquidity information (matching our existing YOT-SOL pool)
    inputReserve: 706054550, // Match existing YOT balance
    outputReserve: 28.8,     // Match existing SOL balance
    volumeUSD: 500000,       // $500K daily volume
    liquidityUSD: 2500000    // $2.5M liquidity
  },
  // SOL-YOT Pool (reverse of above)
  {
    id: "sol-yot-route",
    name: "SOL-YOT",
    inputMint: SOL_TOKEN_ADDRESS,
    inputSymbol: "SOL",
    outputMint: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
    outputSymbol: "YOT",
    marketIds: ["SOL-YOT-jup-market-id-1"],
    marketLabels: ["Jupiter"],
    fee: 0.0025,  // 0.25%
    priceImpact: 0.003,  // 0.3%
    // Liquidity information (matching our existing SOL-YOT pool)
    inputReserve: 28.8,       // Match existing SOL balance
    outputReserve: 706054550, // Match existing YOT balance
    volumeUSD: 500000,        // $500K daily volume
    liquidityUSD: 2500000     // $2.5M liquidity
  }
];

/**
 * Get all Jupiter routes
 * This function would normally fetch routes from Jupiter API
 * but for testing, we return our test routes
 */
export async function getJupiterRoutes(): Promise<JupiterRouteConfig[]> {
  try {
    return testJupiterRoutes;
  } catch (error) {
    console.error('Error fetching Jupiter routes:', error);
    return [];
  }
}

/**
 * Get Jupiter routes for a specific token
 * @param tokenMint Token mint address to find routes for
 */
export async function getJupiterRoutesForToken(tokenMint: string): Promise<JupiterRouteConfig[]> {
  const routes = await getJupiterRoutes();
  
  return routes.filter(route => 
    route.inputMint === tokenMint || route.outputMint === tokenMint
  );
}

/**
 * Find the best Jupiter route for a token pair
 * @param fromMint Source token mint
 * @param toMint Destination token mint
 */
export async function findBestJupiterRoute(
  fromMint: string, 
  toMint: string
): Promise<JupiterRouteConfig | null> {
  const routes = await getJupiterRoutes();
  
  // Try to find direct route
  const directRoute = routes.find(route => 
    (route.inputMint === fromMint && route.outputMint === toMint)
  );
  
  if (directRoute) {
    // Mark as direct route for display purposes
    directRoute.routeType = 'direct';
    return directRoute;
  }
  
  // If no direct route exists, try to find a route through SOL
  // Many tokens don't have direct pairs but can be swapped through SOL
  const SOL_TOKEN = SOL_TOKEN_ADDRESS;
  const USDC_TOKEN = "9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U";
  
  // Common intermediate tokens to try for routes
  const intermediateTokens = [SOL_TOKEN, USDC_TOKEN];
  
  // Try each intermediate token
  for (const intermediateToken of intermediateTokens) {
    // Skip if the intermediate token is the same as source or destination
    if (intermediateToken === fromMint || intermediateToken === toMint) {
      continue;
    }
    
    // Look for the first hop (fromMint → intermediateToken)
    const firstHopRoute = routes.find(route => 
      route.inputMint === fromMint && route.outputMint === intermediateToken
    );
    
    // Look for the second hop (intermediateToken → toMint)
    const secondHopRoute = routes.find(route => 
      route.inputMint === intermediateToken && route.outputMint === toMint
    );
    
    // If both hops exist, we have a valid multi-hop route
    if (firstHopRoute && secondHopRoute) {
      // Create a new multi-hop route by combining route info
      const multiHopRoute: JupiterRouteConfig = {
        id: `${firstHopRoute.id}-to-${secondHopRoute.id}`,
        name: `${firstHopRoute.inputSymbol}-${firstHopRoute.outputSymbol}-${secondHopRoute.outputSymbol}`,
        inputMint: fromMint,
        inputSymbol: firstHopRoute.inputSymbol,
        outputMint: toMint,
        outputSymbol: secondHopRoute.outputSymbol,
        // Combine market IDs and labels from both routes
        marketIds: [...firstHopRoute.marketIds, ...secondHopRoute.marketIds],
        marketLabels: [...firstHopRoute.marketLabels, ...secondHopRoute.marketLabels],
        // Sum the fees from both hops
        fee: firstHopRoute.fee + secondHopRoute.fee,
        // Price impact compounds across hops
        priceImpact: firstHopRoute.priceImpact + secondHopRoute.priceImpact,
        // Track the intermediate tokens for the UI
        intermediateTokens: [intermediateToken],
        routeType: 'multi-hop'
      };
      
      return multiHopRoute;
    }
  }
  
  // No route found
  return null;
}

/**
 * Get Jupiter route info for display
 * @param route Jupiter route
 */
export function getJupiterRouteDisplayInfo(route: JupiterRouteConfig): {
  name: string;
  markets: string[];
  fee: string;
  impact: string;
  path?: string;
  hops?: number;
} {
  // Basic route info
  const info = {
    name: route.name,
    markets: route.marketLabels,
    fee: `${(route.fee * 100).toFixed(2)}%`,
    impact: `${(route.priceImpact * 100).toFixed(2)}%`
  };
  
  // Add multi-hop info if available
  if (route.routeType === 'multi-hop' && route.intermediateTokens?.length) {
    // Get hop count
    const hops = route.intermediateTokens.length + 1;
    
    // Construct path display
    let path = `${route.inputSymbol}`;
    for (const intermediate of route.intermediateTokens) {
      // Try to get a friendly symbol for the intermediate token
      const intermediateSymbol = intermediate === SOL_TOKEN_ADDRESS ? 'SOL' : 
                                intermediate === '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U' ? 'USDC' : 
                                'TOKEN';
      path += ` → ${intermediateSymbol}`;
    }
    path += ` → ${route.outputSymbol}`;
    
    return {
      ...info,
      path,
      hops
    };
  }
  
  return info;
}