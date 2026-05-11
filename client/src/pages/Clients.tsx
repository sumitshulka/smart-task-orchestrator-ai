import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Building2, Mail, Phone, Users, ChevronRight,
  Pencil, Trash2, Globe, Briefcase, AlertCircle,
} from "lucide-react";

const ORG_TYPES = ["Enterprise", "SMB", "Startup", "Government", "NGO", "Other"];
const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Manufacturing", "Retail",
  "Education", "Real Estate", "Legal", "Media", "Consulting", "Other",
];

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  prospect: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
};

const EMPTY_FORM = {
  name: "",
  organization_type: "",
  industry: "",
  primary_contact_name: "",
  email: "",
  phone: "",
  status: "active",
  notes: "",
};

export default function Clients() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);

  const { data: clients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiClient.get("/clients"),
  });

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/clients/all-contacts"],
    queryFn: () => apiClient.get("/clients/all-contacts"),
  });

  const contactsByClient: Record<string, number> = {};
  (contacts as any[]).forEach((c: any) => {
    contactsByClient[c.client_id] = (contactsByClient[c.client_id] || 0) + 1;
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post("/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client created" });
      setDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to create client.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.put(`/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
      setDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update client.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client deleted" });
      setDeleteDialog(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditClient(null);
    setForm(EMPTY_FORM);
    setDialog(true);
  };

  const openEdit = (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditClient(c);
    setForm({
      name: c.name || "",
      organization_type: c.organization_type || "",
      industry: c.industry || "",
      primary_contact_name: c.primary_contact_name || "",
      email: c.email || "",
      phone: c.phone || "",
      status: c.status || "active",
      notes: c.notes || "",
    });
    setDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Client name is required.", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      organization_type: form.organization_type || null,
      industry: form.industry || null,
      primary_contact_name: form.primary_contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      status: form.status,
      notes: form.notes || null,
    };
    if (editClient) {
      updateMutation.mutate({ id: editClient.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = (clients as any[]).filter((c: any) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.primary_contact_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage client organisations and their project portal access.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> New Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Client Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No clients found</p>
          <p className="text-sm mt-1">Create your first client to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <Card
              key={c.id}
              className="group cursor-pointer hover:shadow-md transition-all border border-gray-200 dark:border-gray-700"
              onClick={() => navigate(`/clients/${c.id}`)}
            >
              <CardContent className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate max-w-[160px]">{c.name}</p>
                      {(c.organization_type || c.industry) && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {[c.organization_type, c.industry].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={`text-xs border shrink-0 capitalize ${STATUS_STYLES[c.status] || STATUS_STYLES.active}`}>
                    {c.status}
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 mb-4">
                  {c.primary_contact_name && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">{c.primary_contact_name}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t dark:border-gray-700">
                  <span className="text-xs text-gray-400">
                    {contactsByClient[c.id] || 0} portal contact{(contactsByClient[c.id] || 0) !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => openEdit(c, e)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); setDeleteDialog(c); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialog} onOpenChange={(v) => { setDialog(v); if (!v) setEditClient(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editClient ? "Edit Client" : "New Client"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Section 1 – Client Identity */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 flex items-center gap-2 border-b dark:border-gray-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Client Identity</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Client / Organisation Name *</Label>
                  <Input
                    className="h-10"
                    placeholder="Acme Corporation"
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Organisation Type</Label>
                  <Select value={form.organization_type || "none"} onValueChange={(v) => setForm(p => ({ ...p, organization_type: v === "none" ? "" : v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {ORG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Industry</Label>
                  <Select value={form.industry || "none"} onValueChange={(v) => setForm(p => ({ ...p, industry: v === "none" ? "" : v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2 – Primary Contact */}
            <div className="rounded-xl border border-green-200 dark:border-green-800/50 overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-green-200 dark:border-green-800/50">
                <span className="h-5 w-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Primary Contact</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Contact Name</Label>
                  <Input className="h-10" placeholder="John Smith" value={form.primary_contact_name}
                    onChange={(e) => setForm(p => ({ ...p, primary_contact_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email</Label>
                  <Input className="h-10" type="email" placeholder="john@example.com" value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Phone</Label>
                  <Input className="h-10" type="tel" placeholder="+1 555 000 0000" value={form.phone}
                    onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Section 3 – Notes */}
            <div className="rounded-xl border border-purple-200 dark:border-purple-800/50 border-dashed overflow-hidden">
              <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-purple-200 dark:border-purple-800/50 border-dashed">
                <span className="h-5 w-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300">Notes</h3>
              </div>
              <div className="p-4">
                <Textarea
                  rows={3}
                  placeholder="Internal notes about this client…"
                  value={form.notes}
                  onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editClient ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteDialog} onOpenChange={(v) => { if (!v) setDeleteDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Delete Client
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 py-2">
            Are you sure you want to delete <strong>{deleteDialog?.name}</strong>? This will also remove all
            contacts and their project access. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteDialog?.id)}
              disabled={deleteMutation.isPending}
            >
              Delete Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
