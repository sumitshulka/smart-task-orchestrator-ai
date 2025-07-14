import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";

type OrganizationSettings = {
  id: string;
  organization_name: string;
  date_format: string;
  time_zone: string;
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
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    organization_name: "",
    date_format: "MM/dd/yyyy",
    time_zone: "UTC",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // For now, use localStorage to store organization settings
      const savedSettings = localStorage.getItem('organization_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        setFormData({
          organization_name: parsed.organization_name || "",
          date_format: parsed.date_format || "MM/dd/yyyy",
          time_zone: parsed.time_zone || "UTC",
        });
      } else {
        // Default settings
        setFormData({
          organization_name: "My Organization",
          date_format: "MM/dd/yyyy",
          time_zone: "UTC",
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({ title: "Error", description: "Failed to load organization settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newSettings = {
        id: settings?.id || "default",
        ...formData,
        created_at: settings?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to localStorage for now
      localStorage.setItem('organization_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      
      toast({ title: "Settings saved successfully" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error", description: "Failed to save organization settings" });
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={formData.organization_name}
              onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
              placeholder="Enter organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-format">Date Format</Label>
            <Select
              value={formData.date_format}
              onValueChange={(value) => setFormData({ ...formData, date_format: value })}
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
              onValueChange={(value) => setFormData({ ...formData, time_zone: value })}
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

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GeneralSettings;