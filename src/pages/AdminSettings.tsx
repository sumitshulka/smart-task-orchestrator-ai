
import React, { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import DepartmentsManager from "@/components/settings/DepartmentsManager";
import OfficeLocationsManager from "@/components/settings/OfficeLocationsManager";
import StatusManager from "@/components/settings/StatusManager";

const AdminSettings: React.FC = () => {
  const [tab, setTab] = useState("departments");

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full flex flex-row bg-background border rounded-md mb-6 p-0 gap-2">
          <TabsTrigger
            value="departments"
            className="flex-1 px-4 py-3 text-left justify-start"
          >
            Departments
          </TabsTrigger>
          <TabsTrigger
            value="office-locations"
            className="flex-1 px-4 py-3 text-left justify-start"
          >
            Office Locations
          </TabsTrigger>
          <TabsTrigger
            value="statuses"
            className="flex-1 px-4 py-3 text-left justify-start"
          >
            Task Statuses
          </TabsTrigger>
        </TabsList>
        <TabsContent value="departments">
          <DepartmentsManager />
        </TabsContent>
        <TabsContent value="office-locations">
          <OfficeLocationsManager />
        </TabsContent>
        <TabsContent value="statuses">
          <StatusManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
