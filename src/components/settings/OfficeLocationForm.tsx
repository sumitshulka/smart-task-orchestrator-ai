
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface OfficeLocationFormProps {
  initialValues?: { location_name: string; address: string; location_manager?: string | null };
  onSubmit: (values: { location_name: string; address: string; location_manager?: string | null }) => void;
  onCancel: () => void;
}

interface User {
  id: string;
  user_name: string | null;
  email: string;
}

const NONE_VALUE = "none";

const OfficeLocationForm: React.FC<OfficeLocationFormProps> = ({
  initialValues,
  onSubmit,
  onCancel
}) => {
  // Set initial value for location_manager to "none" if falsy
  const [values, setValues] = useState({
    location_name: initialValues?.location_name || "",
    address: initialValues?.address || "",
    location_manager: initialValues?.location_manager ? initialValues.location_manager : NONE_VALUE,
  });
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [userCount, setUserCount] = useState<number>(0);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      // First, count users efficiently to avoid pulling all records
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true });

      if (count) setUserCount(count);

      // If count < 51, get all user records (id, user_name, email)
      if ((count || 0) <= 50) {
        const { data } = await supabase
          .from("users")
          .select("id, user_name, email")
          .order("user_name", { ascending: true });
        setUsers(data || []);
      }
    };
    fetchUsers();
  }, []);

  // For search dialog
  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, user_name, email")
      .order("user_name", { ascending: true });
    setUsers(data || []);
  };

  // When dialog opens, fetch full user list if not already loaded
  useEffect(() => {
    if (commandOpen && users.length === 0 && userCount > 50) fetchAllUsers();
    // eslint-disable-next-line
  }, [commandOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onSubmit({
      location_name: values.location_name,
      address: values.address,
      location_manager:
        values.location_manager === NONE_VALUE ? null : values.location_manager,
    });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          placeholder="Location Name"
          name="location_name"
          required
          value={values.location_name}
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <textarea
          placeholder="Address"
          name="address"
          className="w-full border rounded px-3 py-2 text-sm resize-none min-h-[60px]"
          required
          value={values.address}
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Location Manager</label>
        {userCount > 50 ? (
          <>
            <Button type="button" className="w-full justify-between" variant="outline"
              onClick={() => setCommandOpen(true)} disabled={loading}>
              {values.location_manager && values.location_manager !== NONE_VALUE
                ? users.find(u => u.id === values.location_manager)?.user_name ||
                  users.find(u => u.id === values.location_manager)?.email ||
                  "Select Location Manager"
                : "Select Location Manager"
              }
            </Button>
            <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle>Select a user</DialogTitle>
                </DialogHeader>
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    {users.length === 0 && (
                      <CommandEmpty>No users found.</CommandEmpty>
                    )}
                    {/* Add (None) option */}
                    <CommandItem
                      key={NONE_VALUE}
                      value="(None)"
                      onSelect={() => {
                        setValues((v) => ({ ...v, location_manager: NONE_VALUE }));
                        setCommandOpen(false);
                      }}
                    >
                      <div>
                        <div className="font-medium text-muted-foreground">(None)</div>
                      </div>
                    </CommandItem>
                    {users.map(user => (
                      <CommandItem
                        key={user.id}
                        value={user.user_name || user.email}
                        onSelect={() => {
                          setValues((v) => ({ ...v, location_manager: user.id }));
                          setCommandOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-medium">{user.user_name || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Select
            value={values.location_manager || NONE_VALUE}
            onValueChange={val =>
              setValues((v) => ({ ...v, location_manager: val }))
            }
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Location Manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={NONE_VALUE} value={NONE_VALUE}>
                (None)
              </SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.user_name ? `${user.user_name} (${user.email})` : user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : (initialValues ? "Save" : "Add")}
        </Button>
      </div>
    </form>
  );
};

export default OfficeLocationForm;
