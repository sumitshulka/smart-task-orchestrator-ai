import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminRolesPage from "./pages/AdminRoles";
import AuthPage from "@/pages/Auth";
import AdminLayout from "@/layouts/AdminLayout";
import AdminUsers from "@/pages/AdminUsers";
import AdminTeams from "@/pages/AdminTeams";
import AdminSettings from "./pages/AdminSettings";
import TasksPage from "./pages/Tasks";
import MyTasksPage from "./pages/MyTasks";
import HistoricalTasks from "./pages/HistoricalTasks";
import AdminDashboard from "./pages/AdminDashboard";
import TaskReport from "@/pages/TaskReport";
import AnalyticsReport from "@/pages/AnalyticsReport";
import TaskGroupsPage from "./pages/TaskGroups";
import MyTeams from "./pages/MyTeams";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Make / route go to Dashboard, not User Management */}
          <Route
            path="/"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/admin/users"
            element={
              <AdminLayout>
                <AdminUsers />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/teams"
            element={
              <AdminLayout>
                <AdminTeams />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <AdminLayout>
                <AdminRolesPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminLayout>
                <AdminSettings />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/tasks"
            element={
              <AdminLayout>
                <TasksPage />
              </AdminLayout>
            }
          />
          {/* Task Groups route */}
          <Route
            path="/admin/task-groups"
            element={
              <AdminLayout>
                <TaskGroupsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/my-tasks"
            element={
              <AdminLayout>
                <MyTasksPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/historical-tasks"
            element={
              <AdminLayout>
                <HistoricalTasks />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/reports/task"
            element={
              <AdminLayout>
                <TaskReport />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/reports/analytics"
            element={
              <AdminLayout>
                <AnalyticsReport />
              </AdminLayout>
            }
          />
          {/* My Teams page for plain users */}
          <Route
            path="/my-teams"
            element={
              <AdminLayout>
                <MyTeams />
              </AdminLayout>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
