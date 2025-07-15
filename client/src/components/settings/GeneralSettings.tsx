import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type OrganizationSettings = {
  id: string;
  organization_name: string;
  date_format: string;
  time_zone: string;
  benchmarking_enabled: boolean;
  min_hours_per_day: number;
  max_hours_per_day: number;
  min_hours_per_week: number;
  max_hours_per_week: number;
  min_hours_per_month: number;
  max_hours_per_month: number;
  allow_user_level_override: boolean;
  created_at: string;
  updated_at: string;
};

const DATE_FORMATS = [
  { label: "MM/DD/YYYY", value: "MM/dd/yyyy" },
  { label: "DD/MM/YYYY", value: "dd/MM/yyyy" },
  { label: "YYYY-MM-DD", value: "yyyy-MM-dd" },
  { label: "MMM DD, YYYY", value: "MMM dd, yyyy" },
  { label: "DD MMM YYYY", value: "dd MMM yyyy" },
];

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "Eastern Time (EST/EDT)", value: "America/New_York" },
  { label: "Central Time (CST/CDT)", value: "America/Chicago" },
  { label: "Mountain Time (MST/MDT)", value: "America/Denver" },
  { label: "Pacific Time (PST/PDT)", value: "America/Los_Angeles" },
  { label: "India Standard Time", value: "Asia/Kolkata" },
  { label: "Greenwich Mean Time", value: "Europe/London" },
];

const GeneralSettings: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Fetch organization settings
  const { data: settings, isLoading } = useQuery<OrganizationSettings>({
    queryKey: ['/api/organization-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/organization-settings');
      return response;
    }
  });

  const [formData, setFormData] = useState({
    organization_name: "",
    date_format: "MM/dd/yyyy",
    time_zone: "UTC",
    benchmarking_enabled: false,
    min_hours_per_day: 0,
    max_hours_per_day: 8,
    min_hours_per_week: 0,
    max_hours_per_week: 40,
    min_hours_per_month: 0,
    max_hours_per_month: 160,
    allow_user_level_override: false,
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        organization_name: settings.organization_name || "",
        date_format: settings.date_format || "MM/dd/yyyy",
        time_zone: settings.time_zone || "UTC",
        benchmarking_enabled: settings.benchmarking_enabled || false,
        min_hours_per_day: settings.min_hours_per_day || 0,
        max_hours_per_day: settings.max_hours_per_day || 8,
        min_hours_per_week: settings.min_hours_per_week || 0,
        max_hours_per_week: settings.max_hours_per_week || 40,
        min_hours_per_month: settings.min_hours_per_month || 0,
        max_hours_per_month: settings.max_hours_per_month || 160,
        allow_user_level_override: settings.allow_user_level_override || false,
      });
    }
  }, [settings]);

  // Create or update organization settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log("Saving settings data:", data);
      console.log("Settings ID exists:", settings?.id);
      
      if (settings?.id) {
        console.log("Updating existing settings with ID:", settings.id);
        return apiClient.patch(`/organization-settings/${settings.id}`, data);
      } else {
        console.log("Creating new settings");
        return apiClient.post('/organization-settings', data);
      }
    },
    onSuccess: (response) => {
      console.log("Settings saved successfully:", response);
      queryClient.invalidateQueries({ queryKey: ['/api/organization-settings'] });
      toast({ title: "Success", description: "Organization settings saved successfully" });
    },
    onError: (error: any) => {
      console.error("Error saving settings:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || "Unknown error";
      toast({ 
        title: "Error", 
        description: `Failed to save organization settings: ${errorMessage}`,
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(formData);
  };

  const formatPreview = (format: string) => {
    const now = new Date();
    try {
      // Simple format preview
      switch (format) {
        case "MM/dd/yyyy":
          return now.toLocaleDateString("en-US");
        case "dd/MM/yyyy":
          return now.toLocaleDateString("en-GB");
        case "yyyy-MM-dd":
          return now.toISOString().split('T')[0];
        case "MMM dd, yyyy":
          return now.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
        case "dd MMM yyyy":
          return now.toLocaleDateString("en-GB", { year: 'numeric', month: 'short', day: 'numeric' });
        default:
          return now.toLocaleDateString();
      }
    } catch {
      return "Invalid format";
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={formData.organization_name}
              onChange={(e) => handleFormChange('organization_name', e.target.value)}
              placeholder="Enter organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-format">Date Format</Label>
            <Select
              value={formData.date_format}
              onValueChange={(value) => handleFormChange('date_format', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select date format" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label} ({formatPreview(format.value)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Time Zone</Label>
            <Select
              value={formData.time_zone}
              onValueChange={(value) => handleFormChange('time_zone', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Benchmarking Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmarking Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="benchmarking-enabled"
              checked={formData.benchmarking_enabled}
              onCheckedChange={(checked) => handleFormChange('benchmarking_enabled', checked)}
            />
            <Label htmlFor="benchmarking-enabled">Enable Benchmarking</Label>
          </div>

          {formData.benchmarking_enabled && (
            <div className="space-y-6 pl-4 border-l-2 border-muted">
              {/* Daily Hours */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Daily Hours Requirements</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-hours-day">Minimum Hours/Day</Label>
                    <Input
                      id="min-hours-day"
                      type="number"
                      min="0"
                      max="24"
                      value={formData.min_hours_per_day}
                      onChange={(e) => handleFormChange('min_hours_per_day', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-hours-day">Maximum Hours/Day</Label>
                    <Input
                      id="max-hours-day"
                      type="number"
                      min="0"
                      max="24"
                      value={formData.max_hours_per_day}
                      onChange={(e) => handleFormChange('max_hours_per_day', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Weekly Hours */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Weekly Hours Requirements</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-hours-week">Minimum Hours/Week</Label>
                    <Input
                      id="min-hours-week"
                      type="number"
                      min="0"
                      max="168"
                      value={formData.min_hours_per_week}
                      onChange={(e) => handleFormChange('min_hours_per_week', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-hours-week">Maximum Hours/Week</Label>
                    <Input
                      id="max-hours-week"
                      type="number"
                      min="0"
                      max="168"
                      value={formData.max_hours_per_week}
                      onChange={(e) => handleFormChange('max_hours_per_week', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Monthly Hours */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Monthly Hours Requirements</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-hours-month">Minimum Hours/Month</Label>
                    <Input
                      id="min-hours-month"
                      type="number"
                      min="0"
                      max="744"
                      value={formData.min_hours_per_month}
                      onChange={(e) => handleFormChange('min_hours_per_month', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-hours-month">Maximum Hours/Month</Label>
                    <Input
                      id="max-hours-month"
                      type="number"
                      min="0"
                      max="744"
                      value={formData.max_hours_per_month}
                      onChange={(e) => handleFormChange('max_hours_per_month', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* User Level Override */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="user-override"
                    checked={formData.allow_user_level_override}
                    onCheckedChange={(checked) => handleFormChange('allow_user_level_override', checked)}
                  />
                  <Label htmlFor="user-override">Allow User-Level Override</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, admins can exclude individual users from benchmarking or set custom hour requirements per user.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saveSettingsMutation.isPending}
          size="lg"
        >
          {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default GeneralSettings;