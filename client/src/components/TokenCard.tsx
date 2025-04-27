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
    <Card className={`${gradient} rounded-xl p-5 shadow-lg`}>
      <div className="flex items-center mb-3">
        <div className="bg-white/10 rounded-full p-2 mr-3">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-white">{symbol}</h3>
          <span className="text-xs text-gray-300">
            {address ? address.substring(0, 8) + '...' : name}
          </span>
        </div>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-white">{formatCurrency(balance)}</span>
        {additionalInfo && (
          <span className="text-xs ml-1 text-gray-300">{additionalInfo}</span>
        )}
      </div>
    </Card>
  );
}
