
import React from "react";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MyTeams = () => {
  const { teams, user, loading } = useCurrentUserRoleAndTeams();

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
        {teams.map((team: any) => (
          <Card key={team.id} className="p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">{team.name}</span>
                <Badge variant="secondary">ID: {team.id.slice(0, 6)}…</Badge>
              </div>
              {team.description && (
                <div className="text-sm text-muted-foreground">{team.description}</div>
              )}
              <div className="text-xs text-muted-foreground">
                Created at: {new Date(team.created_at).toLocaleString()}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyTeams;
