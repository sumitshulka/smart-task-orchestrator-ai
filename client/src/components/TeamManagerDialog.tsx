import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

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
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState<string>(""); // <--- this line remains the same
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Update managerId whenever members data changes
  React.useEffect(() => {
    if (!open) return;
    if (members.length > 0) {
      const managerEntry = members.find((m) => m.role_within_team === "manager");
      if (managerEntry?.user_id) {
        setManagerId(managerEntry.user_id);
      }
    }
    // If team changed and there are no members, reset manager
    if (members.length === 0) {
      setManagerId("");
    }
  }, [members, open]);

  // Keep form state in sync with team prop and dialog open state.
  useEffect(() => {
    if (open && team) {
      setTeamName(team.name || "");
      setTeamDesc(team.description || "");
    } else if (!open) {
      setTeamName("");
      setTeamDesc("");
      setManagerId("");
      setSelectedUserIds([]);
      setMembers([]);
    }
  }, [open, team]);

  // Load all users for assignment
  useEffect(() => {
    if (!open) return;
    apiClient.getUsers().then((data) => {
      setAllUsers(data || []);
    }).catch((error) => {
      console.error('Failed to fetch users:', error);
      toast({ title: "Failed to load users" });
      setAllUsers([]);
    });
  }, [open]);

  // If editing: fetch team members + manager
  useEffect(() => {
    if (!open || !team) {
      setMembers([]);
      setSelectedUserIds([]);
      // setManagerId(""); <--- Leave to be set by the managerId/members effect
      return;
    }

    async function fetchMembers() {
      try {
        // Fetch team members using API client
        const teamMembers = await apiClient.getTeamMembers(team.id);
        
        if (!teamMembers || teamMembers.length === 0) {
          setMembers([]);
          setSelectedUserIds([]);
          return;
        }

        // Gather all user ids for later join
        const memberUserIds: string[] = teamMembers.map((m: any) => m.user_id);

        // Fetch user metadata for those IDs
        const allUsers = await apiClient.getUsers();
        const usersById: Record<string, User> = {};
        allUsers.forEach((u: any) => {
          usersById[u.id] = u;
        });

        // Build full members, filtering out any memberships where no user found
        const enrichedMembers: TeamMember[] = (teamMembers || [])
          .filter((m: any) => usersById[m.user_id])
          .map((m: any) => ({
            id: m.id,
            joined_at: m.joined_at,
            role_within_team: m.role_within_team,
            user_id: m.user_id,
            user: usersById[m.user_id],
          }));

        setMembers(enrichedMembers);
        setSelectedUserIds(enrichedMembers.map(m => m.user_id));
      } catch (error: any) {
        console.error('Failed to fetch team members:', error);
        toast({ title: "Failed to load team members", description: error.message });
        setMembers([]);
        setSelectedUserIds([]);
      }
    }
    
    fetchMembers();
  }, [open, team]);

  // When user selection changes, ensure manager is in member list
  useEffect(() => {
    if (!selectedUserIds.includes(managerId)) setManagerId("");
  }, [selectedUserIds, managerId]);

  // Ensure inputs are updated if dialog is opened for another team
  useEffect(() => {
    if (team && isEdit && open) {
      setTeamName(team.name || "");
      setTeamDesc(team.description || "");
    }
  }, [team, isEdit, open]);

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
      try {
        const newTeam = await apiClient.createTeam({
          name: teamName,
          description: teamDesc,
        });
        teamId = newTeam.id;
      } catch (error: any) {
        toast({ title: "Failed to create team", description: error.message });
        setSaving(false);
        return;
      }
    } else {
      // Update team name/desc
      try {
        await apiClient.updateTeam(teamId, {
          name: teamName,
          description: teamDesc,
        });
      } catch (error: any) {
        toast({ title: "Failed to update team", description: error.message });
        setSaving(false);
        return;
      }
    }

    // Get current memberships for this team
    let currentMemberships: any[] = [];
    try {
      currentMemberships = await apiClient.getTeamMembers(teamId!);
    } catch (error: any) {
      toast({ title: "Failed to load memberships", description: error.message });
      setSaving(false);
      return;
    }

    const currentUserIds = currentMemberships.map((m: any) => m.user_id);

    // Add/Remove members as needed
    const usersToAdd = selectedUserIds.filter(id => !currentUserIds.includes(id));
    const usersToRemove = currentUserIds.filter(id => !selectedUserIds.includes(id));

    // Remove memberships
    for (const userId of usersToRemove) {
      try {
        await apiClient.removeTeamMember(teamId!, userId);
      } catch (error: any) {
        console.error(`Failed to remove user ${userId}:`, error);
      }
    }
    
    // Add memberships
    for (const userId of usersToAdd) {
      try {
        await apiClient.addTeamMember(teamId!, userId);
      } catch (error: any) {
        console.error(`Failed to add user ${userId}:`, error);
      }
    }

    // Set manager role - update team with manager_id
    if (teamId && managerId) {
      try {
        await apiClient.updateTeam(teamId, {
          manager_id: managerId,
        });
        
        // Also set role_within_team for the manager
        // Clear all existing manager roles first
        const allMembers = await apiClient.getTeamMembers(teamId);
        for (const member of allMembers) {
          if (member.role_within_team === "manager" && member.user_id !== managerId) {
            await apiClient.addTeamMember(teamId, member.user_id, null);
          }
        }
        
        // Set the new manager's role
        if (selectedUserIds.includes(managerId)) {
          await apiClient.addTeamMember(teamId, managerId, "manager");
        }
      } catch (error: any) {
        console.error("Failed to assign manager:", error);
        toast({ title: "Failed to assign manager", description: error.message });
      }
    }
    toast({ title: isEdit ? "Team updated!" : "Team created!" });
    setSaving(false);
    onOpenChange(false);
    if (onTeamUpdated) onTeamUpdated();
  }

  // Handle Delete
  async function handleDeleteTeam() {
    if (!team || !team.id) return;
    setSaving(true);
    
    try {
      await apiClient.deleteTeam(team.id);
      toast({ title: "Team deleted" });
      setSaving(false);
      setDeleteOpen(false);
      onOpenChange(false);
      if (onTeamUpdated) onTeamUpdated();
    } catch (error: any) {
      toast({ title: "Failed to delete team", description: error.message });
      setSaving(false);
    }
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
            {isEdit && (
              <>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={saving}>
                      Delete Team
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete This Team?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription>
                      Are you sure you want to delete this team? This action cannot be undone.
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTeam} disabled={saving} className="bg-destructive text-destructive-foreground">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
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
