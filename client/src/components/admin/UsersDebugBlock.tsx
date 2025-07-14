
import React from "react";

interface UsersDebugBlockProps {
  me: { id: string; email: string; organization: string | null } | null;
  organization: string | null;
  isAdmin: boolean | null;
  users: any[];
}

const UsersDebugBlock: React.FC<UsersDebugBlockProps> = ({
  me,
  organization,
  isAdmin,
  users,
}) => (
  <div className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded px-4 py-3 text-xs max-w-2xl">
    <div className="mb-1 font-semibold">[DEBUG INFO]</div>
    <div>
      <b>Logged-in User:</b>{" "}
      {me ? `${me.email} (${me.id.slice(0, 8)})` : "(none)"}
    </div>
    <div>
      <b>Organization (for filter):</b> {organization || "(none)"}
    </div>
    <div>
      <b>Is Admin:</b>{" "}
      {isAdmin === null
        ? "checking..."
        : isAdmin
        ? "YES"
        : "NO"}
    </div>
    <div>
      <b>Number of users in filtered org:</b>{" "}
      {users ? users.length : 0}
    </div>
    <div>
      <b>Notes:</b>
      <ul className="list-disc list-inside">
        <li>
          If you do <b>not</b> see users here and "Is Admin" says NO, you don't
          have the admin role (check your{" "}
          <span className="font-mono">public.user_roles</span> table in
          Supabase).
        </li>
        <li>
          If super admin's organization is different than your org, you will
          only see yourself here (organization filter is strict).
        </li>
        <li>
          If "Organization" is blank, your user is not mapped in{" "}
          <span className="font-mono">public.users</span> or has no org set.
        </li>
        <li>
          If issue persists, check{" "}
          <span className="font-mono">public.users</span> and{" "}
          <span className="font-mono">public.user_roles</span> directly in
          Supabase dashboard.
        </li>
      </ul>
    </div>
  </div>
);

export default UsersDebugBlock;
