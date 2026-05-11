import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import {
  ArrowLeft, Pencil, Trash2, Plus, Users, Building2, Mail, Phone,
  Globe, Briefcase, Eye, MessageSquare, CheckCircle2, Key, AlertCircle,
  FolderKanban, ShieldCheck, ExternalLink, UserCircle, CheckSquare,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  prospect: "bg-amber-100 text-amber-800 border-amber-200",
};

const ACCESS_LEVEL_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  observer:     { label: "Observer",     color: "bg-blue-100 text-blue-800 border-blue-200",     icon: Eye,           description: "View-only access to project information" },
  collaborator: { label: "Collaborator", color: "bg-purple-100 text-purple-800 border-purple-200", icon: MessageSquare, description: "Can comment and report defects" },
  approver:     { label: "Approver",     color: "bg-green-100 text-green-800 border-green-200",    icon: CheckCircle2,  description: "Can approve milestones and tasks" },
};

const ACCESS_LEVEL_PRESETS: Record<string, Partial<typeof EMPTY_ACCESS_FORM>> = {
  observer:     { can_view_defects: true,  can_create_defects: false, can_edit_defects: false, can_approve_defects: false, can_approve_milestones: false, can_view_tasks: true,  can_view_timesheets: false },
  collaborator: { can_view_defects: true,  can_create_defects: true,  can_edit_defects: true,  can_approve_defects: false, can_approve_milestones: false, can_view_tasks: true,  can_view_timesheets: false },
  approver:     { can_view_defects: true,  can_create_defects: true,  can_edit_defects: true,  can_approve_defects: true,  can_approve_milestones: true,  can_view_tasks: true,  can_view_timesheets: true  },
};

const EMPTY_CONTACT_FORM = {
  name: "",
  email: "",
  phone: "",
  job_title: "",
  access_level: "observer",
  is_active: true,
  password: "",
};

const EMPTY_ACCESS_FORM = {
  contact_id: "",
  access_level: "observer",
  can_view_defects: true,
  can_create_defects: false,
  can_edit_defects: false,
  can_approve_defects: false,
  can_approve_milestones: false,
  can_view_tasks: true,
  can_view_timesheets: false,
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Contact dialog state
  const [contactDialog, setContactDialog] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [deleteContactDialog, setDeleteContactDialog] = useState<any>(null);
  const [pwDialog, setPwDialog] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  // Project access dialog state
  const [accessDialog, setAccessDialog] = useState(false);
  const [accessForm, setAccessForm] = useState(EMPTY_ACCESS_FORM);
  const [editAccess, setEditAccess] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  // Client queries
  const { data: client, isLoading } = useQuery<any>({
    queryKey: ["/api/clients", id],
    queryFn: () => apiClient.get(`/clients/${id}`),
  });

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", id, "contacts"],
    queryFn: () => apiClient.get(`/clients/${id}/contacts`),
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiClient.get("/projects"),
  });

  // Get all project accesses for this client's contacts
  const { data: allAccesses = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", id, "project-access"],
    queryFn: async () => {
      const contactsData = await apiClient.get(`/clients/${id}/contacts`) as any[];
      const accessLists = await Promise.all(
        contactsData.map((c: any) => apiClient.get(`/contacts/${c.id}/project-access`).catch(() => []))
      );
      return accessLists.flat();
    },
    enabled: !!contacts.length,
  });

  // Contact mutations
  const createContactMutation = useMutation({
    mutationFn: (data: any) => apiClient.post(`/clients/${id}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/all-contacts"] });
      toast({ title: "Contact added" });
      setContactDialog(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to create contact.", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) =>
      apiClient.put(`/clients/${id}/contacts/${contactId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "contacts"] });
      toast({ title: "Contact updated" });
      setContactDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => apiClient.delete(`/clients/${id}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/all-contacts"] });
      toast({ title: "Contact removed" });
      setDeleteContactDialog(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" }),
  });

  const setPasswordMutation = useMutation({
    mutationFn: ({ contactId, password }: { contactId: string; password: string }) =>
      apiClient.post(`/clients/${id}/contacts/${contactId}/set-password`, { password }),
    onSuccess: () => {
      toast({ title: "Portal password updated" });
      setPwDialog(null);
      setNewPassword("");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to set password.", variant: "destructive" }),
  });

  // Project access mutations
  const grantAccessMutation = useMutation({
    mutationFn: (data: any) => apiClient.post(`/projects/${data.project_id}/client-access`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "project-access"] });
      toast({ title: "Project access granted" });
      setAccessDialog(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to grant access.", variant: "destructive" }),
  });

  const updateAccessMutation = useMutation({
    mutationFn: ({ projectId, accessId, data }: { projectId: string; accessId: string; data: any }) =>
      apiClient.put(`/projects/${projectId}/client-access/${accessId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "project-access"] });
      toast({ title: "Access updated" });
      setAccessDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update access.", variant: "destructive" }),
  });

  const quickUpdateAccessMutation = useMutation({
    mutationFn: ({ projectId, accessId, data }: { projectId: string; accessId: string; data: any }) =>
      apiClient.put(`/projects/${projectId}/client-access/${accessId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "project-access"] });
      toast({ title: "Access level updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update access.", variant: "destructive" }),
  });

  const revokeAccessMutation = useMutation({
    mutationFn: ({ projectId, accessId }: { projectId: string; accessId: string }) =>
      apiClient.delete(`/projects/${projectId}/client-access/${accessId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "project-access"] });
      toast({ title: "Access revoked" });
    },
    onError: () => toast({ title: "Error", description: "Failed to revoke access.", variant: "destructive" }),
  });

  const openAddContact = () => {
    setEditContact(null);
    setContactForm(EMPTY_CONTACT_FORM);
    setContactDialog(true);
  };

  const openEditContact = (c: any) => {
    setEditContact(c);
    setContactForm({ name: c.name, email: c.email, phone: c.phone || "", job_title: c.job_title || "", access_level: c.access_level, is_active: c.is_active ?? true, password: "" });
    setContactDialog(true);
  };

  const handleSaveContact = () => {
    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      toast({ title: "Name and email are required.", variant: "destructive" });
      return;
    }
    const payload: any = {
      name: contactForm.name.trim(),
      email: contactForm.email.trim(),
      phone: contactForm.phone || null,
      job_title: contactForm.job_title || null,
      access_level: contactForm.access_level,
      is_active: contactForm.is_active,
    };
    if (contactForm.password) payload.password = contactForm.password;
    if (editContact) {
      updateContactMutation.mutate({ contactId: editContact.id, data: payload });
    } else {
      createContactMutation.mutate(payload);
    }
  };

  const openGrantAccess = (preContactId?: string) => {
    setEditAccess(null);
    setSelectedProject(null);
    setAccessForm({ ...EMPTY_ACCESS_FORM, contact_id: preContactId || contacts[0]?.id || "" });
    setAccessDialog(true);
  };

  const openEditAccess = (access: any, project: any) => {
    setEditAccess(access);
    setSelectedProject(project);
    setAccessForm({
      contact_id: access.contact_id,
      access_level: access.access_level,
      can_view_defects: access.can_view_defects ?? true,
      can_create_defects: access.can_create_defects ?? false,
      can_edit_defects: access.can_edit_defects ?? false,
      can_approve_defects: access.can_approve_defects ?? false,
      can_approve_milestones: access.can_approve_milestones ?? false,
      can_view_tasks: access.can_view_tasks ?? true,
      can_view_timesheets: access.can_view_timesheets ?? false,
    });
    setAccessDialog(true);
  };

  const applyAccessLevel = (level: string) => {
    setAccessForm(p => ({ ...p, access_level: level, ...ACCESS_LEVEL_PRESETS[level] }));
  };

  const handleSaveAccess = () => {
    if (!accessForm.contact_id) {
      toast({ title: "Select a contact.", variant: "destructive" }); return;
    }
    if (editAccess) {
      updateAccessMutation.mutate({ projectId: editAccess.project_id, accessId: editAccess.id, data: accessForm });
    } else {
      if (!selectedProject) { toast({ title: "Select a project.", variant: "destructive" }); return; }
      grantAccessMutation.mutate({ ...accessForm, project_id: selectedProject.id });
    }
  };

  const getContactName = (contactId: string) => contacts.find((c: any) => c.id === contactId)?.name || "Unknown";
  const getProjectName = (projectId: string) => (projects as any[]).find((p: any) => p.id === projectId)?.name || "Unknown";

  // Group accesses by project
  const accessesByProject: Record<string, any[]> = {};
  (allAccesses as any[]).forEach((a: any) => {
    if (!accessesByProject[a.project_id]) accessesByProject[a.project_id] = [];
    accessesByProject[a.project_id].push(a);
  });

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Client not found.</p>
        <Button variant="outline" onClick={() => navigate("/clients")} className="mt-4">Back to Clients</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Clients
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
            {(client.organization_type || client.industry) && (
              <p className="text-xs text-gray-500">{[client.organization_type, client.industry].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <Badge className={`ml-2 text-xs border capitalize ${STATUS_STYLES[client.status] || ""}`}>{client.status}</Badge>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => navigate(`/clients/${id}?edit=1`)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="h-3.5 w-3.5 mr-1" /> Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban className="h-3.5 w-3.5 mr-1" /> Project Access ({Object.keys(accessesByProject).length})
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { label: "Organisation Name", value: client.name, icon: Building2 },
                  { label: "Organisation Type",  value: client.organization_type, icon: Globe },
                  { label: "Industry",           value: client.industry, icon: Briefcase },
                ].map(({ label, value, icon: Icon }) => value ? (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ) : null)}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge className={`text-xs border capitalize ${STATUS_STYLES[client.status] || ""}`}>{client.status}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Primary Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {client.primary_contact_name && (
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="font-medium">{client.primary_contact_name}</p>
                      {client.email && <p className="text-xs text-gray-500">{client.email}</p>}
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </div>
                )}
                {!client.primary_contact_name && !client.email && (
                  <p className="text-gray-400 italic text-xs">No primary contact set.</p>
                )}
              </CardContent>
            </Card>

            {client.notes && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{client.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick stats */}
            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              {[
                { label: "Portal Contacts", value: contacts.length, color: "text-blue-600" },
                { label: "Active Contacts", value: (contacts as any[]).filter((c: any) => c.is_active).length, color: "text-green-600" },
                { label: "Projects with Access", value: Object.keys(accessesByProject).length, color: "text-purple-600" },
              ].map(({ label, value, color }) => (
                <Card key={label} className="text-center">
                  <CardContent className="pt-4 pb-4">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── CONTACTS ── */}
        <TabsContent value="contacts" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Portal Contacts</h3>
              <p className="text-xs text-gray-500 mt-0.5">Contacts who can log in to the client portal and access assigned projects.</p>
            </div>
            <Button size="sm" onClick={openAddContact}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Contact
            </Button>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No contacts yet. Add a contact to enable portal access.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Level</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Login</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {(contacts as any[]).map((c: any) => {
                    const lvl = ACCESS_LEVEL_CONFIG[c.access_level] || ACCESS_LEVEL_CONFIG.observer;
                    const Icon = lvl.icon;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{c.email}</td>
                        <td className="px-4 py-3 text-gray-500">{c.job_title || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs border flex items-center gap-1 w-fit ${lvl.color}`}>
                            <Icon className="h-3 w-3" />{lvl.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {c.last_login_at ? format(new Date(c.last_login_at), "MMM d, yyyy") : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setPwDialog(c); setNewPassword(""); }}>
                              <Key className="h-3 w-3" /> Password
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditContact(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteContactDialog(c)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── PROJECTS ── */}
        <TabsContent value="projects" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Project Access</h3>
              <p className="text-xs text-gray-500 mt-0.5">All contacts are listed below. Grant or adjust project access inline, or use Grant Access for fine-grained permissions.</p>
            </div>
            <Button size="sm" onClick={() => openGrantAccess()} disabled={contacts.length === 0}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Grant Access
            </Button>
          </div>

          {contacts.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Add at least one contact before granting project access.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">Access Level</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Permissions</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {(contacts as any[]).map((contact: any) => {
                    const contactAccesses = (allAccesses as any[]).filter((a: any) => a.contact_id === contact.id);

                    if (contactAccesses.length === 0) {
                      return (
                        <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300 shrink-0">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium leading-tight">{contact.name}</p>
                                <p className="text-xs text-gray-400">{contact.job_title || contact.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 italic text-xs" colSpan={3}>No project access granted</td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openGrantAccess(contact.id)}>
                              <Plus className="h-3 w-3" /> Grant
                            </Button>
                          </td>
                        </tr>
                      );
                    }

                    return contactAccesses.map((access: any, idx: number) => {
                      const proj = (projects as any[]).find((p: any) => p.id === access.project_id);
                      const lvl = ACCESS_LEVEL_CONFIG[access.access_level] || ACCESS_LEVEL_CONFIG.observer;
                      const LvlIcon = lvl.icon;
                      return (
                        <tr key={access.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          {/* Contact cell — only show avatar/name on first access row */}
                          <td className="px-4 py-3">
                            {idx === 0 ? (
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 shrink-0">
                                  {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium leading-tight">{contact.name}</p>
                                  <p className="text-xs text-gray-400">{contact.job_title || contact.email}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 shrink-0" />
                                <div className="h-px w-4 bg-gray-200 dark:bg-gray-600" />
                              </div>
                            )}
                          </td>

                          {/* Project */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <FolderKanban className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                              <span className="font-medium">{proj?.name || "Unknown Project"}</span>
                            </div>
                            {proj?.status && (
                              <span className="text-xs text-gray-400 capitalize ml-5">{proj.status.replace("_", " ")}</span>
                            )}
                          </td>

                          {/* Access level — inline select */}
                          <td className="px-4 py-3">
                            <Select
                              value={access.access_level}
                              onValueChange={(v) =>
                                quickUpdateAccessMutation.mutate({
                                  projectId: access.project_id,
                                  accessId: access.id,
                                  data: { ...access, access_level: v, ...ACCESS_LEVEL_PRESETS[v] },
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-36 border-dashed">
                                <div className="flex items-center gap-1.5">
                                  <LvlIcon className="h-3 w-3 shrink-0" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ACCESS_LEVEL_CONFIG).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    <div className="flex items-center gap-1.5">
                                      <v.icon className="h-3.5 w-3.5" />
                                      {v.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* Permission chips */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {access.can_view_defects    && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500" title="View Defects">🔍 Defects</span>}
                              {access.can_create_defects  && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500" title="Create Defects">📝 Create</span>}
                              {access.can_approve_milestones && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500" title="Approve Milestones">✅ Milestones</span>}
                              {access.can_view_timesheets && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500" title="View Timesheets">🕐 Timesheets</span>}
                              {!access.can_view_defects && !access.can_create_defects && !access.can_approve_milestones && !access.can_view_timesheets && (
                                <span className="text-xs text-gray-400 italic">View only</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit full permissions" onClick={() => openEditAccess(access, proj)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Revoke access"
                                onClick={() => revokeAccessMutation.mutate({ projectId: access.project_id, accessId: access.id })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Contact Dialog ── */}
      <Dialog open={contactDialog} onOpenChange={(v) => { setContactDialog(v); if (!v) setEditContact(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit Contact" : "Add Portal Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Section 1 - Identity */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 flex items-center gap-2 border-b dark:border-gray-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contact Identity</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Full Name *</Label>
                  <Input className="h-10" placeholder="Jane Smith" value={contactForm.name}
                    onChange={(e) => setContactForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email *</Label>
                  <Input className="h-10" type="email" placeholder="jane@company.com" value={contactForm.email}
                    onChange={(e) => setContactForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Phone</Label>
                  <Input className="h-10" type="tel" placeholder="+1 555 000 0000" value={contactForm.phone}
                    onChange={(e) => setContactForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Job Title</Label>
                  <Input className="h-10" placeholder="e.g. Project Sponsor, QA Manager" value={contactForm.job_title}
                    onChange={(e) => setContactForm(p => ({ ...p, job_title: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Section 2 - Access */}
            <div className="rounded-xl border border-green-200 dark:border-green-800/50 overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-green-200 dark:border-green-800/50">
                <span className="h-5 w-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Portal Access</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Default Access Level</Label>
                  <Select value={contactForm.access_level} onValueChange={(v) => setContactForm(p => ({ ...p, access_level: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCESS_LEVEL_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2">
                            <v.icon className="h-3.5 w-3.5" />
                            <span>{v.label}</span>
                            <span className="text-xs text-gray-400">— {v.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Account Active</Label>
                  <Switch checked={contactForm.is_active} onCheckedChange={(v) => setContactForm(p => ({ ...p, is_active: v }))} />
                </div>
              </div>
            </div>

            {/* Section 3 - Portal Password */}
            {!editContact && (
              <div className="rounded-xl border border-purple-200 dark:border-purple-800/50 border-dashed overflow-hidden">
                <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-purple-200 dark:border-purple-800/50 border-dashed">
                  <span className="h-5 w-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300">Portal Password (Optional)</h3>
                </div>
                <div className="p-4 space-y-1">
                  <Label className="text-xs font-semibold">Set Initial Password</Label>
                  <Input className="h-10" type="password" placeholder="Leave blank to set later" value={contactForm.password}
                    onChange={(e) => setContactForm(p => ({ ...p, password: e.target.value }))} />
                  <p className="text-xs text-gray-400 mt-1">Minimum 6 characters. You can set it later via the Password button.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContactDialog(false); setEditContact(null); }}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveContact}
              disabled={createContactMutation.isPending || updateContactMutation.isPending}>
              {editContact ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set Password Dialog ── */}
      <Dialog open={!!pwDialog} onOpenChange={(v) => { if (!v) { setPwDialog(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-4 w-4 text-blue-600" /> Set Portal Password</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Setting portal password for <strong>{pwDialog?.name}</strong> ({pwDialog?.email}).
            </p>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">New Password</Label>
              <Input type="password" className="h-10" placeholder="Minimum 6 characters" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwDialog(null); setNewPassword(""); }}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setPasswordMutation.mutate({ contactId: pwDialog?.id, password: newPassword })}
              disabled={setPasswordMutation.isPending || newPassword.length < 6}>
              {setPasswordMutation.isPending ? "Saving…" : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Contact Dialog ── */}
      <Dialog open={!!deleteContactDialog} onOpenChange={(v) => { if (!v) setDeleteContactDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="h-4 w-4" /> Remove Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 py-2">
            Are you sure you want to remove <strong>{deleteContactDialog?.name}</strong>? Their portal access will be revoked.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContactDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteContactMutation.mutate(deleteContactDialog?.id)}
              disabled={deleteContactMutation.isPending}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Grant / Edit Access Dialog ── */}
      <Dialog open={accessDialog} onOpenChange={(v) => { setAccessDialog(v); if (!v) { setEditAccess(null); setSelectedProject(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAccess ? "Edit Project Access" : "Grant Project Access"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Section 1 - Who & What */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 flex items-center gap-2 border-b dark:border-gray-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assignment</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Contact *</Label>
                  <Select value={accessForm.contact_id} onValueChange={(v) => setAccessForm(p => ({ ...p, contact_id: v }))} disabled={!!editAccess}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select a contact" /></SelectTrigger>
                    <SelectContent>
                      {(contacts as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!editAccess && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Project *</Label>
                    {(() => {
                      const clientProjects = (projects as any[]).filter(
                        (p: any) => p.is_client_project && p.client_id === id
                      );
                      if (clientProjects.length === 0) {
                        return (
                          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>
                              No projects are linked to this client yet. To link a project, open it from the{" "}
                              <strong>Projects</strong> section and set its scope to{" "}
                              <strong>Client Project</strong> with this client selected.
                            </span>
                          </div>
                        );
                      }
                      return (
                        <Select
                          value={selectedProject?.id || ""}
                          onValueChange={(v) => setSelectedProject(clientProjects.find((p: any) => p.id === v))}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientProjects.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || "#6366f1" }} />
                                  {p.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                )}
                {editAccess && (
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    <span className="text-gray-500">Project: </span>
                    <span className="font-medium">{getProjectName(editAccess.project_id)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2 - Access Level */}
            <div className="rounded-xl border border-green-200 dark:border-green-800/50 overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-green-200 dark:border-green-800/50">
                <span className="h-5 w-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Access Level</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ACCESS_LEVEL_CONFIG).map(([k, v]) => {
                    const Icon = v.icon;
                    return (
                      <button key={k} type="button"
                        onClick={() => applyAccessLevel(k)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${accessForm.access_level === k ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                        <Icon className={`h-4 w-4 mb-1 ${accessForm.access_level === k ? "text-blue-600" : "text-gray-400"}`} />
                        <p className="text-xs font-semibold">{v.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{v.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 3 - Fine-grained permissions */}
            <div className="rounded-xl border border-purple-200 dark:border-purple-800/50 border-dashed overflow-hidden">
              <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-purple-200 dark:border-purple-800/50 border-dashed">
                <span className="h-5 w-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300">Fine-Grained Permissions</h3>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  { key: "can_view_defects",      label: "View Defects" },
                  { key: "can_create_defects",     label: "Create Defects" },
                  { key: "can_edit_defects",       label: "Edit Defects" },
                  { key: "can_approve_defects",    label: "Approve Defects" },
                  { key: "can_approve_milestones", label: "Approve Milestones" },
                  { key: "can_view_tasks",         label: "View Tasks" },
                  { key: "can_view_timesheets",    label: "View Timesheets" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</Label>
                    <Switch
                      checked={(accessForm as any)[key]}
                      onCheckedChange={(v) => setAccessForm(p => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAccessDialog(false); setEditAccess(null); setSelectedProject(null); }}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveAccess}
              disabled={grantAccessMutation.isPending || updateAccessMutation.isPending}>
              {editAccess ? "Save Changes" : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
