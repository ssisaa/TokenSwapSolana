import React from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TokenInfo } from '@/lib/token-search-api';

// Sample data for the price chart
const sampleData = [
  { day: 'Day 1', price: 9800 },
  { day: 'Day 2', price: 10200 },
  { day: 'Day 3', price: 10300 },
  { day: 'Day 4', price: 10100 },
  { day: 'Day 5', price: 10500 },
  { day: 'Day 6', price: 10700 },
  { day: 'Day 7', price: 10500 },
  { day: 'Day 8', price: 10600 },
  { day: 'Day 9', price: 10900 },
  { day: 'Day 10', price: 11000 },
  { day: 'Day 11', price: 10800 },
  { day: 'Day 12', price: 10700 },
  { day: 'Day 13', price: 10900 },
  { day: 'Day 14', price: 11200 },
];

interface TokenPriceChartProps {
  fromToken?: TokenInfo;
  toToken?: TokenInfo;
}

export function TokenPriceChart({ fromToken, toToken }: TokenPriceChartProps) {
  // In a real implementation, we would fetch actual price data
  // For now, we use static sample data
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampleData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
          <XAxis 
            dataKey="day" 
            tick={{ fill: '#a3accd' }} 
            stroke="#1e2a45" 
          />
          <YAxis 
            tick={{ fill: '#a3accd' }} 
            stroke="#1e2a45"
            domain={['dataMin - 200', 'dataMax + 200']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a2338', 
              borderColor: '#1e2a45',
              color: 'white' 
            }}
            labelStyle={{ color: 'white' }}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#7c3aed" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#7c3aed', stroke: '#1a2338' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 text-center text-sm text-gray-400">
        Note: This chart shows simulated data for demonstration purposes
      </div>
    </div>
  );
}