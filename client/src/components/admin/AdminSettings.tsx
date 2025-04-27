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
    }
  }, [settings]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter only changed values
    const changedValues: any = {};
    Object.entries(formValues).forEach(([key, value]) => {
      if (value && settings && value !== settings[key as keyof typeof settings]?.toString()) {
        changedValues[key] = value;
      }
    });
    
    // Update if there are changes
    if (Object.keys(changedValues).length > 0) {
      updateSettingsMutation.mutate(changedValues);
    }
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
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="liquidityContributionPercentage">
                        Liquidity Contribution Percentage
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Percentage of funds that go to the liquidity pool when users purchase tokens</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="liquidityContributionPercentage"
                        name="liquidityContributionPercentage"
                        type="number"
                        step="0.01"
                        placeholder="Enter percentage"
                        value={formValues.liquidityContributionPercentage}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="liquidityRewardsRateDaily">
                        Daily Liquidity Rewards Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Daily reward percentage for liquidity providers</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="liquidityRewardsRateDaily"
                        name="liquidityRewardsRateDaily"
                        type="number"
                        step="0.01"
                        placeholder="Enter daily rate"
                        value={formValues.liquidityRewardsRateDaily}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="liquidityRewardsRateWeekly">
                        Weekly Liquidity Rewards Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Weekly reward percentage for liquidity providers</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="liquidityRewardsRateWeekly"
                        name="liquidityRewardsRateWeekly"
                        type="number"
                        step="0.01"
                        placeholder="Enter weekly rate"
                        value={formValues.liquidityRewardsRateWeekly}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="liquidityRewardsRateMonthly">
                        Monthly Liquidity Rewards Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Monthly reward percentage for liquidity providers</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="liquidityRewardsRateMonthly"
                        name="liquidityRewardsRateMonthly"
                        type="number"
                        step="0.01"
                        placeholder="Enter monthly rate"
                        value={formValues.liquidityRewardsRateMonthly}
                        onChange={handleChange}
                        className="w-full"
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
                      <Label htmlFor="stakeRateDaily">
                        Daily Staking Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Daily reward percentage for staked tokens</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="stakeRateDaily"
                        name="stakeRateDaily"
                        type="number"
                        step="0.01"
                        placeholder="Enter daily rate"
                        value={formValues.stakeRateDaily}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="stakeRateHourly">
                        Hourly Staking Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Hourly reward percentage for staked tokens</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="stakeRateHourly"
                        name="stakeRateHourly"
                        type="number"
                        step="0.0001"
                        placeholder="Enter hourly rate"
                        value={formValues.stakeRateHourly}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="stakeRatePerSecond">
                        Per Second Staking Rate
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Per second reward percentage for staked tokens (for real-time calculations)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center">
                      <Input
                        id="stakeRatePerSecond"
                        name="stakeRatePerSecond"
                        type="number"
                        step="0.0000001"
                        placeholder="Enter per second rate"
                        value={formValues.stakeRatePerSecond}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <span className="ml-2">%</span>
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