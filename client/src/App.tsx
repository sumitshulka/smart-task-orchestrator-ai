
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RolePermissions from "./pages/RolePermissions";
import AuthPage from "@/pages/Auth";
import AdminLayout from "@/layouts/AdminLayout";
import AdminUsers from "@/pages/AdminUsers";
import AdminTeams from "@/pages/AdminTeams";
import AdminSettings from "./pages/AdminSettings";
import TasksPage from "./pages/Tasks";
import MyTasksPage from "./pages/MyTasks";
import HistoricalTasks from "./pages/HistoricalTasks";
import AdminDashboard from "./pages/AdminDashboardSimple";
import TaskReport from "@/pages/TaskReportSimple";
import AnalyticsReport from "@/pages/AnalyticsReportSimple";
import TaskOverdueReport from "@/pages/TaskOverdueReportSimple";
import TaskGroupsPage from "./pages/TaskGroups";
import MyTeams from "./pages/MyTeams";
import { RoleProvider } from "@/contexts/RoleProvider";
import { AuthProvider } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
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
              path="/admin/role-permissions"
              element={
                <AdminLayout>
                  <RolePermissions />
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
              path="/admin/reports/overdue"
              element={
                <AdminLayout>
                  <TaskOverdueReport />
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
            {/* Tasks page for regular users */}
            <Route
              path="/tasks"
              element={
                <AdminLayout>
                  <TasksPage />
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
      </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
