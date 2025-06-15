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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!teams?.length) {
      setTeamsExtended([]);
      return;
    }

    async function enrichTeams() {
      setErrorMessage(null);
      console.log("[MyTeams DEBUG][Session] Current authenticated user:", user);

      const promises = teams.map(async (team: any) => {
        // 1. Fetch team memberships for this team
        const { data: memberships, error: membershipsError } = await supabase
          .from("team_memberships")
          .select("user_id, role_within_team, joined_at")
          .eq("team_id", team.id);

        if (membershipsError) {
          console.error("[MyTeams] team_memberships fetch error", membershipsError);
        }
        // 2. Now get all user_ids from memberships
        const userIds = memberships?.map((m: any) => m.user_id).filter(Boolean) || [];
        let members: TeamExtended["members"] = [];
        if (userIds.length > 0) {
          const { data: usersForTeam, error: usersFetchError } = await supabase
            .from("users")
            .select("id, email, user_name")
            .in("id", userIds);

          if (usersFetchError) {
            console.error(`[MyTeams] Error fetching users for team ${team.name}`, usersFetchError);
          }
          members =
            memberships.map((m: any) => {
              const matchedUser = usersForTeam?.find((u: any) => u.id === m.user_id);
              return {
                id: m.user_id,
                email: matchedUser?.email ?? "-",
                user_name: matchedUser?.user_name ?? "-",
                allocationDate: m.joined_at,
                role_within_team: m.role_within_team,
              };
            }) ?? [];
        }

        // 3. Manager: identify by memberships (role_within_team=manager) or team.created_by
        let manager = members.find(
          (m) => String(m.role_within_team || "").toLowerCase() === "manager"
        );
        let managerName = "-";
        let managerEmail = "-";
        if (!manager && team.created_by) {
          manager = members.find((m) => m.id === team.created_by);
        }
        if (manager && manager.user_name && manager.email) {
          managerName = manager.user_name;
          managerEmail = manager.email;
        } else if (team.created_by) {
          // If no manager found in members, fetch directly
          const { data: managerUser, error: managerFetchError } = await supabase
            .from("users")
            .select("id, user_name, email")
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

        // 4. Fetch all tasks for this team assigned to members (not type 'personal')
        let totalTasks = 0;
        let completedTasks = 0;
        if (userIds.length > 0) {
          console.log("[MyTeams DEBUG] Querying tasks for team:", {
            teamId: team.id,
            teamName: team.name,
            userIds: userIds,
            suppliedUserUid: user?.id,
          });

          const taskQuery = supabase
            .from("tasks")
            .select("id,status,type,team_id,assigned_to")
            .in("assigned_to", userIds)
            .eq("team_id", team.id)
            .neq("type", "personal");

          let tasksResponse;
          try {
            tasksResponse = await taskQuery;
            console.log("[MyTeams DEBUG][Supabase Response]", tasksResponse);
          } catch (err) {
            console.error("[MyTeams DEBUG][Supabase Exception thrown]", err);
            setErrorMessage("Exception thrown running tasks query: " + String(err));
            return {
              ...team,
              managerName,
              managerEmail,
              members,
              totalMembers: members.length,
              totalTasks: 0,
              completedTasks: 0,
            } as TeamExtended;
          }

          const { data: tasks, error: tasksError } = tasksResponse;

          if (tasksError) {
            console.error(`[MyTeams] tasks fetch error for team ${team.name}`, tasksError);
            setErrorMessage(`Supabase error for tasks (team "${team.name}"): ${tasksError.message}`);
          } else if (!tasks || tasks.length === 0) {
            setErrorMessage(
              prev =>
                prev ||
                `[MyTeams] No tasks were found from Supabase for team "${team.name}", even though query ran without error.`
            );
          }

          console.log("[MyTeams DEBUG] Received tasks for team:", {
            teamId: team.id,
            teamName: team.name,
            suppliedUserUid: user?.id,
            taskCount: tasks?.length,
            tasks: tasks,
            queryParams: {
              assigned_to: userIds,
              team_id: team.id,
              type_ne: "personal",
            },
            error: tasksError,
          });

          if (tasks) {
            totalTasks = tasks.length;
            completedTasks = tasks.filter(
              (t: any) => String(t.status || "").toLowerCase() === "completed"
            ).length;
            console.log("[MyTeams DEBUG] Task calculations for team:", {
              teamId: team.id,
              totalTasks,
              completedTasks,
            });
          }
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
      setTeamsExtended(extendedTeams);
    }

    enrichTeams();
  }, [teams, user]);

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
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          <b>Error / Warning (Dev Only):</b> {errorMessage}
        </div>
      )}
      <div className="flex flex-col gap-5 w-full">
        {teamsExtended.map((team) => (
          <Card key={team.id} className="p-5 w-full">
            {/* HEADER ROW: name, manager */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-base sm:text-lg">{team.name}</span>
                <Badge variant="secondary">ID: {team.id.slice(0, 6)}…</Badge>
              </div>
              <div className="text-sm">
                <b>Team Manager:</b>{" "}
                <span>
                  {team.managerName}{" "}
                  <span className="text-muted-foreground">({team.managerEmail})</span>
                </span>
              </div>
            </div>
            {team.description && (
              <span className="text-muted-foreground">{team.description}</span>
            )}
            {/* STATS ROW */}
            <div className="text-sm mt-2 flex flex-wrap gap-y-1 gap-x-8">
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
