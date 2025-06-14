
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  email: string;
  user_name?: string;
  department?: string;
  phone?: string;
  manager?: string;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserUpdated?: () => void;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({
  open,
  onOpenChange,
  user,
  onUserUpdated,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_name: user?.user_name ?? "",
    department: user?.department ?? "",
    phone: user?.phone ?? "",
    manager: user?.manager ?? "",
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // Fetch departments dynamically from Supabase
  useEffect(() => {
    async function fetchDepartments() {
      setDepartmentsLoading(true);
      const { data, error } = await supabase.from("departments").select("name").order("name");
      if (error) {
        toast({ title: "Failed to load departments", description: error.message });
        setDepartments([]);
        setDepartmentsLoading(false);
        return;
      }
      setDepartments(data.map((d: {name: string}) => d.name));
      setDepartmentsLoading(false);
    }
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  React.useEffect(() => {
    if (user) {
      setForm({
        user_name: user.user_name ?? "",
        department: user.department ?? "",
        phone: user.phone ?? "",
        manager: user.manager ?? "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        user_name: form.user_name,
        department: form.department,
        phone: form.phone,
        manager: form.manager
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Failed to update user", description: error.message });
      setSaving(false);
      return;
    }

    toast({ title: "User updated!" });
    setSaving(false);
    onOpenChange(false);
    if (onUserUpdated) {
      onUserUpdated();
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {user.email}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Name</label>
            <Input
              name="user_name"
              value={form.user_name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Department</label>
            <select
              name="department"
              value={form.department}
              onChange={handleChange}
              className="border rounded px-2 py-1 w-full"
              disabled={departmentsLoading}
            >
              <option value="">-- Select --</option>
              {departments.map((dep) => (
                <option value={dep} key={dep}>{dep}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Phone</label>
            <Input
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium text-muted-foreground">Manager</label>
            <Input
              name="manager"
              value={form.manager}
              onChange={handleChange}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
