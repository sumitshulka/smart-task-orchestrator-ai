import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DepartmentForm from "./DepartmentForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider"; // Import

interface Department {
  id: string;
  name: string;
  description?: string;
}

const DepartmentsManager: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editDep, setEditDep] = useState<Department | null>(null);
  const { highestRole } = useRole(); // Get the role from context

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, description")
      .order("created_at");
    if (error) {
      toast({ title: "Failed to fetch departments", description: error.message });
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreateOrUpdate = async (values: { name: string; description?: string }, id?: string) => {
    if (id) {
      // Update
      const { error } = await supabase
        .from("departments")
        .update({ name: values.name, description: values.description, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        toast({ title: "Failed to update department", description: error.message });
        return;
      }
      toast({ title: "Department updated" });
    } else {
      // Create
      const { error } = await supabase
        .from("departments")
        .insert([{ name: values.name, description: values.description }]);
      if (error) {
        toast({ title: "Failed to create department", description: error.message });
        return;
      }
      toast({ title: "Department created" });
    }
    setOpenForm(false);
    setEditDep(null);
    fetchDepartments();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete department", description: error.message });
      return;
    }
    toast({ title: "Department deleted" });
    fetchDepartments();
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Departments</CardTitle>
        {highestRole === "admin" && (
          <Button size="sm" onClick={() => setOpenForm(true)}>+ Add Department</Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="border rounded bg-background overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="w-1/4 p-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="w-2/4 p-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="w-1/4 p-2 text-center font-medium text-muted-foreground">
                  {highestRole === "admin" ? "Actions" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3}><span className="text-muted-foreground">Loading...</span></td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={3}><span className="text-muted-foreground">No departments found.</span></td>
                </tr>
              ) : (
                departments.map((d) => (
                  <tr key={d.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4">{d.name}</td>
                    <td className="p-4">{d.description || "--"}</td>
                    <td className="p-4">
                      {highestRole === "admin" && (
                        <div className="flex items-center justify-center gap-2">
                          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setEditDep(d); setOpenForm(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => handleDelete(d.id)}>
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
      {highestRole === "admin" &&
        <Dialog open={openForm} onOpenChange={o => { setOpenForm(o); if (!o) setEditDep(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editDep ? "Edit Department" : "Add Department"}</DialogTitle>
            </DialogHeader>
            <DepartmentForm
              initialValues={editDep}
              onSubmit={v => handleCreateOrUpdate(v, editDep?.id)}
              onCancel={() => { setOpenForm(false); setEditDep(null); }}
            />
          </DialogContent>
        </Dialog>
      }
    </Card>
  );
};

export default DepartmentsManager;
