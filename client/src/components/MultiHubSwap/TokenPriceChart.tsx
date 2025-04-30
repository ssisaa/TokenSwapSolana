import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenInfo } from '@/lib/token-search-api';
import { Maximize2, BarChart2, ArrowDownUp, RotateCw } from 'lucide-react';

// Mock data for chart (will be replaced with real data from API)
interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const generateMockChartData = (basePrice: number, count: number): ChartCandle[] => {
  const data: ChartCandle[] = [];
  let lastClose = basePrice;
  
  const now = new Date();
  now.setHours(now.getHours() - count);
  
  for (let i = 0; i < count; i++) {
    const time = new Date(now);
    time.setMinutes(time.getMinutes() + i * 15);
    
    const volatility = basePrice * 0.02; // 2% volatility
    const change = (Math.random() - 0.5) * volatility;
    const open = lastClose;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    
    data.push({
      time: time.toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 10000)
    });
    
    lastClose = close;
  }
  
  return data;
};

interface TokenPriceChartProps {
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
}

export default function TokenPriceChart({ fromToken, toToken }: TokenPriceChartProps) {
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('15m');
  const [chartData, setChartData] = useState<ChartCandle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (!fromToken || !toToken) {
      setChartData([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Simulate API call delay
    const timeout = setTimeout(() => {
      // Generate mock data - in a real implementation, this would be replaced with
      // a call to a price API like CoinGecko or a DEX API
      const basePrice = fromToken.symbol === 'SOL' ? 52.5 : 1.0;
      const dataPoints = timeframe === '15m' ? 20 : 
                       timeframe === '1h' ? 24 : 
                       timeframe === '4h' ? 24 : 
                       30; // 1d
                       
      const data = generateMockChartData(basePrice, dataPoints);
      setChartData(data);
      setLoading(false);
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [fromToken, toToken, timeframe]);
  
  // Format price with appropriate precision
  const formatPrice = (price: number): string => {
    if (price < 0.001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 1000) return price.toFixed(2);
    return price.toFixed(0);
  };
  
  // Calculate price stats
  const priceChange = chartData.length > 0 
    ? chartData[chartData.length - 1].close - chartData[0].open 
    : 0;
    
  const priceChangePercent = chartData.length > 0 
    ? (priceChange / chartData[0].open) * 100 
    : 0;
    
  const currentPrice = chartData.length > 0 
    ? chartData[chartData.length - 1].close 
    : 0;
    
  const highPrice = chartData.length > 0 
    ? Math.max(...chartData.map(d => d.high)) 
    : 0;
    
  const lowPrice = chartData.length > 0 
    ? Math.min(...chartData.map(d => d.low)) 
    : 0;
  
  // Format the date for display
  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Only render if we have both tokens
  if (!fromToken || !toToken) {
    return null;
  }
  
  return (
    <Card className="bg-[#131B30] border-[#1A243C] text-white overflow-hidden mt-3 mb-3">
      <CardContent className="p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {fromToken.symbol} / {toToken.symbol}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate()}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <BarChart2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="text-lg font-semibold">
            {loading ? <Skeleton className="h-6 w-16 bg-[#1A243C]" /> : formatPrice(currentPrice)}
          </div>
          
          <div className={`text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {loading ? (
              <Skeleton className="h-4 w-20 bg-[#1A243C]" />
            ) : (
              <>
                {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)} ({priceChangePercent.toFixed(2)}%)
              </>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mb-3">
          <Button 
            variant={timeframe === '15m' ? 'secondary' : 'outline'} 
            onClick={() => setTimeframe('15m')}
            size="sm"
            className="h-6 text-xs px-2 bg-transparent"
          >
            15m
          </Button>
          <Button 
            variant={timeframe === '1h' ? 'secondary' : 'outline'} 
            onClick={() => setTimeframe('1h')}
            size="sm"
            className="h-6 text-xs px-2 bg-transparent"
          >
            1h
          </Button>
          <Button 
            variant={timeframe === '4h' ? 'secondary' : 'outline'} 
            onClick={() => setTimeframe('4h')}
            size="sm"
            className="h-6 text-xs px-2 bg-transparent"
          >
            4h
          </Button>
          <Button 
            variant={timeframe === '1d' ? 'secondary' : 'outline'} 
            onClick={() => setTimeframe('1d')}
            size="sm"
            className="h-6 text-xs px-2 bg-transparent"
          >
            1d
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 ml-auto text-muted-foreground"
            onClick={() => setLoading(true)}
          >
            <RotateCw className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="relative w-full h-[250px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="w-full h-full bg-[#1A243C]" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="w-full h-full relative">
              {/* Mock chart rendering */}
              <div className="absolute right-2 top-2 text-xs text-muted-foreground">
                High: {formatPrice(highPrice)}
              </div>
              
              <svg 
                viewBox="0 0 100 50" 
                className="w-full h-full" 
                preserveAspectRatio="none"
                strokeWidth="1"
              >
                {/* Generate candlesticks from the data */}
                {chartData.map((candle, i) => {
                  const min = Math.min(...chartData.map(d => d.low));
                  const max = Math.max(...chartData.map(d => d.high));
                  const range = max - min;
                  
                  // Normalize values to fit the SVG
                  const x = (i / chartData.length) * 100;
                  const yOpen = 50 - ((candle.open - min) / range) * 50;
                  const yClose = 50 - ((candle.close - min) / range) * 50;
                  const yHigh = 50 - ((candle.high - min) / range) * 50;
                  const yLow = 50 - ((candle.low - min) / range) * 50;
                  
                  const width = 0.8; // Width of candle as percentage of available space
                  const candleColor = candle.close >= candle.open ? 'rgba(22, 199, 132, 0.8)' : 'rgba(242, 54, 69, 0.8)';
                  
                  return (
                    <g key={i}>
                      {/* Wick */}
                      <line 
                        x1={x + width / 2} 
                        y1={yHigh} 
                        x2={x + width / 2} 
                        y2={yLow} 
                        stroke={candleColor} 
                      />
                      
                      {/* Candle body */}
                      <rect 
                        x={x} 
                        y={Math.min(yOpen, yClose)} 
                        width={width} 
                        height={Math.abs(yClose - yOpen) || 0.1} 
                        fill={candleColor} 
                      />
                    </g>
                  );
                })}
              </svg>
              
              <div className="absolute left-2 bottom-2 text-xs text-muted-foreground">
                Low: {formatPrice(lowPrice)}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">No chart data available</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground mt-3">
          <div>
            <span className="mr-2">{fromToken.symbol}/{toToken.symbol}</span>
            <span>{timeframe}</span>
          </div>
          <div className="flex items-center">
            <ArrowDownUp className="h-3 w-3 mr-1" />
            <span>TradingView</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}