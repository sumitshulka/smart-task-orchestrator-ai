import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DepartmentForm from "./DepartmentForm";

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
    <div className="p-4 max-w-3xl w-full">
      <div className="flex mb-4 justify-between items-center">
        <h3 className="text-xl font-semibold">Departments</h3>
        <Button size="sm" onClick={() => setOpenForm(true)}>+ Add Department</Button>
      </div>
      <div className="border rounded shadow bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3}><span className="text-muted-foreground">Loading...</span></TableCell>
              </TableRow>
            ) : departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}><span className="text-muted-foreground">No departments found.</span></TableCell>
              </TableRow>
            ) : (
              departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.description || "--"}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => { setEditDep(d); setOpenForm(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
    </div>
  );
};

export default DepartmentsManager;
