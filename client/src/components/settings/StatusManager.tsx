
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import StatusLifecycleGraphDraggable from "./StatusLifecycleGraphDraggable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRole } from "@/contexts/RoleProvider";

type TaskStatus = {
  id: string;
  name: string;
  description: string | null;
  sequence_order: number;
  is_default: boolean;
  can_delete: boolean;
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

// Predefined pastel colors for status selection
const PASTEL_COLORS = [
  { name: "Gray", value: "#6b7280", bg: "bg-gray-100", text: "text-gray-700" },
  { name: "Blue", value: "#3b82f6", bg: "bg-blue-100", text: "text-blue-700" },
  { name: "Green", value: "#10b981", bg: "bg-green-100", text: "text-green-700" },
  { name: "Orange", value: "#f59e0b", bg: "bg-orange-100", text: "text-orange-700" },
  { name: "Purple", value: "#8b5cf6", bg: "bg-purple-100", text: "text-purple-700" },
  { name: "Pink", value: "#ec4899", bg: "bg-pink-100", text: "text-pink-700" },
  { name: "Indigo", value: "#6366f1", bg: "bg-indigo-100", text: "text-indigo-700" },
  { name: "Teal", value: "#14b8a6", bg: "bg-teal-100", text: "text-teal-700" },
  { name: "Red", value: "#ef4444", bg: "bg-red-100", text: "text-red-700" },
  { name: "Yellow", value: "#eab308", bg: "bg-yellow-100", text: "text-yellow-700" },
];

const ColorPicker: React.FC<{ 
  selectedColor: string; 
  onColorChange: (color: string) => void;
  className?: string;
}> = ({ selectedColor, onColorChange, className = "" }) => {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {PASTEL_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onColorChange(color.value)}
          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
            selectedColor === color.value 
              ? 'border-gray-800 ring-2 ring-gray-300' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{ backgroundColor: color.value }}
          title={color.name}
        />
      ))}
    </div>
  );
};

const StatusManager: React.FC = () => {
  const { statuses, loading, refreshStatuses } = useTaskStatuses();
  const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
  const [newStatus, setNewStatus] = useState({ name: "", description: "", color: "#6b7280", is_default: false, can_delete: true });
  const [inputStatus, setInputStatus] = useState<{ [id: string]: { name: string; description: string; color: string; is_default: boolean; can_delete: boolean } }>({});
  const { highestRole } = useRole();

  // Reordering with optimistic updates
  const [localStatuses, setLocalStatuses] = useState(statuses);
  
  // Update local statuses when API data changes
  useEffect(() => {
    setLocalStatuses(statuses);
  }, [statuses]);

  const moveRow = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    
    // Optimistic update - show change immediately
    const updated = [...localStatuses];
    const [removed] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, removed);
    
    // Update sequence order based on new positions
    const updatedWithOrder = updated.map((status, index) => ({
      ...status,
      sequence_order: index + 1
    }));

    setLocalStatuses(updatedWithOrder);
    toast({ title: "Saving new status order..." });

    // Update all statuses with new sequence order in background
    Promise.all(
      updatedWithOrder.map(status => 
        apiClient.updateTaskStatus(status.id, { sequence_order: status.sequence_order })
      )
    ).then(() => {
      refreshStatuses(); // This will sync with server
      toast({ title: "Status order saved successfully!" });
      console.log("Status order updated:", updatedWithOrder.map(s => s.name));
    }).catch(error => {
      toast({ title: "Error", description: "Failed to update status order. Reverting changes." });
      setLocalStatuses(statuses); // Revert on error
    });
  };

  const handleAddStatus = async () => {
    if (!newStatus.name.trim()) return;
    const maxOrder = Math.max(0, ...statuses.map((s) => s.sequence_order));
    
    try {
      await apiClient.createTaskStatus({
        name: newStatus.name,
        description: newStatus.description,
        color: newStatus.color,
        sequence_order: maxOrder + 1,
        is_default: newStatus.is_default,
        can_delete: newStatus.can_delete,
      });
      
      setNewStatus({ name: "", description: "", color: "#6b7280", is_default: false, can_delete: true });
      refreshStatuses(); // Refresh from API
      toast({ title: "Status added successfully!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add status" });
    }
  };

  const handleEditStatus = (id: string) => {
    setEditing({ ...editing, [id]: true });
    const st = statuses.find((s) => s.id === id);
    if (st) setInputStatus({ ...inputStatus, [id]: { name: st.name, description: st.description || "", color: st.color || "#6b7280", is_default: st.is_default || false, can_delete: st.can_delete || true } });
  };

  const handleSaveStatus = async (id: string) => {
    const upd = inputStatus[id];
    if (!upd || !upd.name.trim()) return;
    
    try {
      await apiClient.updateTaskStatus(id, {
        name: upd.name,
        description: upd.description || "",
        color: upd.color || "#6b7280",
        is_default: upd.is_default,
        can_delete: upd.can_delete
      });
      
      setEditing({ ...editing, [id]: false });
      refreshStatuses(); // Refresh from API
      toast({ title: "Status updated successfully!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status" });
    }
  };

  const handleDeleteStatus = async (id: string) => {
    if (!window.confirm("Delete this status?")) return;
    
    try {
      await apiClient.deleteTaskStatus(id);
      refreshStatuses(); // Refresh from API
      toast({ title: "Status deleted successfully!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete status" });
    }
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
                      <th className="w-1/4 p-2 font-semibold text-black">Description</th>
                      <th className="w-20 p-2 font-semibold text-black">Color</th>
                      <th className="w-20 p-2 text-center font-semibold text-black">Default</th>
                      <th className="w-20 p-2 text-center font-semibold text-black">Allow Delete</th>
                      <th className="w-1/4 p-2 text-center font-semibold text-black">
                        {highestRole === "admin" ? "Actions" : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {localStatuses.map((status, idx) => (
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
                          {editing[status.id] && highestRole === "admin" ? (
                            <ColorPicker
                              selectedColor={inputStatus[status.id]?.color || status.color || "#6b7280"}
                              onColorChange={(color) =>
                                setInputStatus((cur) => ({
                                  ...cur,
                                  [status.id]: { ...cur[status.id], color },
                                }))
                              }
                              className="justify-start"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-6 h-6 rounded-full border border-gray-300"
                                style={{ backgroundColor: status.color || "#6b7280" }}
                              />
                              <span className="text-xs text-gray-500">{status.color || "#6b7280"}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {editing[status.id] && highestRole === "admin" ? (
                            <input
                              type="checkbox"
                              checked={inputStatus[status.id]?.is_default || false}
                              onChange={(e) =>
                                setInputStatus((cur) => ({
                                  ...cur,
                                  [status.id]: { ...cur[status.id], is_default: e.target.checked },
                                }))
                              }
                              className="w-4 h-4"
                            />
                          ) : (
                            <span className={`text-sm font-semibold ${status.is_default ? 'text-green-600' : 'text-gray-400'}`}>
                              {status.is_default ? '✓ Default' : ''}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {editing[status.id] && highestRole === "admin" ? (
                            <input
                              type="checkbox"
                              checked={inputStatus[status.id]?.can_delete !== false}
                              onChange={(e) =>
                                setInputStatus((cur) => ({
                                  ...cur,
                                  [status.id]: { ...cur[status.id], can_delete: e.target.checked },
                                }))
                              }
                              className="w-4 h-4"
                            />
                          ) : (
                            <span className={`text-sm font-semibold ${status.can_delete ? 'text-green-600' : 'text-red-600'}`}>
                              {status.can_delete ? '✓ Allow' : '✗ Block'}
                            </span>
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
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <ColorPicker
                  selectedColor={newStatus.color}
                  onColorChange={(color) => setNewStatus({ ...newStatus, color })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="default-status"
                  checked={newStatus.is_default}
                  onChange={(e) => setNewStatus({ ...newStatus, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="default-status" className="text-sm font-medium">
                  Set as Default Status (for new tasks)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="can-delete"
                  checked={newStatus.can_delete}
                  onChange={(e) => setNewStatus({ ...newStatus, can_delete: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="can-delete" className="text-sm font-medium">
                  Allow task deletion for this status
                </label>
              </div>
              <Button onClick={handleAddStatus} variant="default" className="w-full sm:w-auto">
                Add Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="w-full">
        <StatusLifecycleGraphDraggable statuses={statuses} />
      </div>
    </div>
  );
};

export default StatusManager;
