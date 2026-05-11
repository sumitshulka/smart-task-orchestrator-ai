import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, LogOut, FolderKanban, Eye, MessageSquare, CheckCircle2,
  Milestone, Bug, ListTodo, ChevronRight, Building2,
} from "lucide-react";

const ACCESS_LEVEL_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  observer:     { label: "Observer",     color: "bg-blue-100 text-blue-800 border-blue-200",     icon: Eye },
  collaborator: { label: "Collaborator", color: "bg-purple-100 text-purple-800 border-purple-200", icon: MessageSquare },
  approver:     { label: "Approver",     color: "bg-green-100 text-green-800 border-green-200",    icon: CheckCircle2 },
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  planning:   "bg-gray-100 text-gray-700",
  active:     "bg-blue-100 text-blue-700",
  on_hold:    "bg-amber-100 text-amber-700",
  completed:  "bg-green-100 text-green-700",
  cancelled:  "bg-red-100 text-red-600",
};

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [me, setMe] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/portal/me", { credentials: "include" });
        if (!meRes.ok) { navigate("/portal/login"); return; }
        const meData = await meRes.json();
        setMe(meData);

        const projRes = await fetch("/api/portal/projects", { credentials: "include" });
        if (projRes.ok) {
          const data = await projRes.json();
          setProjects(data);
        }
      } catch {
        navigate("/portal/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleLogout = async () => {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    navigate("/portal/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Shield className="h-10 w-10 mx-auto mb-3 animate-pulse" />
          <p>Loading your portal…</p>
        </div>
      </div>
    );
  }

  const contact = me?.contact;
  const client = me?.client;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm text-gray-900 dark:text-white">Client Portal</span>
          </div>
          {client && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Building2 className="h-3.5 w-3.5" />
                <span>{client.name}</span>
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            {contact && (
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-gray-900 dark:text-white">{contact.name}</p>
                <p className="text-[10px] text-gray-400">{contact.email}</p>
              </div>
            )}
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {contact?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1.5 text-gray-500 hover:text-red-600">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {contact?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here are your assigned projects. Click a project to view details.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Projects Assigned",  value: projects.length,   icon: FolderKanban, color: "text-blue-600",   bg: "bg-blue-50" },
            { label: "Active Projects",     value: projects.filter(p => p.project?.status === "active").length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
            { label: "Access Level",        value: contact?.access_level ? ACCESS_LEVEL_CONFIG[contact.access_level]?.label || contact.access_level : "—", icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">No projects assigned yet</p>
            <p className="text-sm mt-1">Contact your project manager to request access.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(({ project, access }: any) => {
              if (!project) return null;
              const lvl = ACCESS_LEVEL_CONFIG[access?.access_level] || ACCESS_LEVEL_CONFIG.observer;
              const Icon = lvl.icon;
              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-all group border border-gray-200 dark:border-gray-700"
                  onClick={() => navigate(`/portal/projects/${project.id}`)}
                >
                  <CardContent className="p-5">
                    {/* Top */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                          <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{project.name}</p>
                          {project.client_name && <p className="text-xs text-gray-400">{project.client_name}</p>}
                        </div>
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0.5 ${PROJECT_STATUS_COLORS[project.status] || "bg-gray-100 text-gray-600"} capitalize border-0`}>
                        {(project.status || "").replace("_", " ")}
                      </Badge>
                    </div>

                    {/* Access */}
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className={`text-xs border flex items-center gap-1 ${lvl.color}`}>
                        <Icon className="h-3 w-3" />{lvl.label}
                      </Badge>
                    </div>

                    {/* Permissions */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {access?.can_view_defects && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                          <Bug className="h-2.5 w-2.5" /> Defects
                        </span>
                      )}
                      {access?.can_view_tasks && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                          <ListTodo className="h-2.5 w-2.5" /> Tasks
                        </span>
                      )}
                      {access?.can_approve_milestones && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                          <Milestone className="h-2.5 w-2.5" /> Approvals
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t dark:border-gray-700 text-xs text-gray-400">
                      <span className="capitalize">{(project.project_type || "").replace("_", " ")}</span>
                      <ChevronRight className="h-4 w-4 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
