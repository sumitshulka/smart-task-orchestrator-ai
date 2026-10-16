import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FinanceSettings = {
  currency: string;
  revenueEntryRoles: string[];
  expenseHeads: Array<{ id: string; name: string; code: string; description: string | null; is_active: boolean }>;
};

export default function OrganizationFinanceSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rolesText, setRolesText] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const { data, isLoading } = useQuery<FinanceSettings>({
    queryKey: ["/api/organization-finance-settings"],
    queryFn: () => apiClient.get("/organization-finance-settings"),
  });
  useEffect(() => {
    if (data) setRolesText(data.revenueEntryRoles.join(", "));
  }, [data?.revenueEntryRoles]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/organization-finance-settings"] });

  const saveRoles = useMutation({
    mutationFn: () => apiClient.patch("/organization-finance-settings", {
      revenueEntryRoles: rolesText.split(",").map((role) => role.trim()).filter(Boolean),
    }),
    onSuccess: () => { toast({ title: "Revenue roles saved" }); refresh(); },
    onError: (error: Error) => toast({ title: "Could not save revenue roles", description: error.message, variant: "destructive" }),
  });
  const addHead = useMutation({
    mutationFn: () => apiClient.post("/organization-finance-heads", { name, code, description }),
    onSuccess: () => { setName(""); setCode(""); setDescription(""); toast({ title: "Expense head added" }); refresh(); },
    onError: (error: Error) => toast({ title: "Could not add expense head", description: error.message, variant: "destructive" }),
  });
  const retireHead = useMutation({
    mutationFn: (headId: string) => apiClient.delete(`/organization-finance-heads/${headId}`),
    onSuccess: refresh,
    onError: (error: Error) => toast({ title: "Could not retire expense head", description: error.message, variant: "destructive" }),
  });
  const updateHead = useMutation({
    mutationFn: () => apiClient.put(`/organization-finance-heads/${editingHeadId}`, {
      name: editName, code: editCode, description: editDescription,
    }),
    onSuccess: () => { setEditingHeadId(null); toast({ title: "Expense head updated" }); refresh(); },
    onError: (error: Error) => toast({ title: "Could not update expense head", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Revenue access</CardTitle><CardDescription>Only organization admins can change these project role titles. Members with a matching project role can choose the revenue basis and record accruals.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Authorized project role titles</Label><Input value={rolesText} onChange={(event) => setRolesText(event.target.value)} placeholder="Project Manager, Finance Manager, Project Director" /></div>
          <p className="text-xs text-muted-foreground">Enter comma-separated role titles, including custom project-template roles. Organization admins always retain access.</p>
          <Button onClick={() => saveRoles.mutate()} disabled={saveRoles.isPending}>Save revenue roles</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Organization expense heads</CardTitle><CardDescription>These categories are shared across projects. New expense entries use the organization currency ({data?.currency ?? "USD"}).</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Travel" /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="TRAVEL" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={1} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          </div>
          <Button onClick={() => addHead.mutate()} disabled={!name.trim() || !code.trim() || addHead.isPending}>Add expense head</Button>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading expense heads…</p> : (
            <div className="divide-y rounded-lg border">
              {(data?.expenseHeads ?? []).map((head) => (
                <div key={head.id} className="flex items-center justify-between gap-3 p-3">
                  {editingHeadId === head.id ? (
                    <div className="grid flex-1 gap-2 sm:grid-cols-3">
                      <Input aria-label="Expense head name" value={editName} onChange={(event) => setEditName(event.target.value)} />
                      <Input aria-label="Expense head code" value={editCode} onChange={(event) => setEditCode(event.target.value)} />
                      <Input aria-label="Expense head description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                    </div>
                  ) : (
                    <div><p className="font-medium">{head.name} <span className="text-xs text-muted-foreground">({head.code})</span></p>{head.description && <p className="text-xs text-muted-foreground">{head.description}</p>}</div>
                  )}
                  <div className="flex shrink-0 gap-2">
                    {editingHeadId === head.id ? (
                      <>
                        <Button size="sm" onClick={() => updateHead.mutate()} disabled={!editName.trim() || !editCode.trim() || updateHead.isPending}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingHeadId(null)}>Cancel</Button>
                      </>
                    ) : head.is_active ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditingHeadId(head.id); setEditName(head.name); setEditCode(head.code); setEditDescription(head.description ?? ""); }}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => retireHead.mutate(head.id)} disabled={retireHead.isPending}>Retire</Button>
                      </>
                    ) : <span className="text-xs text-muted-foreground">Retired</span>}
                  </div>
                </div>
              ))}
              {!data?.expenseHeads.length && <p className="p-4 text-sm text-muted-foreground">No expense heads have been created.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
