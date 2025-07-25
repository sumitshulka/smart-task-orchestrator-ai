
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RolePermissions from "./pages/RolePermissions";
import AuthPage from "@/pages/Auth";
import AdminLayout from "@/layouts/AdminLayout";
import AdminUsers from "@/pages/AdminUsers";
import AdminTeams from "@/pages/AdminTeams";
import DeletedUsers from "@/pages/DeletedUsers";
import AdminSettings from "./pages/AdminSettings";
import TasksPage from "./pages/Tasks";
import MyTasksPage from "./pages/MyTasks";
import HistoricalTasks from "./pages/HistoricalTasks";
import AdminDashboard from "./pages/AdminDashboardSimple";
import TaskReport from "@/pages/TaskReportSimple";
import AnalyticsReport from "@/pages/AnalyticsReportSimple";
import TaskOverdueReport from "@/pages/TaskOverdueReportAdvanced";
import TaskGroupsPage from "./pages/TaskGroups";
import MyTeams from "./pages/MyTeams";
import Benchmarking from "./pages/Benchmarking";
import BenchmarkingReport from "./pages/BenchmarkingReport";
import { RoleProvider } from "@/contexts/RoleProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/queryClient";
import HelpPage from "@/pages/HelpPage";

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
              path="/admin/deleted-users"
              element={
                <AdminLayout>
                  <DeletedUsers />
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
            <Route
              path="/admin/reports/benchmarking"
              element={
                <AdminLayout>
                  <BenchmarkingReport />
                </AdminLayout>
              }
            />
            {/* Admin Benchmarking route */}
            <Route
              path="/admin/benchmarking"
              element={
                <AdminLayout>
                  <Benchmarking />
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
            {/* Benchmarking page for users */}
            <Route
              path="/benchmarking"
              element={
                <AdminLayout>
                  <Benchmarking />
                </AdminLayout>
              }
            />
            {/* Help page route */}
            <Route
              path="/help"
              element={
                <AdminLayout>
                  <HelpPage />
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
