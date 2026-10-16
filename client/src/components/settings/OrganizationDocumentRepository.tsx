import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, HardDrive, Link2Off } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProviderId = "google_drive" | "onedrive";
type Provider = { id: ProviderId; label: string; connected: boolean; email: string | null; rootFolderUrl: string | null; oauthConfigured: boolean; redirectUri: string };

function ProviderCard({ provider }: { provider: Provider }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const segment = provider.id === "google_drive" ? "google" : "onedrive";
  const name = provider.label;
  const save = useMutation({
    mutationFn: () => apiClient.post(`/organization-settings/document-repository/${segment}/credentials`, { clientId, clientSecret }),
    onSuccess: () => {
      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/organization-settings/document-repository"] });
      toast({ title: `${name} credentials saved`, description: `Connect ${name} to authorize this application.` });
    },
    onError: (error: Error) => toast({ title: `Could not save ${name} credentials`, description: error.message, variant: "destructive" }),
  });
  const connect = useMutation({
    mutationFn: () => apiClient.post(`/organization-settings/document-repository/${segment}/start`, {}),
    onSuccess: (result: { authorizationUrl: string }) => window.location.assign(result.authorizationUrl),
    onError: (error: Error) => toast({ title: `Could not start ${name} connection`, description: error.message, variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: () => apiClient.delete(`/organization-settings/document-repository/${provider.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization-settings/document-repository"] });
      toast({ title: `${name} disconnected` });
    },
    onError: (error: Error) => toast({ title: `Could not disconnect ${name}`, description: error.message, variant: "destructive" }),
  });

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" />{name}</CardTitle>
      <CardDescription>Connect this repository independently. Existing connections to other providers remain available.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {provider.connected ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="font-medium">{name} connected</p>
          <p className="text-sm text-muted-foreground">{provider.email}</p>
          {provider.rootFolderUrl && <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline" href={provider.rootFolderUrl} target="_blank" rel="noreferrer">Open repository folder <ExternalLink className="h-3.5 w-3.5" /></a>}
        </div>
        <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Link2Off className="mr-2 h-4 w-4" />Disconnect</Button>
      </div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Not connected. Connect this provider without affecting other repositories.</p>
        <Button onClick={() => connect.mutate()} disabled={connect.isPending || !provider.oauthConfigured}>{connect.isPending ? "Connecting…" : `Connect ${name}`}</Button>
      </div>}
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <p className="font-medium">{provider.id === "google_drive" ? "Google OAuth app" : "Microsoft app registration"}</p>
          <p className="text-sm text-muted-foreground">Credentials are encrypted before storage and are never returned. The app’s SESSION_SECRET protects saved credentials and repository tokens.</p>
          <p className="mt-2 text-sm text-muted-foreground">{provider.id === "google_drive"
            ? "For an external Google app, add the organization admin as a test user until the app is verified."
            : "Register a web app for organizational and personal Microsoft accounts. Grant delegated User.Read and Files.ReadWrite permissions."}</p>
        </div>
        {provider.oauthConfigured && <p className="text-sm text-emerald-700">Credentials saved. Enter both values again to replace them.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor={`${segment}-client-id`}>Application client ID</Label><Input id={`${segment}-client-id`} autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor={`${segment}-client-secret`}>Client secret</Label><Input id={`${segment}-client-secret`} type="password" autoComplete="new-password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} /></div>
        </div>
        <Button className="min-h-10 px-5 font-semibold shadow-sm" onClick={() => save.mutate()} disabled={save.isPending || !clientId.trim() || !clientSecret.trim()}>{save.isPending ? "Saving…" : `Save ${name} credentials`}</Button>
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Authorized redirect URI</p>
          <p className="mt-1 text-muted-foreground">Register this exact URI in the provider’s web application settings.</p>
          <code className="mt-2 block break-all text-xs">{provider.redirectUri}</code>
        </div>
      </div>
    </CardContent>
  </Card>;
}

export default function OrganizationDocumentRepository() {
  const status = useQuery<{ providers: Provider[] }>({
    queryKey: ["/api/organization-settings/document-repository"],
    queryFn: () => apiClient.get("/organization-settings/document-repository"),
  });
  if (status.isLoading) return <p className="text-sm text-muted-foreground">Checking repository connections…</p>;
  if (status.isError || !status.data) return <p role="alert" className="text-sm text-destructive">Repository settings could not be loaded.</p>;
  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold">Document repositories</h2><p className="mt-1 text-sm text-muted-foreground">Connect Google Drive and OneDrive independently. Each project keeps the provider selected when its folder is created.</p></div>
    <div className="grid gap-5 xl:grid-cols-2">{status.data.providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div>
  </div>;
}
