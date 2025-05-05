import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface TokenCardProps {
  symbol: string;
  name: string;
  balance: number | string;
  additionalInfo?: string;
  address?: string;
  icon: ReactNode;
  gradient: string;
}

export default function TokenCard({
  symbol,
  name,
  balance,
  additionalInfo,
  address,
  icon,
  gradient
}: TokenCardProps) {
  return (
    <Card className={`${gradient} rounded-xl p-6 shadow-lg relative overflow-hidden group transition-all duration-300 hover:shadow-xl hover:scale-[1.02]`}>
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_4s_infinite]"></div>
      </div>
      
      <div className="flex items-center mb-4 relative z-10">
        <div className="bg-white/10 backdrop-blur-sm rounded-full p-3 mr-4 shadow-inner">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-xl text-white">{symbol}</h3>
          <div className="flex items-center text-xs text-gray-300">
            {address ? (
              <>
                <span className="font-mono">{address.substring(0, 8)}...</span>
                <div className="w-1 h-1 bg-gray-500 rounded-full mx-2"></div>
                <span>{name}</span>
              </>
            ) : (
              <span>{name}</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-3 relative z-10">
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-white">{formatCurrency(balance)}</span>
          <span className="text-sm ml-2 text-gray-300 opacity-80">{symbol}</span>
        </div>
        {additionalInfo && (
          <div className="text-xs mt-1 text-gray-300 opacity-80">{additionalInfo}</div>
        )}
      </div>
    </Card>
  );
}
