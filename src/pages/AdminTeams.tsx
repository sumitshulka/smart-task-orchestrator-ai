
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import TeamManagerDialog from "@/components/TeamManagerDialog";
import { useUserList } from "@/hooks/useUserList";

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  created_by: string;
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

  // Fetch teams
  React.useEffect(() => {
    fetchTeamsWithMembers();
    // eslint-disable-next-line
  }, []);

  async function fetchTeamsWithMembers() {
    setLoading(true);
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .order("name");
    if (error) {
      toast({ title: "Error loading teams", description: error.message });
      setLoading(false);
      return;
    }
    setTeams(teams || []);

    // For each team, fetch members and manager
    const teamIds = (teams || []).map((t: any) => t.id);
    if (teamIds.length === 0) {
      setMembersMap({});
      setManagersMap({});
      setLoading(false);
      return;
    }

    // Fetch memberships for all teams WITHOUT join
    const { data: memberships, error: memErr } = await supabase
      .from("team_memberships")
      .select("team_id, user_id, role_within_team")
      .in("team_id", teamIds);

    if (memErr) {
      toast({ title: "Error loading team members", description: memErr.message });
      setLoading(false);
      return;
    }

    const allUserIds = [...new Set((memberships || []).map((m: any) => m.user_id))];
    let usersById: Record<string, any> = {};
    if (allUserIds.length > 0) {
      const { data: usersData, error: usersErr } = await supabase
        .from("users")
        .select("id, user_name, email")
        .in("id", allUserIds);

      if (usersErr) {
        toast({ title: "Error loading team user info", description: usersErr.message });
      } else if (usersData) {
        usersById = Object.fromEntries(usersData.map((u: any) => [u.id, u]));
      }
    }

    // Build maps for each team
    const membMap: Record<string, string[]> = {};
    const managerMap: Record<string, string> = {};

    (memberships || []).forEach((m: any) => {
      if (!membMap[m.team_id]) membMap[m.team_id] = [];
      const user = usersById[m.user_id];
      let label = m.user_id;
      if (user) label = user.user_name || user.email || m.user_id;
      membMap[m.team_id].push(label);

      if (m.role_within_team === "manager") {
        managerMap[m.team_id] = label;
      }
    });

    setMembersMap(membMap);
    setManagersMap(managerMap);
    setLoading(false);
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
      {/* Table - match UserRoleManager styles */}
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
                    <Button variant="ghost" size="sm" onClick={() => handleEditTeam(team)}>Edit</Button>
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
