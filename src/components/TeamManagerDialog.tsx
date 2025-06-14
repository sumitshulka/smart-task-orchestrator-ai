import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface User {
  id: string;
  email: string;
  user_name?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string | null;
  created_by: string;
}

interface TeamMember {
  id: string;     // membership id
  user_id: string;
  role_within_team: string | null;
  joined_at: string | null;
  user: User;
}

interface TeamManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
  onTeamUpdated?: () => void;
}

/**
 * Admin dialog for creating or editing a Team,
 * assigning/removing users and setting manager.
 */
const TeamManagerDialog: React.FC<TeamManagerDialogProps> = ({
  open,
  onOpenChange,
  team,
  onTeamUpdated,
}) => {
  const isEdit = Boolean(team);
  const [saving, setSaving] = useState(false);
  const [teamName, setTeamName] = useState(team?.name || "");
  const [teamDesc, setTeamDesc] = useState(team?.description || "");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState<string>("");

  // Load all users for assignment
  useEffect(() => {
    if (!open) return;
    supabase.from("users").select("id, email, user_name").then(({ data, error }) => {
      if (error) {
        toast({ title: "Failed to load users", description: error.message });
        setAllUsers([]);
        return;
      }
      setAllUsers(data || []);
    });
  }, [open]);

  // If editing: fetch team members + manager
  useEffect(() => {
    if (!open || !team) {
      setTeamName("");
      setTeamDesc("");
      setMembers([]);
      setSelectedUserIds([]);
      setManagerId("");
      return;
    }

    function isValidUser(obj: unknown): obj is User {
      return (
        obj !== null &&
        typeof obj === "object" &&
        "id" in obj &&
        "email" in obj &&
        typeof (obj as any).id === "string" &&
        typeof (obj as any).email === "string"
      );
    }

    async function fetchMembers() {
      const { data, error } = await supabase
        .from("team_memberships")
        .select("*, user:users(id, email, user_name)")
        .eq("team_id", team.id);
      if (error) {
        toast({ title: "Failed to load team members", description: error.message });
        setMembers([]);
        return;
      }
      // Extra log to capture invalid user objects
      if (data) {
        data.forEach((m: any) => {
          if (!isValidUser(m.user)) {
            console.warn("[TeamManagerDialog] Invalid user join result:", m.user, m);
          }
        });
      }

      // Filter only memberships with a valid user object
      const validMembers = (data || []).filter((m: any) => isValidUser(m.user));

      setMembers(validMembers as TeamMember[]);
      setSelectedUserIds(validMembers.map((m: any) => m.user_id));
      // Find manager (if any)
      const managerEntry = validMembers.find((m: any) => m.role_within_team === "manager");
      setManagerId(managerEntry?.user_id || "");
    }
    fetchMembers();
  }, [open, team]);

  // When user selection changes, ensure manager is in member list
  useEffect(() => {
    if (!selectedUserIds.includes(managerId)) setManagerId("");
  }, [selectedUserIds, managerId]);

  // Handle Save/Update
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (!teamName.trim()) {
      toast({ title: "Team name is required." });
      setSaving(false);
      return;
    }
    if (!managerId) {
      toast({ title: "Please select a team manager." });
      setSaving(false);
      return;
    }
    let teamId = team?.id;
    // If new team, first create it
    if (!teamId) {
      const { data, error } = await supabase.from("teams").insert({
        name: teamName,
        description: teamDesc,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select().single();
      if (error) {
        toast({ title: "Failed to create team", description: error.message });
        setSaving(false);
        return;
      }
      teamId = data.id;
    } else {
      // Update team name/desc
      const { error } = await supabase.from("teams").update({
        name: teamName,
        description: teamDesc,
      }).eq("id", teamId);
      if (error) {
        toast({ title: "Failed to update team", description: error.message });
        setSaving(false);
        return;
      }
    }

    // Get memberships for this team
    const { data: currentMemberships, error: memErr } = await supabase
      .from("team_memberships")
      .select("*")
      .eq("team_id", teamId);

    if (memErr) {
      toast({ title: "Failed to load memberships", description: memErr.message });
      setSaving(false);
      return;
    }

    const currentUserIds = (currentMemberships ?? []).map((m: any) => m.user_id);

    // Add/Remove members as needed
    const usersToAdd = selectedUserIds.filter(id => !currentUserIds.includes(id));
    const usersToRemove = currentUserIds.filter(id => !selectedUserIds.includes(id));

    // Remove memberships
    if (usersToRemove.length > 0) {
      await supabase.from("team_memberships")
        .delete()
        .eq("team_id", teamId)
        .in("user_id", usersToRemove);
    }
    // Add memberships (new entries have role_within_team: null)
    if (usersToAdd.length > 0) {
      const toInsert = usersToAdd.map(user_id => ({ team_id: teamId, user_id, role_within_team: null }));
      await supabase.from("team_memberships").insert(toInsert);
    }

    // Ensure the selected manager gets role_within_team = 'manager'
    // and everyone else is set to null.
    // (There should only be one manager per team)
    const roleUpdates = selectedUserIds.map(user_id => ({
      team_id: teamId,
      user_id,
      role_within_team: user_id === managerId ? "manager" : null,
    }));

    for (const update of roleUpdates) {
      await supabase.from("team_memberships")
        .update({ role_within_team: update.role_within_team })
        .eq("team_id", teamId)
        .eq("user_id", update.user_id);
    }
    toast({ title: isEdit ? "Team updated!" : "Team created!" });
    setSaving(false);
    onOpenChange(false);
    if (onTeamUpdated) onTeamUpdated();
  }

  // UI: member assignment as a big select with checkboxes
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Team" : "Create Team"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Team Name</label>
            <Input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Description</label>
            <Input
              value={teamDesc}
              onChange={e => setTeamDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Assign Users</label>
            <div className="max-h-40 overflow-y-auto border rounded p-2">
              {allUsers.length === 0 ? (
                <span className="text-sm text-muted-foreground">No users found.</span>
              ) : (
                allUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id={`user-${user.id}`}
                      checked={selectedUserIds.includes(user.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedUserIds(prev => [...prev, user.id]);
                        } else {
                          setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <label htmlFor={`user-${user.id}`}>
                      {user.user_name || user.email}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Team Manager</label>
            <Select
              value={managerId}
              onValueChange={(val) => setManagerId(val)}
              disabled={selectedUserIds.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a manager" />
              </SelectTrigger>
              <SelectContent>
                {allUsers
                  .filter(u => selectedUserIds.includes(u.id))
                  .map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.user_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !teamName || !managerId}>
              {isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TeamManagerDialog;
