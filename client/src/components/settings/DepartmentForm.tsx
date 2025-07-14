
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DepartmentFormProps {
  initialValues?: { name: string; description?: string };
  onSubmit: (values: { name: string; description?: string }) => void;
  onCancel: () => void;
}

const DepartmentForm: React.FC<DepartmentFormProps> = ({ initialValues, onSubmit, onCancel }) => {
  const [values, setValues] = useState({
    name: initialValues?.name || "",
    description: initialValues?.description || "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onSubmit(values);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          placeholder="Name"
          name="name"
          required
          value={values.name}
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <textarea
          placeholder="Description"
          name="description"
          className="w-full border rounded px-3 py-2 text-sm resize-none min-h-[60px]"
          value={values.description}
          onChange={handleChange}
          disabled={loading}
        />
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

export default DepartmentForm;
