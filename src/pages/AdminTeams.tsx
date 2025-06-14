import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

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

  React.useEffect(() => {
    async function fetchTeams() {
      setLoading(true);
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      
      if (error) {
        toast({ title: "Error loading teams", description: error.message });
        setLoading(false);
        return;
      }
      
      setTeams(data || []);
      setLoading(false);
    }
    
    fetchTeams();
  }, []);

  const filteredTeams = React.useMemo(() => {
    return teams.filter(team => 
      search === "" || 
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      (team.description && team.description.toLowerCase().includes(search.toLowerCase()))
    );
  }, [teams, search]);

  return (
    <div className="p-6 max-w-6xl w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Team Management</h1>
        <Button>Create Team</Button>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <span className="text-muted-foreground">Loading teams...</span>
                </TableCell>
              </TableRow>
            ) : filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <span className="text-muted-foreground">No teams found.</span>
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>{team.name}</TableCell>
                  <TableCell>{team.description || "--"}</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>{team.created_by.slice(0, 8)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminTeams;
