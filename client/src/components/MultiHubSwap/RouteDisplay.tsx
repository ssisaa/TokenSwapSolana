import React from "react";
import { ArrowDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RouteStep {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  percent?: number;
}

interface RouteDisplayProps {
  route: RouteStep[];
  label?: string;
  className?: string;
}

export const RouteDisplay: React.FC<RouteDisplayProps> = ({
  route,
  label = "Route",
  className = ""
}) => {
  if (!route || route.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center flex-wrap gap-1">
        {route.map((step, index) => (
          <React.Fragment key={`${step.tokenAddress}-${index}`}>
            {index > 0 && <ArrowDownIcon className="h-4 w-4 rotate-90 text-muted-foreground" />}
            <Badge variant="outline" className="font-medium">
              {step.tokenSymbol}
            </Badge>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};