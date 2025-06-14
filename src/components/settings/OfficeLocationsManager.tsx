import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import OfficeLocationForm from "./OfficeLocationForm";

interface OfficeLocation {
  id: string;
  location_name: string;
  address: string;
  location_manager?: string | null;
  created_at: string;
}

const OfficeLocationsManager: React.FC = () => {
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editLocation, setEditLocation] = useState<OfficeLocation | null>(null);

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

  return (
    <div className="p-4 max-w-3xl w-full">
      <div className="flex mb-4 justify-between items-center">
        <h3 className="text-xl font-semibold">Office Locations</h3>
        <Button size="sm" onClick={() => setOpenForm(true)}>+ Add Location</Button>
      </div>
      <div className="border rounded shadow bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">S No</TableHead>
              <TableHead>Location Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Location Manager</TableHead>
              <TableHead>Creation Date</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}><span className="text-muted-foreground">Loading...</span></TableCell>
              </TableRow>
            ) : locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}><span className="text-muted-foreground">No office locations found.</span></TableCell>
              </TableRow>
            ) : (
              locations.map((loc, idx) => (
                <TableRow key={loc.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{loc.location_name}</TableCell>
                  <TableCell>{loc.address}</TableCell>
                  <TableCell>{loc.location_manager || "--"}</TableCell>
                  <TableCell>
                    {loc.created_at ? new Date(loc.created_at).toLocaleString() : "--"}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => { setEditLocation(loc); setOpenForm(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(loc.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
    </div>
  );
};

export default OfficeLocationsManager;
