
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider";

type OfficeLocation = {
  id: string;
  location_name: string;
  address: string;
  location_manager: string | null;
  created_at: string;
  updated_at: string;
};

const OfficeLocationsManager: React.FC = () => {
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
  const [newLocation, setNewLocation] = useState({ location_name: "", address: "" });
  const [editingLocations, setEditingLocations] = useState<{
    [id: string]: { location_name: string; address: string };
  }>({});
  const { highestRole } = useRole();

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from("office_locations")
      .select("*")
      .order("location_name");

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    setLocations(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAddLocation = async () => {
    if (!newLocation.location_name.trim() || !newLocation.address.trim()) return;

    const { data, error } = await supabase
      .from("office_locations")
      .insert([{ location_name: newLocation.location_name, address: newLocation.address }])
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    setNewLocation({ location_name: "", address: "" });
    fetchLocations();
    toast({ title: "Office location added successfully" });
  };

  const handleEditLocation = (id: string) => {
    setEditing({ ...editing, [id]: true });
    const location = locations.find((l) => l.id === id);
    if (location) {
      setEditingLocations({
        ...editingLocations,
        [id]: { location_name: location.location_name, address: location.address },
      });
    }
  };

  const handleSaveLocation = async (id: string) => {
    const editedLocation = editingLocations[id];
    if (!editedLocation || !editedLocation.location_name.trim() || !editedLocation.address.trim()) return;

    const { error } = await supabase
      .from("office_locations")
      .update({ location_name: editedLocation.location_name, address: editedLocation.address })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    setEditing({ ...editing, [id]: false });
    fetchLocations();
    toast({ title: "Office location updated successfully" });
  };

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this office location?")) return;

    const { error } = await supabase.from("office_locations").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    fetchLocations();
    toast({ title: "Office location deleted successfully" });
  };

  return (
    <div className="w-full">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Office Locations</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          <div className="w-full border rounded bg-background shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="w-1/3 p-2 font-semibold text-black text-left">Location Name</th>
                    <th className="w-1/2 p-2 font-semibold text-black text-left">Address</th>
                    <th className="w-1/6 p-2 text-center font-semibold text-black">
                      {highestRole === "admin" ? "Actions" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location) => (
                    <tr key={location.id}>
                      <td className="p-2">
                        {editing[location.id] && highestRole === "admin" ? (
                          <Input
                            value={editingLocations[location.id]?.location_name || ""}
                            onChange={(e) =>
                              setEditingLocations({
                                ...editingLocations,
                                [location.id]: {
                                  ...editingLocations[location.id],
                                  location_name: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          location.location_name
                        )}
                      </td>
                      <td className="p-2">
                        {editing[location.id] && highestRole === "admin" ? (
                          <Textarea
                            value={editingLocations[location.id]?.address || ""}
                            onChange={(e) =>
                              setEditingLocations({
                                ...editingLocations,
                                [location.id]: {
                                  ...editingLocations[location.id],
                                  address: e.target.value,
                                },
                              })
                            }
                            rows={2}
                          />
                        ) : (
                          location.address
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-2">
                          {editing[location.id] && highestRole === "admin" ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSaveLocation(location.id)}
                            >
                              Save
                            </Button>
                          ) : highestRole === "admin" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditLocation(location.id)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteLocation(location.id)}
                              >
                                Delete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {highestRole === "admin" && (
            <div className="flex flex-wrap gap-2 items-end mt-4">
              <Input
                placeholder="Location name"
                className="w-[200px]"
                value={newLocation.location_name}
                onChange={(e) => setNewLocation({ ...newLocation, location_name: e.target.value })}
              />
              <Textarea
                placeholder="Address"
                className="w-[300px]"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                rows={2}
              />
              <Button onClick={handleAddLocation} variant="default">
                Add Location
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OfficeLocationsManager;
