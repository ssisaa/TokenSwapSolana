import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistance, subHours, getHours, getMinutes } from 'date-fns';

interface PriceChartProps {
  fromSymbol: string;
  toSymbol: string;
  timeframe?: '15m' | '1h' | '4h' | '1d';
}

interface PriceData {
  time: Date;
  price: number;
  timestamp: number;
}

export default function PriceChart({
  fromSymbol,
  toSymbol,
  timeframe = '15m'
}: PriceChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highPrice, setHighPrice] = useState<number>(0);
  const [lowPrice, setLowPrice] = useState<number>(0);

  useEffect(() => {
    const fetchPriceData = async () => {
      if (!fromSymbol || !toSymbol) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // In a real implementation, we would fetch data from an API
        // For now, we'll generate synthetic data
        const now = new Date();
        const dataPoints: PriceData[] = [];
        const basePrice = 0.5; // Base price value
        let points = 48; // 48 points for 15m timeframe (12 hours total)
        
        if (timeframe === '1h') points = 24; // 24 hours
        if (timeframe === '4h') points = 42; // 7 days (approx)
        if (timeframe === '1d') points = 30; // 30 days
        
        // Generate simulated price data that looks like a real market
        // with some volatility and an overall trend
        const volatility = 0.03; // 3% volatility
        const trend = 0.001; // Slight upward trend
        let lastPrice = basePrice;
        
        for (let i = points; i >= 0; i--) {
          // Calculate time
          let timePoint: Date;
          if (timeframe === '15m') timePoint = subHours(now, i * 0.25);
          else if (timeframe === '1h') timePoint = subHours(now, i);
          else if (timeframe === '4h') timePoint = subHours(now, i * 4);
          else timePoint = subHours(now, i * 24);
          
          // Random walk with slight trend
          const change = (Math.random() - 0.5) * volatility + trend;
          lastPrice = lastPrice * (1 + change);
          
          dataPoints.push({
            time: timePoint,
            price: lastPrice,
            timestamp: timePoint.getTime()
          });
        }
        
        // Calculate high and low
        const prices = dataPoints.map(d => d.price);
        setHighPrice(Math.max(...prices));
        setLowPrice(Math.min(...prices));
        
        setData(dataPoints);
      } catch (err) {
        console.error('Error fetching price data:', err);
        setError('Failed to load price data');
      } finally {
        setLoading(false);
      }
    };

    fetchPriceData();
  }, [fromSymbol, toSymbol, timeframe]);

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${getHours(date)}:${getMinutes(date).toString().padStart(2, '0')}`;
  };

  const formatTooltipTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return formatDistance(date, new Date(), { addSuffix: true });
  };

  // Calculate percentage change
  const priceChange = data.length > 0 
    ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100
    : 0;
  
  return (
    <Card className="p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {fromSymbol} / {toSymbol} 
            <span className="text-xs ml-2 text-muted-foreground">
              {timeframe}
            </span>
          </h3>
          {!loading && data.length > 0 && (
            <div className="text-sm">
              <span className={priceChange >= 0 ? "text-green-500" : "text-red-500"}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="text-sm text-right">
          {!loading && data.length > 0 && (
            <>
              <div className="flex space-x-4">
                <div>
                  <div className="text-muted-foreground text-xs">High</div>
                  <div>{highPrice.toFixed(6)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Low</div>
                  <div>{lowPrice.toFixed(6)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-red-500">
          {error}
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis} 
                tick={{ fontSize: 10 }}
                stroke="#888888"
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{ fontSize: 10 }} 
                width={40}
                tickFormatter={(value) => value.toFixed(4)}
                stroke="#888888"
              />
              <Tooltip 
                labelFormatter={formatTooltipTime}
                formatter={(value: number) => [value.toFixed(6), 'Price']}
                contentStyle={{ 
                  background: 'rgba(15, 23, 42, 0.9)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#16a34a" 
                dot={false}
                strokeWidth={2}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}