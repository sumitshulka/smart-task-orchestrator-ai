import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreateUserDialogProps {
  onUserCreated?: () => void;
  organization?: string; // (Optional) if passed, use as default org
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
}) => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);

  // NEW: Departments from DB
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // For tracking who is the current admin
  const [currentUser, setCurrentUser] = useState<null | { id: string; organization?: string }>(null);

  // Fetch Departments from Supabase
  React.useEffect(() => {
    const fetchDepartments = async () => {
      setDepartmentsLoading(true);
      const { data, error } = await supabase
        .from("departments")
        .select("name")
        .order("name");
      if (error) {
        toast({
          title: "Failed to load departments",
          description: error.message,
        });
      } else {
        setDepartments(data?.map((d: { name: string }) => d.name) || []);
      }
      setDepartmentsLoading(false);
    };
    fetchDepartments();
  }, []);

  // Fetch current admin user id and org if not already loaded
  React.useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        let org = organization;
        const { data } = await supabase
          .from("users")
          .select("organization")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data?.organization) org = data.organization;
        setCurrentUser({ id: session.user.id, organization: org });
      }
    };
    fetch();
  }, [organization]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { email, password, user_name, department, phone, manager } = values;
      // 1. Create user via Supabase Auth
      const { data: created, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          full_name: user_name,
          department,
          phone,
          manager,
        },
      });

      if (authError || !created?.user?.id) {
        toast({
          title: "Failed to create user",
          description: authError?.message || "Unknown error",
        });
        setLoading(false);
        return;
      }

      // 2. Insert metadata into public.users table
      const publicUser = {
        id: created.user.id,
        email,
        user_name,
        department,
        phone,
        manager,
        organization: currentUser?.organization || organization || "Main",
        created_by: currentUser?.id,
      };

      const { error: dbError } = await supabase
        .from("users")
        .insert([publicUser]);

      if (dbError) {
        toast({
          title: "Failed to store extra user info",
          description: dbError.message,
        });
        setLoading(false);
        return;
      }

      toast({
        title: "User created successfully",
        description: `User "${user_name || email}" was created.`,
      });

      setOpen(false);
      setValues(initialValues);
      setLoading(false);
      onUserCreated?.();
    } catch (err: any) {
      toast({
        title: "Unexpected error",
        description: err.message || "Could not create user",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto gap-2" size="sm">
          <span>+ Create User</span>
        </Button>
      </DialogTrigger>
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
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
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
            <Input
              name="manager"
              placeholder="Manager"
              value={values.manager}
              onChange={handleChange}
              disabled={loading}
            />
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
