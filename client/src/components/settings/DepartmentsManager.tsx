
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/hooks/useDepartments";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider";

const DepartmentsManager: React.FC = () => {
  const { departments, loading, refetch } = useDepartments();
  const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
  const [newDepartment, setNewDepartment] = useState({ name: "", description: "" });
  const [editingDepartments, setEditingDepartments] = useState<{
    [id: string]: { name: string; description: string };
  }>({});
  const { highestRole } = useRole();

  const handleAddDepartment = async () => {
    if (!newDepartment.name.trim()) return;

    const { data, error } = await supabase
      .from("departments")
      .insert([{ name: newDepartment.name, description: newDepartment.description }])
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    setNewDepartment({ name: "", description: "" });
    refetch();
    toast({ title: "Department added successfully" });
  };

  const handleEditDepartment = (id: string) => {
    setEditing({ ...editing, [id]: true });
    const dept = departments.find((d) => d.id === id);
    if (dept) {
      setEditingDepartments({
        ...editingDepartments,
        [id]: { name: dept.name, description: dept.description || "" },
      });
    }
  };

  const handleSaveDepartment = async (id: string) => {
    const editedDept = editingDepartments[id];
    if (!editedDept || !editedDept.name.trim()) return;

    const { error } = await supabase
      .from("departments")
      .update({ name: editedDept.name, description: editedDept.description })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    setEditing({ ...editing, [id]: false });
    refetch();
    toast({ title: "Department updated successfully" });
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;

    const { error } = await supabase.from("departments").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    refetch();
    toast({ title: "Department deleted successfully" });
  };

  return (
    <div className="w-full space-y-6">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Departments</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          <div className="w-full border rounded bg-background shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="w-1/4 p-2 font-semibold text-black text-left">Name</th>
                    <th className="w-1/2 p-2 font-semibold text-black text-left">Description</th>
                    <th className="w-1/4 p-2 text-center font-semibold text-black">
                      {highestRole === "admin" ? "Actions" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <td className="p-2">
                        {editing[department.id] && highestRole === "admin" ? (
                          <Input
                            value={editingDepartments[department.id]?.name || ""}
                            onChange={(e) =>
                              setEditingDepartments({
                                ...editingDepartments,
                                [department.id]: {
                                  ...editingDepartments[department.id],
                                  name: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          department.name
                        )}
                      </td>
                      <td className="p-2">
                        {editing[department.id] && highestRole === "admin" ? (
                          <Textarea
                            value={editingDepartments[department.id]?.description || ""}
                            onChange={(e) =>
                              setEditingDepartments({
                                ...editingDepartments,
                                [department.id]: {
                                  ...editingDepartments[department.id],
                                  description: e.target.value,
                                },
                              })
                            }
                            rows={2}
                          />
                        ) : (
                          department.description
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-2">
                          {editing[department.id] && highestRole === "admin" ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSaveDepartment(department.id)}
                            >
                              Save
                            </Button>
                          ) : highestRole === "admin" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditDepartment(department.id)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteDepartment(department.id)}
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
        </CardContent>
      </Card>

      {highestRole === "admin" && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Add New Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Department Name</label>
                <Input
                  placeholder="Enter department name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="Enter description"
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                  rows={3}
                />
              </div>
              <Button onClick={handleAddDepartment} variant="default" className="w-full sm:w-auto">
                Add Department
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DepartmentsManager;
