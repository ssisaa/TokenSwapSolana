import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { TokenInfo } from '@/lib/token-search-api';
import { formatTokenBalance } from '@/lib/wallet-utils';

interface TokenPriceChartProps {
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
}

// Function to generate random prices with an upward trend
function generatePriceData(basePrice: number, days = 14) {
  const data = [];
  let price = basePrice;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    
    // Generate a random price change (-5% to +7%)
    const change = (Math.random() * 0.12) - 0.05;
    price = price * (1 + change);
    
    data.push({
      date: date.toISOString().split('T')[0],
      price: price,
    });
  }
  
  return data;
}

export function TokenPriceChart({ fromToken, toToken }: TokenPriceChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!fromToken || !toToken) {
      setChartData([]);
      return;
    }
    
    async function fetchPriceData() {
      setLoading(true);
      setError(null);
      
      try {
        // This is where we would normally fetch real market data
        // For testing, we'll generate some data
        const exchangeRate = Math.random() * 5 + 0.1; // Random rate between 0.1 and 5.1
        const priceData = generatePriceData(exchangeRate);
        
        setChartData(priceData);
      } catch (err) {
        console.error('Error fetching price data:', err);
        setError('Failed to load price data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPriceData();
  }, [fromToken, toToken]);
  
  if (!fromToken || !toToken) {
    return (
      <Card className="w-full bg-background shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Price Chart</CardTitle>
          <CardDescription>
            Select tokens to view the price chart
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <div className="text-muted-foreground">
            Select both tokens to see the price chart
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full bg-background shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {fromToken.symbol}/{toToken.symbol} Exchange Rate
        </CardTitle>
        <CardDescription>
          14-day price history
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[250px]">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-destructive">
            {error}
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatTokenBalance(value)}
                width={60}
                domain={['auto', 'auto']}
              />
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <Tooltip
                formatter={(value: number) => [
                  formatTokenBalance(value),
                  `${fromToken.symbol}/${toToken.symbol}`
                ]}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString();
                }}
                contentStyle={{
                  backgroundColor: 'rgba(22, 28, 36, 0.8)',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorPrice)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No price data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}