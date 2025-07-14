
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import StatusLifecycleGraph from "./StatusLifecycleGraph";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider";

type TaskStatus = {
  id: string;
  name: string;
  description: string | null;
  sequence_order: number;
};

const ItemType = "STATUS_ROW";

const DraggableRow = ({ status, index, moveRow, children }: any) => {
  const [, ref] = useDrag({ type: ItemType, item: { index } });
  const [, drop] = useDrop({
    accept: ItemType,
    hover: (dragged: any) => {
      if (dragged.index !== index) moveRow(dragged.index, index);
    },
  });
  return (
    <tr ref={(node) => ref(drop(node))}>{children}</tr>
  );
};

const StatusManager: React.FC = () => {
  const { statuses, loading, setStatuses } = useTaskStatuses();
  const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
  const [newStatus, setNewStatus] = useState({ name: "", description: "" });
  const [inputStatus, setInputStatus] = useState<{ [id: string]: { name: string; description: string } }>({});
  const { highestRole } = useRole();

  // Reordering
  const moveRow = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...statuses];
    const [removed] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, removed);
    setStatuses(updated);

    // For now, just update the local state
    // In a real implementation, this would save to the database
    console.log("Status order updated:", updated.map(s => s.name));
  };

  const handleAddStatus = async () => {
    if (!newStatus.name.trim()) return;
    const maxOrder = Math.max(0, ...statuses.map((s) => s.sequence_order));
    
    const newStatusData = {
      id: Date.now().toString(),
      name: newStatus.name,
      description: newStatus.description,
      sequence_order: maxOrder + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // For now, just add to local state
    // In a real implementation, this would save to the database
    setStatuses([...statuses, newStatusData]);
    setNewStatus({ name: "", description: "" });
    toast({ title: "Status added" });
  };

  const handleEditStatus = (id: string) => {
    setEditing({ ...editing, [id]: true });
    const st = statuses.find((s) => s.id === id);
    if (st) setInputStatus({ ...inputStatus, [id]: { name: st.name, description: st.description || "" } });
  };

  const handleSaveStatus = async (id: string) => {
    const upd = inputStatus[id];
    if (!upd || !upd.name.trim()) return;
    const { data, error } = await supabase
      .from("task_statuses")
      .update({ name: upd.name, description: upd.description })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }
    setStatuses(
      statuses.map((s) =>
        s.id === id ? { ...s, name: data.name, description: data.description } : s
      )
    );
    setEditing({ ...editing, [id]: false });
    toast({ title: "Status updated" });
  };

  const handleDeleteStatus = async (id: string) => {
    if (!window.confirm("Delete this status?")) return;
    const { error } = await supabase.from("task_statuses").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }
    setStatuses(statuses.filter((s) => s.id !== id));
    toast({ title: "Status deleted" });
  };

  return (
    <div className="w-full space-y-6">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Task Statuses</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          <div className="w-full border rounded bg-background shadow-sm">
            <DndProvider backend={HTML5Backend}>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="w-12 p-2 font-semibold text-black">#</th>
                      <th className="w-1/6 p-2 font-semibold text-black">Status Name</th>
                      <th className="w-1/2 p-2 font-semibold text-black">Description</th>
                      <th className="w-1/4 p-2 text-center font-semibold text-black">
                        {highestRole === "admin" ? "Actions" : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statuses.map((status, idx) => (
                      <DraggableRow key={status.id} index={idx} moveRow={highestRole === "admin" ? moveRow : () => {}} status={status}>
                        <td className="p-2 cursor-move">{idx + 1}</td>
                        <td className="p-2">
                          {editing[status.id] && highestRole === "admin" ? (
                            <Input
                              value={inputStatus[status.id].name}
                              onChange={(e) =>
                                setInputStatus((cur) => ({
                                  ...cur,
                                  [status.id]: { ...cur[status.id], name: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            status.name
                          )}
                        </td>
                        <td className="p-2">
                          {editing[status.id] && highestRole === "admin" ? (
                            <Input
                              value={inputStatus[status.id].description}
                              onChange={(e) =>
                                setInputStatus((cur) => ({
                                  ...cur,
                                  [status.id]: { ...cur[status.id], description: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            status.description
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-2">
                            {editing[status.id] && highestRole === "admin" ? (
                              <Button size="sm" variant="default" onClick={() => handleSaveStatus(status.id)}>Save</Button>
                            ) : highestRole === "admin" ? (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleEditStatus(status.id)}>
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteStatus(status.id)}>
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </DraggableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </DndProvider>
          </div>
        </CardContent>
      </Card>

      {highestRole === "admin" && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Add New Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status Name</label>
                <Input
                  placeholder="Enter status name"
                  value={newStatus.name}
                  onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Input
                  placeholder="Enter description"
                  value={newStatus.description}
                  onChange={(e) => setNewStatus({ ...newStatus, description: e.target.value })}
                />
              </div>
              <Button onClick={handleAddStatus} variant="default" className="w-full sm:w-auto">
                Add Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="w-full">
        <StatusLifecycleGraph statuses={statuses} />
      </div>
    </div>
  );
};

export default StatusManager;
