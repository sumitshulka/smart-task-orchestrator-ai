
import React from "react";

export default function WarningNoTeams({
  isOnTeams,
  loading,
  isUserOnly,
  hasTeams,
}: {
  isOnTeams: boolean;
  loading: boolean;
  isUserOnly: boolean;
  hasTeams: boolean;
}) {
  if (!(isOnTeams && !loading && isUserOnly && !hasTeams)) return null;
  return (
    <div className="p-3 my-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded">
      <b>Warning:</b> You are not assigned to any team. Please contact your admin to get assigned to a team.
    </div>
  );
}
