import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import OfficeLocationForm from "./OfficeLocationForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider";

// Add User type for local mapping
type User = {
  id: string;
  user_name: string | null;
  email: string;
};

interface OfficeLocation {
  id: string;
  location_name: string;
  address: string;
  location_manager?: string | null;
  created_at: string;
}

const OfficeLocationsManager: React.FC = () => {
  const { highestRole } = useRole();
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editLocation, setEditLocation] = useState<OfficeLocation | null>(null);
  // New: users cache for lookup of user names
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Fetch all users for mapping IDs to names/emails
  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, user_name, email");
    if (!error && data) {
      setUsers(data);
    }
    setUsersLoading(false);
  };

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("office_locations")
      .select("id, location_name, address, location_manager, created_at")
      .order("created_at");
    if (error) {
      toast({ title: "Failed to fetch office locations", description: error.message });
    } else {
      setLocations(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
    fetchUsers();
  }, []);

  const handleCreateOrUpdate = async (
    values: { location_name: string; address: string; location_manager?: string | null },
    id?: string
  ) => {
    if (id) {
      // Update
      const { error } = await supabase
        .from("office_locations")
        .update({
          location_name: values.location_name,
          address: values.address,
          location_manager: values.location_manager,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) {
        toast({ title: "Failed to update location", description: error.message });
        return;
      }
      toast({ title: "Office location updated" });
    } else {
      // Create
      const { error } = await supabase
        .from("office_locations")
        .insert([{ ...values }]);
      if (error) {
        toast({ title: "Failed to create location", description: error.message });
        return;
      }
      toast({ title: "Office location created" });
    }
    setOpenForm(false);
    setEditLocation(null);
    fetchLocations();
    fetchUsers(); // Ensure user info is up-to-date (e.g. if new user added elsewhere)
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this office location?")) return;
    const { error } = await supabase.from("office_locations").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete location", description: error.message });
      return;
    }
    toast({ title: "Office location deleted" });
    fetchLocations();
  };

  // Lookup user by ID
  const getUserDisplayName = (userId: string | null | undefined) => {
    if (!userId) return "--";
    const user = users.find((u) => u.id === userId);
    if (!user) return "--";
    return user.user_name ? `${user.user_name} (${user.email})` : user.email;
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Office Locations</CardTitle>
        {highestRole === "admin" && (
          <Button size="sm" onClick={() => setOpenForm(true)}>+ Add Location</Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="border rounded bg-background overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="w-10 p-2">S No</th>
                <th className="w-1/6 p-2 text-left font-medium text-muted-foreground">Location Name</th>
                <th className="w-1/4 p-2 text-left font-medium text-muted-foreground">Address</th>
                <th className="w-1/6 p-2 text-left font-medium text-muted-foreground">Location Manager</th>
                <th className="w-1/6 p-2 text-left font-medium text-muted-foreground">Creation Date</th>
                <th className="w-20 p-2 text-center font-medium text-muted-foreground">
                  {highestRole === "admin" ? "Actions" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}><span className="text-muted-foreground">Loading...</span></td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={6}><span className="text-muted-foreground">No office locations found.</span></td>
                </tr>
              ) : (
                locations.map((loc, idx) => (
                  <tr key={loc.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4">{idx + 1}</td>
                    <td className="p-4">{loc.location_name}</td>
                    <td className="p-4">{loc.address}</td>
                    <td className="p-4">
                      {
                        loc.location_manager
                          ? getUserDisplayName(loc.location_manager)
                          : "--"
                      }
                    </td>
                    <td className="p-4">
                      {loc.created_at ? new Date(loc.created_at).toLocaleString() : "--"}
                    </td>
                    <td className="p-4">
                      {highestRole === "admin" && (
                        <div className="flex items-center justify-center gap-2">
                          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setEditLocation(loc); setOpenForm(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => handleDelete(loc.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      {/* Show form only if admin */}
      {highestRole === "admin" &&
        <Dialog open={openForm} onOpenChange={o => { setOpenForm(o); if (!o) setEditLocation(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editLocation ? "Edit Office Location" : "Add Office Location"}</DialogTitle>
            </DialogHeader>
            <OfficeLocationForm
              initialValues={editLocation}
              onSubmit={v => handleCreateOrUpdate(v, editLocation?.id)}
              onCancel={() => { setOpenForm(false); setEditLocation(null); }}
            />
          </DialogContent>
        </Dialog>
      }
    </Card>
  );
};

export default OfficeLocationsManager;
