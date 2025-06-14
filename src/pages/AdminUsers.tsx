
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

interface User {
  id: string;
  email: string;
  created_at?: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (error) {
        toast({ title: "Error loading users", description: error.message });
        setLoading(false);
        return;
      }
      setUsers(
        data?.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
        })) || []
      );
      setLoading(false);
    }
    fetchUsers();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      {loading && <div className="text-muted-foreground mb-4">Loading...</div>}
      <table className="w-full text-sm border rounded-md shadow bg-background">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Created At</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b last:border-b-0">
              <td className="p-2">{user.email}</td>
              <td className="p-2">{user.created_at ? new Date(user.created_at).toLocaleString() : "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsers;
