
import React from "react";
import { Button } from "@/components/ui/button";

type User = {
  id: string;
  email: string;
  user_name: string | null;
};

type Props = {
  users: User[];
  assignTo: string;
  setAssignTo: (id: string) => void;
  handleAssign: () => void;
  disabled: boolean;
  loading: boolean;
};

const TaskDetailsAssign: React.FC<Props> = ({
  users,
  assignTo,
  setAssignTo,
  handleAssign,
  disabled,
  loading
}) => (
  <div className="border-t pt-4 mt-6">
    <label className="block font-bold mb-1">Assign To</label>
    <div className="flex gap-2 items-center">
      <select
        className="w-full border rounded p-2"
        value={assignTo}
        onChange={e => setAssignTo(e.target.value)}
      >
        <option value="">Unassigned</option>
        {users?.map(u => (
          <option key={u.id} value={u.id}>
            {u.user_name || u.email}
          </option>
        ))}
      </select>
      <Button
        type="button"
        onClick={handleAssign}
        disabled={disabled}
      >
        {loading ? "Assigning..." : "Assign"}
      </Button>
    </div>
  </div>
);

export default TaskDetailsAssign;
