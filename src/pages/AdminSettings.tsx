
import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DepartmentsManager from "@/components/settings/DepartmentsManager";

const AdminSettings: React.FC = () => {
  const [tab, setTab] = useState("departments");

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          {/* Add more tabs here as needed */}
        </TabsList>
        <TabsContent value="departments">
          <DepartmentsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
