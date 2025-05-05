import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useSOLPrice } from '../../hooks/useSOLPrice';

interface PriceChartProps {
  tokenAddress: string;
  tokenSymbol: string;
}

interface PriceDataPoint {
  timestamp: number;
  price: number;
}

/**
 * Generates mock price data for demonstration purposes
 * In a real implementation, this would fetch from a price API
 */
function generatePriceData(basePrice: number, days: number = 30, volatility: number = 0.02): PriceDataPoint[] {
  const data: PriceDataPoint[] = [];
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  let price = basePrice;
  
  for (let i = days; i >= 0; i--) {
    const timestamp = now - (i * msPerDay);
    const change = 1 + (Math.random() * volatility * 2 - volatility);
    price *= change;
    
    data.push({
      timestamp,
      price
    });
  }
  
  return data;
}

export default function PriceChart({ tokenAddress, tokenSymbol }: PriceChartProps) {
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState<string>('30d');
  const { solPrice } = useSOLPrice();
  
  useEffect(() => {
    // Estimate base price based on tokenSymbol
    // In a real implementation, this would fetch from an API
    let basePrice = 0;
    
    if (tokenSymbol === 'SOL') {
      basePrice = solPrice;
    } else if (tokenSymbol === 'YOT') {
      basePrice = solPrice / 100; // YOT price is 1/100 of SOL
    } else if (tokenSymbol === 'YOS') {
      basePrice = solPrice / 50; // YOS price is 1/50 of SOL
    } else if (tokenSymbol === 'USDC') {
      basePrice = 1.0; // USDC is a stablecoin
    } else {
      basePrice = 0.1; // Default price for other tokens
    }

    // Generate price data based on timeframe
    let days = 30;
    let volatility = 0.02;
    
    if (timeframe === '7d') {
      days = 7;
      volatility = 0.015;
    } else if (timeframe === '1d') {
      days = 1;
      volatility = 0.01;
    } else if (timeframe === '1h') {
      days = 1/24;
      volatility = 0.005;
    } else if (timeframe === '1y') {
      days = 365;
      volatility = 0.03;
    }
    
    const data = generatePriceData(basePrice, days, volatility);
    setPriceData(data);
  }, [timeframe, tokenSymbol, solPrice]);
  
  // Calculate price change
  const calculatePriceChange = (): { change: number; percentChange: number } => {
    if (priceData.length < 2) return { change: 0, percentChange: 0 };
    
    const firstPrice = priceData[0].price;
    const lastPrice = priceData[priceData.length - 1].price;
    const change = lastPrice - firstPrice;
    const percentChange = (change / firstPrice) * 100;
    
    return { change, percentChange };
  };
  
  const { change, percentChange } = calculatePriceChange();
  const isPositive = percentChange >= 0;
  
  // Format timestamp for display on chart
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    
    if (timeframe === '1h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeframe === '1d') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeframe === '7d') {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-medium">
          {tokenSymbol} Price
        </CardTitle>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            {['1h', '1d', '7d', '30d', '1y'].map((option) => (
              <button
                key={option}
                className={`px-2 py-1 text-xs rounded ${timeframe === option 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                onClick={() => setTimeframe(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold">
              ${priceData.length > 0 ? priceData[priceData.length - 1].price.toFixed(6) : '0.00'}
            </span>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
              isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isPositive ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            {isPositive ? '+' : ''}{change.toFixed(6)} ({timeframe})
          </span>
        </div>
        
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={priceData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis} 
                minTickGap={30}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                width={60}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                labelFormatter={(label) => new Date(label).toLocaleString()}
                formatter={(value: number) => [`$${value.toFixed(6)}`, 'Price']}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'} 
                fillOpacity={1}
                fill="url(#colorPrice)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}