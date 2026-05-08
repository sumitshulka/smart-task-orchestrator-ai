
import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string;
}

const defaultForm = {
  title: "",
  description: "",
  steps_to_reproduce: "",
  expected_behavior: "",
  actual_behavior: "",
  severity: "medium",
  priority: 3,
  type: "bug",
  environment: "production",
  assigned_to: "",
  team_id: "",
  project_id: "",
  due_date: "",
  resolution: "",
};

export default function CreateDefectSheet({ open, onOpenChange, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const { users, teams } = useUsersAndTeams();

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiClient.get("/projects"),
  });

  const [form, setForm] = useState({ ...defaultForm });

  const set = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post("/defects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/defects"] });
      toast({ title: "Defect reported", description: "The defect has been logged successfully." });
      setForm({ ...defaultForm });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e?.message || "Failed to create defect.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...form,
      reported_by: currentUserId,
      assigned_to: form.assigned_to || null,
      team_id: form.team_id || null,
      project_id: form.project_id || null,
      due_date: form.due_date || null,
    };
    createMutation.mutate(payload);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
        <SheetHeader className="mb-4">
          <SheetTitle>Report a Defect</SheetTitle>
          <SheetDescription>Fill in the details below to log a new defect.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-8">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="Brief description of the defect"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              placeholder="Detailed description…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Steps / Expected / Actual */}
          <div className="space-y-1">
            <Label>Steps to Reproduce</Label>
            <Textarea
              placeholder="1. Go to…&#10;2. Click…&#10;3. Observe…"
              value={form.steps_to_reproduce}
              onChange={(e) => set("steps_to_reproduce", e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Expected Behavior</Label>
              <Textarea
                placeholder="What should happen"
                value={form.expected_behavior}
                onChange={(e) => set("expected_behavior", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Actual Behavior</Label>
              <Textarea
                placeholder="What actually happens"
                value={form.actual_behavior}
                onChange={(e) => set("actual_behavior", e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Severity / Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => set("severity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={String(form.priority)} onValueChange={(v) => set("priority", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 – Critical</SelectItem>
                  <SelectItem value="2">2 – High</SelectItem>
                  <SelectItem value="3">3 – Medium</SelectItem>
                  <SelectItem value="4">4 – Low</SelectItem>
                  <SelectItem value="5">5 – Minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type / Environment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="regression">Regression</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="ui">UI</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={(v) => set("environment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="qa">QA</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned to / Team */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Assign To</Label>
              <Select value={form.assigned_to || "none"} onValueChange={(v) => set("assigned_to", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.user_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Team</Label>
              <Select value={form.team_id || "none"} onValueChange={(v) => set("team_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="space-y-1">
              <Label>Link to Project (optional)</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => set("project_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Due date */}
          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Reporting…" : "Report Defect"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
