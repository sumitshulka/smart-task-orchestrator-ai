# TaskRep - Smart Task Management System

## Overview

TaskRep is a comprehensive task management application designed to enhance team collaboration and productivity. It features a React frontend and an Express.js backend, offering role-based access control, task creation, assignment, tracking, and reporting. The system supports hierarchical user management, detailed analytics, and aims to be a powerful business intelligence tool for organizations of various sizes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **UI Library**: Shadcn/UI (built on Radix UI)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (server state), React hooks (local state)
- **Routing**: React Router
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js
- **Database ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon serverless)
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Supabase Auth integration

### UI/UX Decisions
- Modern login page redesign with gradient background and glass morphism effects.
- Responsive design with mobile-first approach.
- Dark/Light mode theme switching.
- Consistent design system using Shadcn/UI components.
- Customizable task status colors and dynamic Kanban board styling.
- Enhanced task details modal with sectioned layout and integrated edit functionality.

### Technical Implementations
- **Role-Based Access Control (RBAC)**: Comprehensive system with role visibility scopes (User, Manager, Team, Organization) and menu-level permissions (View, Update, Create, Delete). Enforced single role per user.
- **Task Management**: CRUD operations, configurable status workflows, hierarchical assignment, task dependencies, task groups, and detailed activity logging. Implemented 5-digit task numbering (starting 11001).
- **Benchmarking & Analytics**: Advanced query processing with NLP-like capabilities for numerical filtering, percentage-based comparisons, team performance analysis, and workload distribution. User-level benchmarking overrides.
- **User Management**: Admin-only first-time super admin registration, user creation/activation limits based on license, and role-based visibility filtering for managers.
- **License Management**: Comprehensive system with external server integration, encrypted data storage, user limits enforcement, and secure API for acquisition and validation.
- **Performance Optimization**: Extensive database indexing, React Query caching, role-based authentication caching (1-minute TTL), and optimized API response times.
- **Security**: Fixed critical RBAC, benchmarking, and task group security vulnerabilities by enforcing proper role-based visibility filtering across the application.
- **Workflow Automation**: Database-migrated status transitions with proper validation rules (forward progression, limited rework, no reopening completed tasks).
- **Pagination & Sorting**: Enhanced pagination display with task count and page size selector; comprehensive sorting functionality for tasks (Priority, Due Date, Effort, Status, Created Date).
- **Notifications & Timers**: Real-time active timer updates and configurable daily hour limits with validation.
- **Project Management (Step 1)**: Feature toggle in General Settings (off by default). When enabled, shows "Project Templates" tab in settings and "Project Management" section in sidebar. Admin can create templates per project type (Fixed Cost, Time & Material, Milestone-Based, Retainer), each with customizable ordered stages. Default stages auto-populate per type. Full CRUD for templates and stages. Constraint: project type cannot be changed after template creation.
- **Project Management (Step 2)**: Full project lifecycle management. Projects list page with create/edit modal, template-driven fields, and status badges. Project detail page with 4 tabs: Overview, Members (with allocation % and history), Milestones (with collapsible stage panels and template stage inheritance), Features (feature groups and features with auto-tracking numbers FG-001/F-001). Confirm-project flow locks the template and activates the project. Tasks can be linked to a project milestone and feature at creation time (via "Link to Project" section in task create form) and edited later (via "Project Linkage" section in task details sheet, visible to managers/admins). Database tables: projects, project_members, project_member_history, project_milestones, milestone_stages, project_feature_groups, project_features; plus milestone_id/feature_id columns on tasks.

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting.
- **Supabase**: Authentication (Supabase Auth).

### UI/UX Libraries
- **Radix UI**: Accessible component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **Date-fns**: Date manipulation utilities.
- **Recharts**: Chart and visualization library.

### Development Tools
- **TypeScript**: For type safety.
- **Vite**: Fast development and build tooling.
- **ESBuild**: Fast JavaScript bundling.
- **Drizzle Kit**: Database migration and introspection tools.