
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
  managerEmail?: string;
  members: {
    id: string;
    email: string;
    user_name?: string | null;
    allocationDate?: string;
    role_within_team?: string | null;
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
    if (!teams?.length) {
      setTeamsExtended([]);
      return;
    }

    async function enrichTeams() {
      console.log("[MyTeams] Teams input:", teams);
      const promises = teams.map(async (team: any) => {
        // Members (with role and allocation date)
        const { data: memberships, error: membershipsError } = await supabase
          .from("team_memberships")
          .select("user_id, role_within_team, joined_at, user:users(id,email,user_name)")
          .eq("team_id", team.id);

        if (membershipsError) {
          console.error("[MyTeams] team_memberships fetch error", membershipsError);
        }
        console.log(`[MyTeams] Fetched memberships for team ${team.name}:`, memberships);

        let members: TeamExtended["members"] = [];
        if (!membershipsError && memberships) {
          members =
            memberships.map((m: any) => ({
              id: m.user?.id,
              email: m.user?.email ?? "-",
              user_name: m.user?.user_name ?? "-",
              allocationDate: m.joined_at,
              role_within_team: m.role_within_team,
            })) ?? [];
        }

        // Manager: pick member where role_within_team is manager. Fallback to created_by user in users table if needed.
        let manager = members.find(
          (m) => String(m.role_within_team || "").toLowerCase() === "manager"
        );
        if (!manager && team.created_by) {
          // Try to find the created_by user
          manager = members.find((m) => m.id === team.created_by);
        }

        // Fallback: fetch manager by ID directly from users table if needed.
        let managerName = "-";
        let managerEmail = "-";
        if (manager && manager.user_name && manager.email) {
          managerName = manager.user_name;
          managerEmail = manager.email;
        } else if (team.created_by) {
          const { data: managerUser, error: managerFetchError } = await supabase
            .from("users")
            .select("id,user_name,email")
            .eq("id", team.created_by)
            .maybeSingle();
          if (managerFetchError) {
            console.error(`[MyTeams] Error fetching manager user for team ${team.name}`, managerFetchError);
          }
          if (managerUser) {
            managerName = managerUser.user_name ?? "-";
            managerEmail = managerUser.email ?? "-";
          }
        }

        // Tasks: all with this team_id
        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select("id,status,team_id")
          .eq("team_id", team.id);

        if (tasksError) {
          console.error(`[MyTeams] tasks fetch error for team ${team.name}`, tasksError);
        }
        console.log(`[MyTeams] Fetched tasks for team ${team.name}:`, tasks);

        let totalTasks = 0;
        let completedTasks = 0;
        if (!tasksError && tasks) {
          totalTasks = tasks.length;
          completedTasks =
            tasks.filter(
              (t: any) => String(t.status || "").toLowerCase() === "completed"
            ).length;
        }

        return {
          ...team,
          managerName,
          managerEmail,
          members,
          totalMembers: members.length,
          totalTasks,
          completedTasks,
        } as TeamExtended;
      });

      const extendedTeams = await Promise.all(promises);
      console.log("[MyTeams] Final teamsExtended:", extendedTeams);
      setTeamsExtended(extendedTeams);
    }

    enrichTeams();
  }, [teams]);

  if (loading) {
    return (
      <div className="p-8 text-left text-muted-foreground">Loading your teams...</div>
    );
  }

  if (!user || teams.length === 0) {
    return (
      <div className="p-8 text-left text-muted-foreground">
        You are not assigned to any teams.
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl px-2 py-6">
      <h1 className="text-2xl font-bold mb-6 text-left">My Teams</h1>
      <div className="flex flex-col gap-5 w-full">
        {teamsExtended.map((team) => (
          <Card key={team.id} className="p-5 w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-base sm:text-lg">{team.name}</span>
                <Badge variant="secondary">ID: {team.id.slice(0, 6)}…</Badge>
              </div>
              {team.description && (
                <span className="text-muted-foreground">{team.description}</span>
              )}
              <div className="text-sm mt-2 flex flex-wrap gap-y-1 gap-x-8">
                <div>
                  <b>Team Manager:</b>{" "}
                  <span>
                    {team.managerName}{" "}
                    <span className="text-muted-foreground">({team.managerEmail})</span>
                  </span>
                </div>
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
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModalForTeamId(team.id)}
                >
                  Show Members
                </Button>
              </div>
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
