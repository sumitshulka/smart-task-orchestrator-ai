import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, HardDrive, Link2Off } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RepositoryStatus = { connected: boolean; provider: string; email: string | null; rootFolderUrl: string | null; oauthConfigured: boolean; redirectUri: string };

export default function OrganizationDocumentRepository() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const status = useQuery<RepositoryStatus>({
    queryKey: ["/api/organization-settings/document-repository"],
    queryFn: () => apiClient.get("/organization-settings/document-repository"),
  });
  const connect = useMutation({
    mutationFn: () => apiClient.post("/organization-settings/document-repository/onedrive/start", {}),
    onSuccess: (result: { authorizationUrl: string }) => window.location.assign(result.authorizationUrl),
    onError: (error: Error) => toast({ title: "Could not start OneDrive connection", description: error.message, variant: "destructive" }),
  });
  const saveCredentials = useMutation({
    mutationFn: () => apiClient.post("/organization-settings/document-repository/onedrive/credentials", { clientId, clientSecret }),
    onSuccess: () => {
      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/organization-settings/document-repository"] });
      toast({ title: "Microsoft credentials saved", description: "Connect OneDrive to authorize this Microsoft application." });
    },
    onError: (error: Error) => toast({ title: "Could not save Microsoft credentials", description: error.message, variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: () => apiClient.delete("/organization-settings/document-repository"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization-settings/document-repository"] });
      toast({ title: "OneDrive disconnected" });
    },
    onError: (error: Error) => toast({ title: "Could not disconnect OneDrive", description: error.message, variant: "destructive" }),
  });

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Document repository</CardTitle>
      <CardDescription>Connect the organization’s OneDrive once. Project Managers can then create project folders and upload versioned files.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {status.isLoading ? <p className="text-sm text-muted-foreground">Checking connection…</p> :
        status.data?.connected ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div><p className="font-medium">OneDrive connected</p><p className="text-sm text-muted-foreground">{status.data.email}</p>
            {status.data.rootFolderUrl && <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline" href={status.data.rootFolderUrl} target="_blank" rel="noreferrer">Open repository folder <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
          <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Link2Off className="mr-2 h-4 w-4" />Disconnect OneDrive</Button>
        </div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div><p className="font-medium">No repository connected</p><p className="text-sm text-muted-foreground">Only an organization administrator can authorize the organization’s OneDrive.</p></div>
          <Button onClick={() => connect.mutate()} disabled={connect.isPending || !status.data?.oauthConfigured}>{connect.isPending ? "Connecting…" : "Connect OneDrive"}</Button>
        </div>}
      {status.isError && <p role="alert" className="text-sm text-destructive">Repository status could not be loaded.</p>}
      <div className="space-y-4 rounded-lg border p-4">
        <div><p className="font-medium">Microsoft application</p><p className="text-sm text-muted-foreground">Credentials are encrypted before storage and are never returned by the server. The app’s SESSION_SECRET protects stored credentials and OneDrive tokens.</p></div>
        <p className="text-sm text-muted-foreground">Register a web app in Microsoft Entra that supports organizational accounts and personal Microsoft accounts. Add the redirect URI below and grant delegated User.Read and Files.ReadWrite permissions.</p>
        {status.data?.oauthConfigured && <p className="text-sm text-emerald-700">Microsoft credentials are saved. Enter both fields again to replace them.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="microsoft-client-id">Application (client) ID</Label><Input id="microsoft-client-id" autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Microsoft application client ID" /></div>
          <div className="space-y-1.5"><Label htmlFor="microsoft-client-secret">Client secret value</Label><Input id="microsoft-client-secret" type="password" autoComplete="new-password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder="Microsoft client secret value" /></div>
        </div>
        <Button className="min-h-10 px-5 font-semibold shadow-sm" onClick={() => saveCredentials.mutate()} disabled={saveCredentials.isPending || !clientId.trim() || !clientSecret.trim()}>{saveCredentials.isPending ? "Saving…" : "Save Microsoft credentials"}</Button>
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Authorized redirect URI</p>
          <p className="mt-1 text-muted-foreground">Add this exact URI to the app registration’s Web redirect URIs.</p>
          <code className="mt-2 block break-all text-xs">{status.data?.redirectUri ?? "Loading callback URL…"}</code>
        </div>
      </div>
    </CardContent>
  </Card>;
}
