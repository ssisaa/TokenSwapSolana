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
    priceImpact: 0.005  // 0.5%
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
    priceImpact: 0.005  // 0.5%
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
    priceImpact: 0.004  // 0.4%
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
    priceImpact: 0.004  // 0.4%
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
    priceImpact: 0.003  // 0.3%
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
    priceImpact: 0.003  // 0.3%
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
    return directRoute;
  }
  
  // No direct route found
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
} {
  return {
    name: route.name,
    markets: route.marketLabels,
    fee: `${(route.fee * 100).toFixed(2)}%`,
    impact: `${(route.priceImpact * 100).toFixed(2)}%`
  };
}