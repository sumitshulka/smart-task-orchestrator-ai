import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Wifi, WifiOff, Save, RefreshCw, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PROVIDER_MODELS: Record<string, { label: string; models: string[]; needsBaseUrl?: boolean }> = {
  openai: {
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
    ],
  },
  google: {
    label: "Google Gemini",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"],
  },
  azure: {
    label: "Azure OpenAI",
    models: ["gpt-4o", "gpt-4", "gpt-35-turbo"],
    needsBaseUrl: true,
  },
  mistral: {
    label: "Mistral AI",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mixtral-8x22b"],
  },
  ollama: {
    label: "Ollama (Local)",
    models: ["llama3.2", "llama3.1", "mistral", "codellama", "phi3", "gemma2"],
    needsBaseUrl: true,
  },
};

interface AiSettingsData {
  provider: string;
  api_key: string;
  model: string;
  base_url: string;
  system_prompt_header: string;
  is_enabled: boolean;
  allow_admin: boolean;
  allow_manager: boolean;
  allow_user: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant that helps users create tasks in the TaskRep task management system.

Your role:
- ONLY assist with task creation. If asked about anything else, politely redirect to task creation.
- Ask clarifying questions one at a time when required information is missing.
- Be concise, professional, and conversational.
- Required fields: Title, Assigned To.
- Optional fields: Description, Priority (Critical/High/Medium/Low/Minimal), Due Date, Type (Personal/Team).
- When referencing users, only use names from the provided user list.
- For due dates, calculate the actual date from relative expressions (e.g. "in 3 days", "next Monday").

Once you have all required information, immediately output the task using the TASK_JSON marker.`;

const AiSettings: React.FC = () => {
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [form, setForm] = useState<AiSettingsData>({
    provider: "openai",
    api_key: "",
    model: "gpt-4o",
    base_url: "",
    system_prompt_header: DEFAULT_SYSTEM_PROMPT,
    is_enabled: false,
    allow_admin: true,
    allow_manager: false,
    allow_user: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/ai/settings"],
    queryFn: () => apiClient.get("/ai/settings"),
  });

  useEffect(() => {
    if (data) {
      setForm({
        provider: data.provider ?? "openai",
        api_key: data.api_key ?? "",
        model: data.model ?? "gpt-4o",
        base_url: data.base_url ?? "",
        system_prompt_header: data.system_prompt_header ?? DEFAULT_SYSTEM_PROMPT,
        is_enabled: data.is_enabled ?? false,
        allow_admin: data.allow_admin ?? true,
        allow_manager: data.allow_manager ?? false,
        allow_user: data.allow_user ?? false,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: AiSettingsData) => apiClient.put("/ai/settings", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "AI settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const handleTest = async () => {
    if (!form.api_key) {
      toast({ title: "Enter an API key first before testing", variant: "destructive" });
      return;
    }
    setTestStatus("testing");
    try {
      // Pass current form values so the test works even before saving
      await apiClient.post("/ai/test-connection", {
        provider: form.provider,
        api_key: form.api_key,
        model: form.model,
        base_url: form.base_url || null,
      });
      setTestStatus("ok");
      toast({ title: "Connection successful" });
    } catch (err: any) {
      setTestStatus("fail");
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    }
  };

  const handleProviderChange = (p: string) => {
    const models = PROVIDER_MODELS[p]?.models ?? [];
    setForm((f) => ({ ...f, provider: p, model: models[0] ?? "" }));
    setTestStatus("idle");
  };

  const providerInfo = PROVIDER_MODELS[form.provider];
  const needsBaseUrl = providerInfo?.needsBaseUrl ?? false;

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading AI settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Enable / Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Task Creation</CardTitle>
          <CardDescription>
            Allow users to create tasks via a conversational AI chat interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="ai-enabled"
              checked={form.is_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_enabled: v }))}
            />
            <Label htmlFor="ai-enabled" className="cursor-pointer">
              {form.is_enabled ? "Enabled" : "Disabled"}
            </Label>
            {form.is_enabled && (
              <Badge variant="outline" className="ml-2 text-green-600 border-green-400">
                Active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Provider</CardTitle>
          <CardDescription>Select the AI provider and configure your API key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={form.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_MODELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key */}
          {form.provider !== "ollama" && (
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.api_key}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, api_key: e.target.value }));
                    setTestStatus("idle");
                  }}
                  placeholder="Enter API key…"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored encrypted. Only the last 4 characters are shown after saving.
              </p>
            </div>
          )}

          {/* Base URL (Azure / Ollama) */}
          {needsBaseUrl && (
            <div className="space-y-1.5">
              <Label>
                {form.provider === "azure" ? "Azure Endpoint URL" : "Ollama Base URL"}
              </Label>
              <Input
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder={
                  form.provider === "azure"
                    ? "https://YOUR_RESOURCE.openai.azure.com/"
                    : "http://localhost:11434"
                }
              />
            </div>
          )}

          {/* Model */}
          <div className="space-y-1.5">
            <Label>Model</Label>
            <div className="flex gap-2">
              <Select
                value={
                  providerInfo?.models.includes(form.model) ? form.model : "__custom__"
                }
                onValueChange={(v) => {
                  if (v !== "__custom__") setForm((f) => ({ ...f, model: v }));
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerInfo?.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                  {!providerInfo?.models.includes(form.model) && (
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Input
                className="flex-1"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="or type a custom model name"
              />
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing" ? (
                <RefreshCw size={14} className="animate-spin mr-1" />
              ) : testStatus === "ok" ? (
                <Wifi size={14} className="mr-1 text-green-500" />
              ) : testStatus === "fail" ? (
                <WifiOff size={14} className="mr-1 text-red-500" />
              ) : (
                <Wifi size={14} className="mr-1" />
              )}
              Test Connection
            </Button>
            {testStatus === "ok" && (
              <span className="text-sm text-green-600">Connected successfully</span>
            )}
            {testStatus === "fail" && (
              <span className="text-sm text-red-500">Connection failed — check key/model</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access Control</CardTitle>
          <CardDescription>
            Choose which roles can use AI task creation on the Tasks page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { field: "allow_admin" as const, label: "Admin" },
            { field: "allow_manager" as const, label: "Manager" },
            { field: "allow_user" as const, label: "User" },
          ].map(({ field, label }) => (
            <div key={field} className="flex items-center gap-2.5">
              <Checkbox
                id={field}
                checked={form[field]}
                onCheckedChange={(v) => setForm((f) => ({ ...f, [field]: !!v }))}
              />
              <Label htmlFor={field} className="cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* System Prompt Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Prompt Header</CardTitle>
          <CardDescription>
            This is the editable portion of the AI system prompt. The system automatically appends
            the current date, user list, task statuses, and JSON schema at runtime — you do not need
            to add those.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info size={14} />
            <AlertDescription className="text-xs">
              Keep instructions clear and focused on task creation. The system-controlled footer is
              appended automatically and cannot be edited here.
            </AlertDescription>
          </Alert>
          <Textarea
            rows={12}
            value={form.system_prompt_header}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt_header: e.target.value }))}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save AI Settings
        </Button>
      </div>
    </div>
  );
};

export default AiSettings;
