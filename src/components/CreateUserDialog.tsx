
import React, { useState } from "react";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/hooks/useDepartments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { apiCreateUser } from "@/integrations/supabase/apiCreateUser";
import { useUserList } from "@/hooks/useUserList";

interface CreateUserDialogProps {
  onUserCreated?: () => void;
  organization?: string; // (Optional) if passed, use as default org
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const initialValues = {
  email: "",
  password: "",
  user_name: "",
  department: "",
  phone: "",
  manager: "",
};

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  onUserCreated,
  organization,
  open,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use external control if provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  // Departments logic refactored into useDepartments
  const { departments, loading: departmentsLoading } = useDepartments();
  // Current admin logic refactored into useCurrentUser
  const currentUser = useCurrentUser(organization);
  // All users for manager dropdown
  const { users: allUsers, loading: usersLoading } = useUserList();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { email, password, user_name, department, phone, manager } = values;
      // Only assign "user" role by default, admins can update roles after
      const payload = {
        email,
        password,
        user_name,
        department,
        phone,
        manager,
        roles: ["user"],
      };
      const result = await apiCreateUser(payload);

      toast({
        title: "User created successfully",
        description: `User "${user_name || email}" was created.`,
      });

      setIsOpen(false);
      setValues(initialValues);
      setLoading(false);
      onUserCreated?.();
    } catch (err: any) {
      setError(err.message || "Could not create user");
      toast({
        title: "Failed to create user",
        description: err.message || "An error occurred",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Only show trigger if not externally controlled */}
      {open === undefined && (
        <DialogTrigger asChild>
          <Button className="w-full md:w-auto gap-2" size="sm">
            <span>+ Create User</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Fill in the details to register a new user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              name="email"
              type="email"
              placeholder="Email"
              required
              value={values.email}
              onChange={handleChange}
              disabled={loading}
            />
            <Input
              name="password"
              type="password"
              placeholder="Password"
              required
              value={values.password}
              onChange={handleChange}
              disabled={loading}
            />
            <Input
              name="user_name"
              placeholder="Full Name"
              value={values.user_name}
              onChange={handleChange}
              disabled={loading}
            />
            <select
              name="department"
              className="border rounded px-2 py-2 text-sm bg-background"
              value={values.department}
              onChange={handleChange}
              disabled={loading || departmentsLoading}
              required
            >
              <option value="">{departmentsLoading ? "Loading departments..." : "Select department"}</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
            <Input
              name="phone"
              placeholder="Phone"
              value={values.phone}
              onChange={handleChange}
              disabled={loading}
            />
            {/* MANAGER DROPDOWN */}
            <select
              name="manager"
              className="border rounded px-2 py-2 text-sm bg-background"
              value={values.manager}
              onChange={handleChange}
              disabled={loading || usersLoading}
            >
              <option value="">Select Manager</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.user_name ? `${u.user_name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
            {error && (<div className="text-red-600 text-sm">{error}</div>)}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;
