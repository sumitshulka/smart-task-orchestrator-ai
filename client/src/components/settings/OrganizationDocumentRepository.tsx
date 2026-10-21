import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, ExternalLink, HardDrive, Link2Off } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ProviderId = "google_drive" | "onedrive";
type Provider = { id: ProviderId; label: string; connected: boolean; email: string | null; rootFolderUrl: string | null; oauthConfigured: boolean; redirectUri: string };

function ProviderCard({ provider }: { provider: Provider }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const segment = provider.id === "google_drive" ? "google" : "onedrive";
  const name = provider.label;
  const isGoogle = provider.id === "google_drive";
  const setupSteps = isGoogle ? [
    <>Open the <a className="text-primary underline" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a> and create or select a project.</>,
    <>In <strong>APIs &amp; Services → Library</strong>, enable the <strong>Google Drive API</strong>.</>,
    <>Configure the OAuth consent screen. If the app is in testing, add the organization admin’s Google account as a test user.</>,
    <>Create an OAuth client ID with application type <strong>Web application</strong>. Add the exact redirect URI shown on this provider card under <strong>Authorized redirect URIs</strong>.</>,
    <>Copy the client ID and client secret into this card and choose <strong>Save Google Drive credentials</strong>.</>,
    <>Choose <strong>Connect Google Drive</strong>, sign in with the account that should own the organization’s repository, and approve access.</>,
  ] : [
    <>Open the <a className="text-primary underline" href="https://entra.microsoft.com/" target="_blank" rel="noreferrer">Microsoft Entra admin center</a>, go to <strong>App registrations</strong>, and create a registration.</>,
    <>Choose the account type for <strong>organizations and personal Microsoft accounts</strong> so the app can use Microsoft’s common sign-in endpoint.</>,
    <>Under <strong>Authentication</strong>, add a <strong>Web</strong> platform and enter the exact redirect URI shown on this provider card.</>,
    <>Under <strong>Certificates &amp; secrets</strong>, create a client secret. Copy its <strong>Value</strong> now; Microsoft only displays it once.</>,
    <>Under <strong>API permissions</strong>, add Microsoft Graph delegated permissions <strong>User.Read</strong> and <strong>Files.ReadWrite</strong>.</>,
    <>Copy the application (client) ID and secret value into this card, choose <strong>Save OneDrive credentials</strong>, then choose <strong>Connect OneDrive</strong> and approve access.</>,
  ];
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" />{name}</CardTitle>
          <CardDescription className="mt-2">Connect this repository independently. Existing connections to other providers remain available.</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0"><CircleHelp className="mr-2 h-4 w-4" />Setup guide</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{name} setup guide</DialogTitle>
              <DialogDescription>Follow these steps to register the app, save its credentials, and connect the organization’s repository.</DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
              {setupSteps.map((step, index) => <li key={index} className="pl-1">{step}</li>)}
            </ol>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">Redirect URI for this {name} app</p>
              <code className="mt-1 block break-all text-xs text-muted-foreground">{provider.redirectUri}</code>
              <p className="mt-2 text-xs text-muted-foreground">Copy it exactly. It must match the redirect URI registered with the provider.</p>
            </div>
            {isGoogle && <p className="text-xs text-muted-foreground">Google OAuth apps in testing only allow listed test users. The organization admin who connects Drive must be on that list until the app is verified.</p>}
          </DialogContent>
        </Dialog>
      </div>
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
