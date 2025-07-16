
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { OfficeLocation, InsertOfficeLocation } from "@shared/schema";

const OfficeLocationsManager: React.FC = () => {
  const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
  const [newLocation, setNewLocation] = useState({ location_name: "", address: "" });
  const [editingLocations, setEditingLocations] = useState<{
    [id: string]: { location_name: string; address: string };
  }>({});
  const { highestRole } = useRole();
  const queryClient = useQueryClient();

  // Fetch office locations using React Query
  const { data: locations = [], isLoading: loading } = useQuery<OfficeLocation[]>({
    queryKey: ["/api/office-locations"],
    queryFn: () => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      return apiRequest("/api/office-locations", {
        headers: {
          'x-user-id': user?.id || ''
        }
      });
    }
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: (data: InsertOfficeLocation) => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      console.log("Making API request with data:", data);
      return apiRequest("/api/office-locations", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office-locations"] });
      setNewLocation({ location_name: "", address: "" });
      toast({ title: "Office location added successfully" });
    },
    onError: (error) => {
      console.error("Error adding location:", error);
      toast({ title: "Error", description: "Failed to add office location" });
    },
  });

  const handleAddLocation = async () => {
    if (!newLocation.location_name.trim() || !newLocation.address.trim()) return;
    console.log("Adding office location:", newLocation);
    createLocationMutation.mutate(newLocation);
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

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OfficeLocation> }) => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      return apiRequest(`/api/office-locations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        }
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/office-locations"] });
      setEditing({ ...editing, [id]: false });
      toast({ title: "Office location updated successfully" });
    },
    onError: (error) => {
      console.error("Error updating location:", error);
      toast({ title: "Error", description: "Failed to update office location" });
    },
  });

  const handleSaveLocation = async (id: string) => {
    const editedLocation = editingLocations[id];
    if (!editedLocation || !editedLocation.location_name.trim() || !editedLocation.address.trim()) return;
    updateLocationMutation.mutate({ id, data: editedLocation });
  };

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: (id: string) => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      return apiRequest(`/api/office-locations/${id}`, {
        method: "DELETE",
        headers: {
          'x-user-id': user?.id || ''
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office-locations"] });
      toast({ title: "Office location deleted successfully" });
    },
    onError: (error) => {
      console.error("Error deleting location:", error);
      toast({ title: "Error", description: "Failed to delete office location" });
    },
  });

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this office location?")) return;
    deleteLocationMutation.mutate(id);
  };

  return (
    <div className="w-full space-y-6">
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
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center">Loading...</td>
                    </tr>
                  ) : locations.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-muted-foreground">No office locations found</td>
                    </tr>
                  ) : (
                    locations.map((location) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {highestRole === "admin" && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Add New Office Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Location Name</label>
                <Input
                  placeholder="Enter location name"
                  value={newLocation.location_name}
                  onChange={(e) => setNewLocation({ ...newLocation, location_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <Textarea
                  placeholder="Enter address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  rows={3}
                />
              </div>
              <Button onClick={handleAddLocation} variant="default" className="w-full sm:w-auto">
                Add Office Location
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OfficeLocationsManager;
