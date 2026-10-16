import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, HardDrive, Link2Off } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RepositoryStatus = { connected: boolean; provider: string; email: string | null; rootFolderUrl: string | null; oauthConfigured: boolean; redirectUri: string };

export default function OrganizationDocumentRepository() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const status = useQuery<RepositoryStatus>({
    queryKey: ["/api/organization-settings/document-repository"],
    queryFn: () => apiClient.get("/organization-settings/document-repository"),
  });
  const connect = useMutation({
    mutationFn: () => apiClient.post("/organization-settings/document-repository/google/start", {}),
    onSuccess: (result: { authorizationUrl: string }) => window.location.assign(result.authorizationUrl),
    onError: (error: Error) => toast({ title: "Could not start Google Drive connection", description: error.message, variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: () => apiClient.delete("/organization-settings/document-repository"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization-settings/document-repository"] });
      toast({ title: "Google Drive disconnected" });
    },
    onError: (error: Error) => toast({ title: "Could not disconnect Google Drive", description: error.message, variant: "destructive" }),
  });

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Document repository</CardTitle>
      <CardDescription>Connect the organization’s Google Drive once. Project Managers can then create project folders and upload versioned files.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {status.isLoading ? <p className="text-sm text-muted-foreground">Checking connection…</p> :
        status.data?.connected ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div><p className="font-medium">Google Drive connected</p><p className="text-sm text-muted-foreground">{status.data.email}</p>
            {status.data.rootFolderUrl && <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline" href={status.data.rootFolderUrl} target="_blank" rel="noreferrer">Open repository folder <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
          <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Link2Off className="mr-2 h-4 w-4" />Disconnect</Button>
        </div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div><p className="font-medium">No repository connected</p><p className="text-sm text-muted-foreground">Only an organization administrator can authorize the organization’s Google Drive.</p></div>
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? "Connecting…" : "Connect Google Drive"}</Button>
        </div>}
      {status.isError && <p role="alert" className="text-sm text-destructive">Repository status could not be loaded.</p>}
      {!status.data?.oauthConfigured && <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">Google OAuth app setup is required</p>
        <p className="mt-1 text-muted-foreground">Add the app’s OAuth client ID and client secret in Replit Secrets, and register this callback URL in Google Cloud:</p>
        <code className="mt-2 block break-all text-xs">{status.data?.redirectUri ?? "Loading callback URL…"}</code>
      </div>}
    </CardContent>
  </Card>;
}
