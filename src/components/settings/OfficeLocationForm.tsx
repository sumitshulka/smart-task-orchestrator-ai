
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface OfficeLocationFormProps {
  initialValues?: { location_name: string; address: string; location_manager?: string | null };
  onSubmit: (values: { location_name: string; address: string; location_manager?: string | null }) => void;
  onCancel: () => void;
}

const OfficeLocationForm: React.FC<OfficeLocationFormProps> = ({
  initialValues,
  onSubmit,
  onCancel
}) => {
  const [values, setValues] = useState({
    location_name: initialValues?.location_name || "",
    address: initialValues?.address || "",
    location_manager: initialValues?.location_manager || "",
  });
  const [loading, setLoading] = useState(false);

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
      location_manager: values.location_manager || null,
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
        <Input
          placeholder="Location Manager"
          name="location_manager"
          value={values.location_manager}
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

export default OfficeLocationForm;
