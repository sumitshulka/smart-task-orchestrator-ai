
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import { useUserList } from "@/hooks/useUserList";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  user_name?: string;
  department?: string;
  phone?: string;
  manager?: string;
  // Benchmarking override fields
  benchmarking_excluded?: boolean;
  custom_min_hours_per_day?: number;
  custom_max_hours_per_day?: number;
  custom_min_hours_per_week?: number;
  custom_max_hours_per_week?: number;
  custom_min_hours_per_month?: number;
  custom_max_hours_per_month?: number;
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
    // Benchmarking override fields
    benchmarking_excluded: user?.benchmarking_excluded ?? false,
    custom_min_hours_per_day: user?.custom_min_hours_per_day?.toString() ?? "",
    custom_max_hours_per_day: user?.custom_max_hours_per_day?.toString() ?? "",
    custom_min_hours_per_week: user?.custom_min_hours_per_week?.toString() ?? "",
    custom_max_hours_per_week: user?.custom_max_hours_per_week?.toString() ?? "",
    custom_min_hours_per_month: user?.custom_min_hours_per_month?.toString() ?? "",
    custom_max_hours_per_month: user?.custom_max_hours_per_month?.toString() ?? "",
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // User list for manager dropdown
  const { users: allUsers, loading: usersLoading } = useUserList();
  // Organization settings for benchmarking overrides
  const { data: orgSettings } = useQuery({
    queryKey: ['/api/organization-settings'],
    enabled: open,
  });

  // Fetch departments dynamically from API
  useEffect(() => {
    async function fetchDepartments() {
      setDepartmentsLoading(true);
      try {
        // For now, use hardcoded departments since we don't have a departments API
        const hardcodedDepartments = ["Administration", "IT", "HR", "Finance", "Marketing", "Sales", "Operations"];
        setDepartments(hardcodedDepartments);
      } catch (error) {
        console.error('Error fetching departments:', error);
        toast({ title: "Failed to load departments" });
        setDepartments([]);
      }
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
        // Benchmarking override fields
        benchmarking_excluded: user.benchmarking_excluded ?? false,
        custom_min_hours_per_day: user.custom_min_hours_per_day?.toString() ?? "",
        custom_max_hours_per_day: user.custom_max_hours_per_day?.toString() ?? "",
        custom_min_hours_per_week: user.custom_min_hours_per_week?.toString() ?? "",
        custom_max_hours_per_week: user.custom_max_hours_per_week?.toString() ?? "",
        custom_min_hours_per_month: user.custom_min_hours_per_month?.toString() ?? "",
        custom_max_hours_per_month: user.custom_max_hours_per_month?.toString() ?? "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    // Defensive handling: manager ID should be string or null (never undefined)
    let managerValue: string | null = form.manager?.trim() === "" ? null : form.manager;
    // Optional: Avoid setting manager to self
    if (managerValue === user.id) managerValue = null;

    // Build update payload
    const cleanedForm = {
      user_name: form.user_name?.trim() || null,
      department: form.department?.trim() || null,
      phone: form.phone?.trim() || null,
      manager: managerValue,
      // Include benchmarking overrides if organization allows them
      ...(orgSettings?.allow_user_level_override && {
        benchmarking_excluded: form.benchmarking_excluded,
        custom_min_hours_per_day: form.custom_min_hours_per_day ? parseInt(form.custom_min_hours_per_day) : null,
        custom_max_hours_per_day: form.custom_max_hours_per_day ? parseInt(form.custom_max_hours_per_day) : null,
        custom_min_hours_per_week: form.custom_min_hours_per_week ? parseInt(form.custom_min_hours_per_week) : null,
        custom_max_hours_per_week: form.custom_max_hours_per_week ? parseInt(form.custom_max_hours_per_week) : null,
        custom_min_hours_per_month: form.custom_min_hours_per_month ? parseInt(form.custom_min_hours_per_month) : null,
        custom_max_hours_per_month: form.custom_max_hours_per_month ? parseInt(form.custom_max_hours_per_month) : null,
      }),
    };

    // Debug log for payload
    console.log("[EditUserDialog] Prepared to update user:", user.id, cleanedForm);

    try {
      await apiClient(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(cleanedForm),
        headers: { 'Content-Type': 'application/json' },
      });

      toast({ title: "User updated!" });
      setSaving(false);
      onOpenChange(false);
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      // Defensive fallback for unexpected errors
      console.error("[EditUserDialog] Caught exception:", err);
      toast({ title: "Unexpected error", description: err.message || String(err) });
      setSaving(false);
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
            <select
              name="manager"
              value={form.manager}
              onChange={handleChange}
              className="border rounded px-2 py-1 w-full"
              disabled={usersLoading}
            >
              <option value="">Select Manager</option>
              {allUsers
                .filter(u => u.id !== user.id) // Don't allow self-manager
                .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.user_name ? `${u.user_name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>
          
          {/* BENCHMARKING OVERRIDES SECTION */}
          {orgSettings?.benchmarking_enabled && orgSettings?.allow_user_level_override && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-semibold">Benchmarking Overrides</h4>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="benchmarking_excluded_edit"
                  name="benchmarking_excluded"
                  checked={form.benchmarking_excluded}
                  onChange={handleChange}
                  disabled={saving}
                  className="rounded"
                />
                <label htmlFor="benchmarking_excluded_edit" className="text-sm">
                  Exclude from benchmarking analysis
                </label>
              </div>
              
              {!form.benchmarking_excluded && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Min Hours/Day</label>
                    <Input
                      name="custom_min_hours_per_day"
                      type="number"
                      min="0"
                      placeholder={`Default: ${orgSettings?.min_hours_per_day || 0}`}
                      value={form.custom_min_hours_per_day}
                      onChange={handleChange}
                      disabled={saving}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max Hours/Day</label>
                    <Input
                      name="custom_max_hours_per_day"
                      type="number"
                      min="0"
                      placeholder={`Default: ${orgSettings?.max_hours_per_day || 8}`}
                      value={form.custom_max_hours_per_day}
                      onChange={handleChange}
                      disabled={saving}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Min Hours/Week</label>
                    <Input
                      name="custom_min_hours_per_week"
                      type="number"
                      min="0"
                      placeholder={`Default: ${orgSettings?.min_hours_per_week || 0}`}
                      value={form.custom_min_hours_per_week}
                      onChange={handleChange}
                      disabled={saving}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max Hours/Week</label>
                    <Input
                      name="custom_max_hours_per_week"
                      type="number"
                      min="0"
                      placeholder={`Default: ${orgSettings?.max_hours_per_week || 40}`}
                      value={form.custom_max_hours_per_week}
                      onChange={handleChange}
                      disabled={saving}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Min Hours/Month</label>
                    <Input
                      name="custom_min_hours_per_month"
                      type="number"
                      min="0"
                      placeholder={`Default: ${orgSettings?.min_hours_per_month || 0}`}
                      value={form.custom_min_hours_per_month}
                      onChange={handleChange}
                      disabled={saving}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max Hours/Month</label>
                    <Input
                      name="custom_max_hours_per_month"
                      type="number"
                      min="0"
                      placeholder={`Default: ${orgSettings?.max_hours_per_month || 160}`}
                      value={form.custom_max_hours_per_month}
                      onChange={handleChange}
                      disabled={saving}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
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

