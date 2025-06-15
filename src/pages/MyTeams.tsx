
import React, { useState } from "react";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TeamMembersModal from "@/components/TeamMembersModal";
import { supabase } from "@/integrations/supabase/client";

type TeamExtended = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  managerName?: string;
  members: {
    id: string;
    email: string;
    user_name?: string | null;
    allocationDate?: string;
  }[];
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
};

const MyTeams = () => {
  const { teams, user, loading } = useCurrentUserRoleAndTeams();
  const [teamsExtended, setTeamsExtended] = React.useState<TeamExtended[]>([]);
  const [showModalForTeamId, setShowModalForTeamId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!teams?.length) return;

    async function enrichTeams() {
      // Fetch for each team:
      // - Members (from team_memberships JOIN users; also join allocation date)
      // - Manager (role_within_team === 'manager')
      // - Total tasks (from tasks table, where team_id == team.id)
      // - Completed tasks (status == 'Completed')
      const promises = teams.map(async (team: any) => {
        // Members (and get their allocation dates)
        const { data: memberships } = await supabase
          .from("team_memberships")
          .select("user_id, role_within_team, joined_at, user:users(id,email,user_name)")
          .eq("team_id", team.id);
        const members =
          memberships?.map((m: any) => ({
            id: m.user?.id,
            email: m.user?.email,
            user_name: m.user?.user_name,
            allocationDate: m.joined_at,
            role_within_team: m.role_within_team,
          })) ?? [];

        // Team manager
        const manager =
          members.find((m) => m.role_within_team === "manager") ??
          members.find((m) => m.role_within_team?.toLowerCase() === "manager"); // fallback

        // Total members
        const totalMembers = members.length;

        // Total tasks
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, status")
          .eq("team_id", team.id);
        const totalTasks = tasks?.length ?? 0;
        const completedTasks = (tasks?.filter((t: any) =>
          (t.status ?? "").toLowerCase() === "completed") ?? []).length;

        return {
          ...team,
          managerName: manager?.user_name ?? manager?.email ?? "–",
          members,
          totalMembers,
          totalTasks,
          completedTasks,
        } as TeamExtended;
      });

      setTeamsExtended(await Promise.all(promises));
    }

    enrichTeams();
  }, [teams]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading your teams...</div>
    );
  }

  if (!user || teams.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You are not assigned to any teams.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Teams</h1>
      <div className="space-y-6">
        {teamsExtended.map((team) => (
          <Card key={team.id} className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{team.name}</span>
              <Badge variant="secondary">ID: {team.id.slice(0, 6)}…</Badge>
            </div>
            {team.description && (
              <div className="text-sm text-muted-foreground">{team.description}</div>
            )}
            <div className="text-sm">
              <div><b>Team Manager:</b> {team.managerName}</div>
              <div>
                <b>Total Members:</b> {team.totalMembers}
              </div>
              <div>
                <b>Total Tasks:</b> {team.totalTasks}
              </div>
              <div>
                <b>Tasks Completed:</b> {team.completedTasks}
              </div>
            </div>
            <div className="mt-2 flex">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModalForTeamId(team.id)}
              >
                Show Members
              </Button>
            </div>
            {showModalForTeamId === team.id && (
              <TeamMembersModal
                open
                onOpenChange={() => setShowModalForTeamId(null)}
                members={team.members}
                teamName={team.name}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyTeams;
