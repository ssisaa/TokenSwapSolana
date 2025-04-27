import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminSettings } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UpdateSettingsData = Partial<{
  liquidityContributionPercentage: string;
  liquidityRewardsRateDaily: string;
  liquidityRewardsRateWeekly: string;
  liquidityRewardsRateMonthly: string;
  stakeRateDaily: string;
  stakeRateHourly: string;
  stakeRatePerSecond: string;
}>;

export function useAdminSettings() {
  const { toast } = useToast();
  
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<AdminSettings, Error>({
    queryKey: ["/api/admin/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UpdateSettingsData) => {
      const res = await apiRequest("PUT", "/api/admin/settings", data);
      return res.json();
    },
    onSuccess: (updatedSettings: AdminSettings) => {
      queryClient.setQueryData(["/api/admin/settings"], updatedSettings);
      toast({
        title: "Settings updated",
        description: "The settings have been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettingsMutation,
  };
}