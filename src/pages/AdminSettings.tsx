
import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DepartmentsManager from "@/components/settings/DepartmentsManager";
import OfficeLocationsManager from "@/components/settings/OfficeLocationsManager";
import StatusManager from "@/components/settings/StatusManager";

// Added styles for top/left alignment and consistent card offset
const AdminSettings: React.FC = () => {
  const [tab, setTab] = useState("departments");

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h2 className="text-2xl font-semibold mb-8">Settings</h2>
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left-aligned, top-aligned tab list, fixed width */}
        <Tabs value={tab} onValueChange={setTab} className="flex-1 w-full">
          <div className="flex flex-row gap-0">
            <TabsList
              className="flex flex-col min-w-[210px] gap-1 bg-transparent p-0 items-stretch"
              style={{ alignSelf: "flex-start" }}
            >
              <TabsTrigger
                value="departments"
                className="justify-start w-full text-left px-4 py-2"
              >
                Departments
              </TabsTrigger>
              <TabsTrigger
                value="office-locations"
                className="justify-start w-full text-left px-4 py-2"
              >
                Office Locations
              </TabsTrigger>
              <TabsTrigger
                value="statuses"
                className="justify-start w-full text-left px-4 py-2"
              >
                Task Statuses
              </TabsTrigger>
            </TabsList>
            {/* Tab content area: Card always aligns with tab list/heading */}
            <div className="flex-1 min-w-0 pl-0 md:pl-8">
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

