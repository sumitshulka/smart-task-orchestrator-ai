import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Filter } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import TeamManagerDialog from "@/components/TeamManagerDialog";
import { useUserList } from "@/hooks/useUserList";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  created_by: string;
  manager_id?: string | null;
  manager?: {
    id: string;
    user_name: string;
    email: string;
  } | null;
}

const AdminTeams: React.FC = () => {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [createDialog, setCreateDialog] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editTeam, setEditTeam] = React.useState<Team | null>(null);
  const [membersMap, setMembersMap] = React.useState<Record<string, string[]>>({});
  const [managersMap, setManagersMap] = React.useState<Record<string, string>>({});

  // Fetch users for Created By lookup
  const { users: allUsers, loading: usersLoading } = useUserList();
  // Get current user's info and roles
  const { roles: currentUserRoles, user: currentUser } = useCurrentUserRoleAndTeams();

  // Fetch teams
  React.useEffect(() => {
    fetchTeamsWithMembers();
    // eslint-disable-next-line
  }, []);

  async function fetchTeamsWithMembers() {
    setLoading(true);
    try {
      const teams = await apiClient.getTeams();
      setTeams(teams || []);

      // Fetch member counts for each team
      const newMembersMap: Record<string, string[]> = {};
      const newManagersMap: Record<string, string> = {};
      
      for (const team of teams || []) {
        try {
          const members = await apiClient.getTeamMembers(team.id);
          newMembersMap[team.id] = members.map((m: any) => m.user?.user_name || m.user?.email || m.user_id);
          
          // Manager is now included in team data directly
          if (team.manager?.user_name) {
            newManagersMap[team.id] = team.manager.user_name;
          } else if (team.manager?.email) {
            newManagersMap[team.id] = team.manager.email;
          }
        } catch (error) {
          console.error(`Failed to fetch members for team ${team.id}:`, error);
          newMembersMap[team.id] = [];
        }
      }
      
      setMembersMap(newMembersMap);
      setManagersMap(newManagersMap);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      toast({ title: "Error loading teams" });
      setTeams([]);
      setMembersMap({});
      setManagersMap({});
      setLoading(false);
    }
  }

  // Filtered by search
  const filteredTeams = React.useMemo(() => {
    return teams.filter(team => 
      search === "" || 
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      (team.description && team.description.toLowerCase().includes(search.toLowerCase()))
    );
  }, [teams, search]);

  function handleTeamCreatedOrUpdated() {
    fetchTeamsWithMembers();
  }

  function handleEditTeam(team: Team) {
    setEditTeam(team);
    setEditDialogOpen(true);
  }

  // Helper: get display name/email for a user id (used for created_by)
  function getUserDisplay(userId: string) {
    const u = allUsers.find(user => user.id === userId);
    if (!u) return userId.slice(0, 8); // fallback
    return u.user_name ? `${u.user_name} (${u.email})` : u.email;
  }

  // Helper: check if a user is an admin (used for team creator)
  function isAdminUser(userId: string) {
    const user = allUsers.find(u => u.id === userId);
    // We don't have roles in userList, but let's assume admins are in user_roles; we'll allow edit only for admin or if manager and creator is NOT admin
    // For safety: if user is not found, return false
    if (!userId || !user) return false;
    // If the creator id matches the current user's id, and the current user is admin, then allow
    if (currentUser?.id === userId && currentUserRoles?.includes("admin")) return true;
    // We can't infer all user roles without more queries, so just compare creator to current user
    return false; // by default
  }

  // Helper: can current user edit team
  function canEditTeam(team: Team) {
    // Admins can edit any team
    if (currentUserRoles?.includes("admin")) return true;
    // Managers can edit unless created by admin
    // We can't check the actual admin, so we prevent edit if created_by !== current user
    if (currentUserRoles?.includes("manager") || currentUserRoles?.includes("team_manager")) {
      // Managers shouldn't be able to edit if creator is not themselves
      if (currentUser && team.created_by === currentUser.id) {
        return true;
      }
      // Otherwise, do not allow edit
      return false;
    }
    // Default no
    return false;
  }

  return (
    <div className="p-6 max-w-6xl w-full">
      {/* Create/Edit Team Dialogs */}
      <TeamManagerDialog
        open={createDialog}
        onOpenChange={setCreateDialog}
        onTeamUpdated={handleTeamCreatedOrUpdated}
      />
      <TeamManagerDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        team={editTeam}
        onTeamUpdated={handleTeamCreatedOrUpdated}
      />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Team Management</h1>
        <Button onClick={() => setCreateDialog(true)}>Create Team</Button>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5 bg-muted/30 border rounded-md px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            className="w-[180px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {/* Table */}
      <div className="border rounded shadow bg-background overflow-x-auto">
        <table className="w-full border text-sm rounded-md shadow bg-background">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left">Team Name</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Members</th>
              <th className="p-2 text-left">Manager</th>
              <th className="p-2 text-left">Created By</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <span className="text-muted-foreground">Loading teams...</span>
                </td>
              </tr>
            ) : filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <span className="text-muted-foreground">No teams found.</span>
                </td>
              </tr>
            ) : (
              filteredTeams.map((team) => (
                <tr key={team.id} className="border-b last:border-b-0">
                  <td className="p-2">{team.name}</td>
                  <td className="p-2">{team.description || "--"}</td>
                  <td className="p-2">{(membersMap[team.id] || []).join(", ") || "--"}</td>
                  <td className="p-2">{managersMap[team.id] || "--"}</td>
                  <td className="p-2">{getUserDisplay(team.created_by)}</td>
                  <td className="p-2 text-right">
                    {canEditTeam(team) && (
                      <Button variant="ghost" size="sm" onClick={() => handleEditTeam(team)}>
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminTeams;
