
import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DepartmentsManager from "@/components/settings/DepartmentsManager";
import OfficeLocationsManager from "@/components/settings/OfficeLocationsManager";
import StatusManager from "@/components/settings/StatusManager";

const AdminSettings: React.FC = () => {
  const [tab, setTab] = useState("departments");

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h2 className="text-2xl font-semibold mb-8">Settings</h2>
      <div className="flex flex-col md:flex-row gap-6">
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            {/* Left-aligned, top-aligned tab list */}
            <TabsList
              className="md:flex md:flex-col md:min-w-[200px] md:items-start md:h-auto !justify-start p-0 gap-1"
              style={{ alignSelf: "flex-start" }}
            >
              <TabsTrigger value="departments" className="w-full md:text-left justify-start">
                Departments
              </TabsTrigger>
              <TabsTrigger value="office-locations" className="w-full md:text-left justify-start">
                Office Locations
              </TabsTrigger>
              <TabsTrigger value="statuses" className="w-full md:text-left justify-start">
                Task Statuses
              </TabsTrigger>
            </TabsList>
            {/* Tab content area */}
            <div className="flex-1 min-w-0">
              <TabsContent value="departments">
                <DepartmentsManager />
              </TabsContent>
              <TabsContent value="office-locations">
                <OfficeLocationsManager />
              </TabsContent>
              <TabsContent value="statuses">
                <StatusManager />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminSettings;

