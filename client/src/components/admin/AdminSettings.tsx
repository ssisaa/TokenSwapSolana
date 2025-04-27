import React, { useState } from "react";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, InfoIcon } from "lucide-react";

export default function AdminSettings() {
  const { settings, isLoading, updateSettingsMutation } = useAdminSettings();
  
  const [formValues, setFormValues] = useState({
    liquidityContributionPercentage: "",
    liquidityRewardsRateDaily: "",
    liquidityRewardsRateWeekly: "",
    liquidityRewardsRateMonthly: "",
    stakeRateDaily: "",
    stakeRateHourly: "",
    stakeRatePerSecond: "",
  });
  
  // New state for selecting rate type and value
  const [buyLiquidityRate, setBuyLiquidityRate] = useState("33");
  const [sellLiquidityRate, setSellLiquidityRate] = useState("33");
  const [selectedLiquidityRateType, setSelectedLiquidityRateType] = useState("daily");
  
  const [stakingRate, setStakingRate] = useState("0.00125");
  const [selectedStakingRateType, setSelectedStakingRateType] = useState("second");
  
  // Harvest threshold
  const [harvestThreshold, setHarvestThreshold] = useState("100");
  
  // Initialize form values when settings load
  React.useEffect(() => {
    if (settings) {
      setFormValues({
        liquidityContributionPercentage: settings.liquidityContributionPercentage.toString(),
        liquidityRewardsRateDaily: settings.liquidityRewardsRateDaily.toString(),
        liquidityRewardsRateWeekly: settings.liquidityRewardsRateWeekly.toString(),
        liquidityRewardsRateMonthly: settings.liquidityRewardsRateMonthly.toString(),
        stakeRateDaily: settings.stakeRateDaily.toString(),
        stakeRateHourly: settings.stakeRateHourly.toString(),
        stakeRatePerSecond: settings.stakeRatePerSecond.toString(),
      });
      
      // Initialize the new state values
      setBuyLiquidityRate(settings.liquidityContributionPercentage.toString());
      setSellLiquidityRate(settings.liquidityContributionPercentage.toString());
      setStakingRate(settings.stakeRatePerSecond.toString());
    }
  }, [settings]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };
  
  // Converts the staking rate based on selected type
  const convertStakingRate = (rate: string, fromType: string): { daily: string, hourly: string, second: string } => {
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum)) return { daily: "0", hourly: "0", second: "0" };
    
    let daily = 0, hourly = 0, second = 0;
    
    switch (fromType) {
      case "daily":
        daily = rateNum;
        hourly = daily / 24;
        second = hourly / 3600;
        break;
      case "hourly":
        hourly = rateNum;
        daily = hourly * 24;
        second = hourly / 3600;
        break;
      case "second":
        second = rateNum;
        hourly = second * 3600;
        daily = hourly * 24;
        break;
    }
    
    return {
      daily: daily.toString(),
      hourly: hourly.toString(),
      second: second.toString()
    };
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert rates based on selected types
    const stakingRates = convertStakingRate(stakingRate, selectedStakingRateType);
    
    // Update with the new values
    const updatedValues: any = {
      liquidityContributionPercentage: buyLiquidityRate, // Using buy rate for now
      stakeRateDaily: stakingRates.daily,
      stakeRateHourly: stakingRates.hourly,
      stakeRatePerSecond: stakingRates.second
    };
    
    // Update if there are changes
    updateSettingsMutation.mutate(updatedValues);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Admin Settings</CardTitle>
        <CardDescription>
          Configure rates and percentages for the YOT ecosystem
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Accordion type="single" collapsible defaultValue="liquidity">
            <AccordionItem value="liquidity">
              <AccordionTrigger className="text-lg font-semibold">
                Liquidity Settings
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 mt-2">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="buyLiquidityRate">
                        Buy Side Liquidity Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Percentage of funds that go to the liquidity pool when users buy tokens</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="buyLiquidityRate"
                        type="number"
                        step="0.01"
                        placeholder="Enter rate"
                        value={buyLiquidityRate}
                        onChange={(e) => setBuyLiquidityRate(e.target.value)}
                        className="flex-1"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sellLiquidityRate">
                        Sell Side Liquidity Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Percentage of funds that go to the liquidity pool when users sell tokens</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sellLiquidityRate"
                        type="number"
                        step="0.01"
                        placeholder="Enter rate"
                        value={sellLiquidityRate}
                        onChange={(e) => setSellLiquidityRate(e.target.value)}
                        className="flex-1"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="staking">
              <AccordionTrigger className="text-lg font-semibold">
                Staking Settings
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 mt-2">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="stakingRate">
                        Staking Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Reward percentage for staked tokens</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="stakingRate"
                        type="number"
                        step="0.0000001"
                        placeholder="Enter rate"
                        value={stakingRate}
                        onChange={(e) => setStakingRate(e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={selectedStakingRateType}
                        onValueChange={setSelectedStakingRateType}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="second">Per Second</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Preview of converted rates */}
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>Current rate: {stakingRate}% per {selectedStakingRateType}</p>
                      <p className="mt-1">
                        {selectedStakingRateType !== "second" && 
                          `Equivalent to approximately ${
                            parseFloat(convertStakingRate(stakingRate, selectedStakingRateType).second).toFixed(8)
                          }% per second`
                        }
                        {selectedStakingRateType === "second" && 
                          `Equivalent to approximately ${
                            parseFloat(convertStakingRate(stakingRate, selectedStakingRateType).daily).toFixed(4)
                          }% per day`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          <div className="mt-6">
            <Button 
              type="submit" 
              className="w-full"
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving changes...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          Last updated: {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "Never"}
        </div>
      </CardFooter>
    </Card>
  );
}