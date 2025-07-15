# TaskRep - Smart Task Management System

## Overview

TaskRep is a comprehensive task management application built with a React frontend and Express.js backend. The application provides role-based access control with features for task creation, assignment, tracking, and reporting. It's designed to handle team collaboration with hierarchical user management and detailed analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 14, 2025)

✓ **Comprehensive RBAC System Implemented**: Built complete role-based access control with visibility scopes at role level
✓ **Role Visibility Scopes**: Added visibility_scope field to roles table supporting User, Manager, Team, Organization levels  
✓ **Menu-Level Permissions**: Individual menu permissions control action levels (View, Update, Create, Delete) independently
✓ **Modern Roles & Privileges UI**: Created comprehensive management interface replacing basic roles page
✓ **Database Schema Updates**: Added visibility_scope to roles, removed from role_permissions table
✓ **Admin Default Setup**: Configured admin role with organization-wide visibility and full permissions
✓ **Enhanced UI/UX**: Improved badge display with icons and better text handling for long permission names
✓ **Menu Cleanup**: Removed redundant "Roles & Access" menu, keeping comprehensive "Roles & Privileges"
✓ **Kanban Visual Enhancement**: Added elegant vertical gradient dividers between status columns for better visual separation
✓ **Major Performance Optimization**: Implemented 50+ comprehensive database indexes and React Query caching to eliminate redundant API calls
✓ **Tasks Page Infinite Loop Fix**: Resolved critical infinite render issue by implementing proper React Query integration with stable query keys
✓ **Status-Matched Card Colors**: Implemented dynamic card background colors that match their status column headers for better visual cohesion
✓ **UUID Display Fix**: Replaced UUID display in assigned_to fields with actual user names using proper name resolution hooks
✓ **Organization Date Format**: Created General Settings tab with configurable date formats and implemented formatOrgDate utility for consistent date display
✓ **Office Location Error Fix**: Fixed Supabase runtime errors by migrating OfficeLocationsManager to use localStorage instead of deprecated Supabase client
✓ **Task Status Transitions Fix**: Resolved Supabase runtime errors in status transitions by updating StatusManager and StatusLifecycleGraph components
✓ **Deprecated Client Migration**: Systematically replaced remaining Supabase client calls with API client or localStorage solutions to eliminate runtime errors
✓ **Reports System Overhaul**: Created simple, stable report components to fix navigation breaking issue after accessing reports
✓ **Dashboard Infinite Loop Fix**: Replaced complex AdminDashboard with simplified version using proper React Query hooks to eliminate API call loops
✓ **Consistent Filter UI Implementation**: Updated Tasks and Historical Tasks pages with Task Groups-style expandable filter interface for consistent user experience
✓ **Enhanced Search Functionality**: Added search bars with proper icons and improved filter organization across all task management pages
✓ **Status Color Management**: Implemented pastel color selection for task statuses with visual color picker in StatusManager
✓ **Dynamic Kanban Colors**: Updated My Tasks Kanban board to use selected status colors for column headers and backgrounds
✓ **Database Schema Enhancement**: Added color field to task_statuses table with default gray color support
✓ **Create Task Modal Width Enhancement**: Set modal to half viewport width (w-[50vw] with min-width 800px) for optimal form layout and user experience
✓ **Enhanced Task Dependency Search**: Replaced separate modal with rich inline search showing task details, status badges, priority levels, assigned users, due dates, and multi-field search capability
✓ **Hierarchical Status Transition Layout**: Redesigned Status Lifecycle Graph with proper hierarchical layout where From-statuses appear in left column(s) and To-statuses in right column(s), eliminating visual overlaps
✓ **Default Status Management**: Implemented comprehensive default status system with database constraints ensuring only one default status, automatic selection in task creation, and proper UI indicators
✓ **Create Task Modal Typography Enhancement**: Reduced heading fonts from text-xl to text-base and section spacing for consistency with system-wide typography standards
✓ **Required Field Indicators**: Added red asterisks (*) to mandatory fields (Estimated Hours, Start Date, End Date) in Create Task modal for clear visual guidance
✓ **5-Digit Task Numbering System**: Implemented readable task IDs starting from 11001 instead of 1 - all tasks now display as #11001, #11002, etc.
✓ **Clickable Task Titles**: Added click functionality to task titles that opens full task details view with enhanced user experience
✓ **Universal Task Details Modal**: Implemented TaskDetailsSheet functionality across all task pages (My Tasks, All Tasks, Kanban view) with consistent click-to-view behavior
✓ **Component Architecture Enhancement**: Updated TasksList and KanbanTaskCard components to support onOpenDetails callback for unified task interaction
✓ **Modern TaskDetailsSheet Redesign**: Completely redesigned task details modal to match CreateTaskSheet's modern sectioned layout with proper user name display instead of UUIDs
✓ **Enhanced User Experience**: TaskDetailsSheet now features 5 clearly organized sections with colored backgrounds, proper date formatting, priority badges, and integrated edit functionality
✓ **Dynamic Status-Based Task Deletion**: Implemented configurable deletion permissions per status with database-driven logic replacing hardcoded values
✓ **StatusManager Enhancement**: Added can_delete configuration checkboxes for administrators to control which statuses allow task deletion
✓ **Optimistic Status Reordering**: Enhanced table drag-and-drop with immediate visual feedback and background persistence to database
✓ **Status Lifecycle Position Persistence**: Added localStorage saving for draggable status graph with unsaved changes indicator and finalize button
✓ **Comprehensive Status Deletion Workflow**: Implemented advanced status deletion system with task impact preview, transition cleanup, and configurable task handling (delete or reassign to another status)
✓ **StatusDeletionDialog Component**: Created sophisticated dialog showing task count, available reassignment options, transition warnings, and confirmation workflow
✓ **Enhanced Backend Status Management**: Added deletion preview API, task handling logic, and automatic activity logging for status changes
✓ **Application Stability Fix**: Resolved compilation errors in status deletion workflow by fixing IIFE syntax issues and authentication header implementation
✓ **Server Verification**: Confirmed application is running correctly on port 5000 with full API functionality and database connectivity
✓ **Transition-Based Kanban Ordering**: Implemented workflow-aware column ordering in Kanban board where default status appears first, followed by statuses in transition sequence order, with alphabetical sorting for merging statuses

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **UI Library**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: React Router for client-side navigation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Supabase Auth integration

### Database Schema
The application uses PostgreSQL with the following key entities:
- **Users**: Core user management with roles and team assignments
- **Tasks**: Task entities with status tracking, priorities, and assignments
- **Teams**: Team organization with hierarchical management
- **Roles**: Role-based access control system
- **Task Activities**: Audit trail for task changes
- **Task Groups**: Collection organization for tasks

## Key Components

### Authentication & Authorization
- **Provider**: Supabase Auth for user authentication
- **Role System**: Multi-level role hierarchy (admin, manager, team_manager, user)
- **Context**: RoleProvider for global role state management
- **Session Management**: Persistent sessions with automatic token refresh

### Task Management
- **CRUD Operations**: Full task lifecycle management
- **Status Workflow**: Configurable task statuses with transitions
- **Assignment System**: Hierarchical task assignment based on roles
- **Dependencies**: Task dependency tracking and validation
- **Groups**: Task collection organization
- **Activity Logging**: Complete audit trail for task changes

### User Interface
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Dark/Light Mode**: Theme switching capability
- **Component Library**: Consistent design system with Shadcn/UI
- **Sidebar Navigation**: Collapsible sidebar with role-based menu items
- **Data Tables**: Sortable, filterable tables with pagination

### Reporting & Analytics
- **Dashboard**: Executive summary with KPIs and charts
- **Reports**: Detailed task reports with filtering and exports
- **Analytics**: Performance metrics and trend analysis
- **Charts**: Integration with Recharts for data visualization

## Data Flow

### Task Workflow
1. **Creation**: Users create tasks with title, description, priority, and due dates
2. **Assignment**: Tasks assigned to team members based on role hierarchy
3. **Status Updates**: Tasks progress through configurable status workflow
4. **Activity Tracking**: All changes logged to task_activity table
5. **Completion**: Tasks marked complete with actual completion dates

### User Management Flow
1. **Registration**: Admin creates users with basic information
2. **Role Assignment**: Users assigned roles determining access levels
3. **Team Assignment**: Users added to teams for collaboration
4. **Profile Management**: Users can update their own profile information

### Data Persistence
- **Primary Storage**: PostgreSQL database via Drizzle ORM
- **Session Storage**: PostgreSQL-backed session store
- **File Storage**: Potential integration with cloud storage (not implemented)

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting
- **Supabase**: Authentication and real-time features
- **Vercel/Railway**: Deployment platform options

### UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Date-fns**: Date manipulation utilities
- **Recharts**: Chart and visualization library

### Development Tools
- **TypeScript**: Type safety and developer experience
- **Vite**: Fast development and build tooling
- **ESBuild**: Fast JavaScript bundling
- **Drizzle Kit**: Database migration and introspection tools

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite dev server for frontend with HMR
- **Backend**: tsx for TypeScript execution in development
- **Database**: Neon serverless PostgreSQL
- **Environment**: NODE_ENV=development

### Production Deployment
- **Build Process**: 
  1. Frontend built with Vite to `dist/public`
  2. Backend bundled with ESBuild to `dist/index.js`
- **Static Serving**: Express serves built frontend assets
- **Database Migrations**: Drizzle Kit push for schema updates
- **Environment**: NODE_ENV=production

### Configuration Management
- **Environment Variables**: DATABASE_URL for database connection
- **Build Scripts**: Separate build commands for frontend and backend
- **Start Command**: Single node command to run production server

### Scalability Considerations
- **Database**: Serverless PostgreSQL scales automatically
- **Frontend**: Static assets can be CDN-distributed
- **Backend**: Stateless Express server for horizontal scaling
- **Sessions**: Database-backed sessions for multi-instance deployment

The application follows a modern full-stack architecture with emphasis on type safety, developer experience, and scalable deployment patterns. The role-based access control and comprehensive task management features make it suitable for organizations of various sizes.