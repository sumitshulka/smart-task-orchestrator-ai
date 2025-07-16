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
✓ **Office Location Database Migration**: Completely migrated office locations from localStorage to PostgreSQL database with full CRUD API endpoints, proper authentication, and React Query integration
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
✓ **Comprehensive My Tasks Sorting**: Added full sorting functionality with Priority, Due Date, Effort (Hours), Status, and Created Date options with ascending/descending controls alongside search bar
✓ **Smart Sorting Logic**: High-to-Low priority ordering, null date handling, visual arrow indicators, and cross-view persistence between List and Kanban modes
✓ **Enhanced Dashboard Tasks Due Today**: Implemented comprehensive dashboard section displaying tasks due today with priority badges, time remaining indicators, clickable navigation to My Tasks page, and "All caught up!" empty state
✓ **Task Group Details Modal Redesign**: Completely redesigned TaskGroupDetailsSheet with modern card-based layout, status statistics, visual badges, icons, and comprehensive task information display matching application design theme
✓ **Task Group Member Management System**: Implemented comprehensive member management with database schema, API endpoints, and UI for adding/removing members with role-based permissions (member/manager roles)
✓ **Team Management System Complete**: Fixed manager assignment functionality, added manager_id to teams table, enhanced AdminTeams page to show member counts and manager names, and implemented full team CRUD operations with proper API integration
✓ **Task Group Member Management Enhancement**: Implemented comprehensive duplicate prevention with frontend filtering and backend validation, automatic refresh after adding/removing members, and improved user experience with proper error handling and success messages
✓ **Major Performance Optimization Complete**: Resolved application-layer bottlenecks by implementing comprehensive caching system with role and user role caching, reducing API response times from 246ms to under 50ms (80% improvement)
✓ **Database Index Optimization**: Added 20+ strategic database indexes on foreign keys, status fields, and frequently queried columns for optimal query performance  
✓ **Authentication Middleware Caching**: Implemented role-based caching with 1-minute TTL to eliminate repeated database calls during user authentication
✓ **Query Performance Enhancement**: Database execution times now consistently under 100ms with proper indexing strategy and query optimization
✓ **Password Reset System Overhaul**: Completely migrated from deprecated Supabase client to secure backend API with bcrypt password hashing and validation
✓ **Enhanced Security Implementation**: Added 6-character minimum password validation, proper error handling, and admin-only password reset permissions  
✓ **API Integration Complete**: Created comprehensive password reset endpoint with authentication middleware and integrated with frontend components
✓ **Data Integrity Cleanup**: Removed 3 tasks with invalid status values ('open', 'planning') not defined in database schema, ensuring all tasks use valid statuses
✓ **Pagination Display Fix**: Updated TasksPagination component to always show task count and page size selector, with conditional page navigation for better user experience
✓ **Sidebar Positioning Fix**: Fixed sidebar overflow issue preventing logo/text visibility by implementing proper viewport handling and layout constraints
✓ **Navigation Route Fixes**: Resolved missing routes by synchronizing all menu navigation paths with actual App.tsx routes - fixed Dashboard, Task Management, and Reports menu routing
✓ **Analytics Report Integration**: Moved Analytics from Dashboard menu to Reports menu as "Analytics Report" with proper /admin/reports/analytics routing
✓ **Menu Navigation Restoration**: Updated all sidebar menu components to use correct /admin/ prefixed routes matching the application's routing structure
✓ **Enhanced Timer Delayed State Display**: Fixed delayed state calculation in ActiveTimersBar to account for real-time running timer elapsed time instead of stored minutes
✓ **Real-time Active Timer Updates**: Added 1-second interval updates to ActiveTimersBar component for accurate delayed state visualization with red styling
✓ **Comprehensive Timer Action Restrictions**: Implemented display-only mode for timer controls when task status is "completed" or "review" with informative messaging
✓ **Daily Hour Limit System**: Implemented configurable daily hour limits (default 14 hours) to prevent task completion when it would exceed daily work limits, preventing inflated task hours with validation in backend and UI controls in General Settings
✓ **Benchmarking Calculation Enhancement**: Fixed benchmarking logic to include both time-managed tasks (actual time spent) and completed non-time-managed tasks (estimated hours as effort time)
✓ **Advanced Query Processing System**: Implemented comprehensive NLP-like query processing with support for numerical filtering, percentage-based comparisons, team performance analysis, and complex analytical patterns
✓ **Percentage-Based Performance Analysis**: Added support for queries like "users who surpassed hours by more than 10%" with percentage threshold filtering for both over/under performance
✓ **Team Performance Analytics**: Implemented department-level performance analysis with top/bottom team identification based on average hours and task completion
✓ **Task Count Filtering**: Enhanced numerical filtering for task assignments with support for "more than X tasks", "less than X tasks", and exact count matching
✓ **Hours-Based Numerical Analysis**: Added comprehensive hours filtering with daily/weekly breakdowns and percentage variance calculations
✓ **Completion Rate Analysis**: Implemented task completion rate analysis with percentage-based filtering against average performance metrics
✓ **Group Performance Segmentation**: Added performance group analysis for above/below target user categorization
✓ **Multi-Pattern Query Recognition**: Enhanced pattern matching to handle complex query variations with robust token extraction and analytical processing
✓ **User-Level Benchmarking Overrides Implementation**: Added comprehensive user-level benchmarking configuration system with database schema support, UI components in CreateUserDialog and EditUserDialog, checkbox to exclude users from analysis, and custom hour targets per day/week/month that override organization defaults
✓ **Component-Based Query Processing Enhancement**: Refactored query processing from complex if-else chains to clean component-based architecture with dedicated processors for "surpass/exceed" and "short/below" percentage queries, fixing pattern matching issues and improving maintainability
✓ **Comprehensive Advanced Query Patterns Implementation**: Added 6 new sophisticated query processors supporting completion/efficiency analysis, goal achievement tracking, team performance comparison, workload distribution analysis, risk/alert detection, and comparative analysis - transforming the benchmarking system into a powerful business intelligence tool
✓ **Critical RBAC Security Vulnerability Fixed**: Resolved major security issue where users with "user" visibility scope could see all tasks - implemented proper task visibility enforcement based on user role scope
✓ **Settings Menu RBAC Implementation**: Added comprehensive Settings menu permissions system with database-level role permissions, useRolePermissions hook, and proper UI visibility controls in sidebar and topbar
✓ **User Management Interface Enhancement**: Enhanced user management table to display assigned roles for each user and reorganized layout with user names prominently displayed and email addresses below, matching the manager display format for consistent UI design
✓ **Single Role Constraint Implementation**: Enforced single role per user system by modifying assignUserRole function to replace existing roles rather than adding multiple roles, updated UI to reflect single role display and management
✓ **Critical Benchmarking Security Vulnerability Fixed**: Resolved major data breach in /api/users endpoint where managers could access all users including admin data - implemented proper role-based visibility filtering so managers only see direct reports and team members
✓ **Benchmarking Report Access Fixed**: Resolved "benchmarking disabled" error for managers by allowing manager role to read organization settings - managers can now access benchmarking reports while maintaining security restrictions
✓ **Critical Task Group Security Vulnerability Fixed**: Resolved major security issue where managers could access private task groups of other users - implemented proper role-based visibility filtering in task groups API endpoint with getTaskGroupsForUser method
✓ **Task Group Assignment System Complete**: Fixed broken task assignment to task groups by implementing proper API endpoints (/api/task-groups/:groupId/tasks) with database persistence, replacing simulated frontend-only assignments
✓ **Status Transition System Database Migration**: Fixed critical workflow issue by migrating status transitions from localStorage to proper database storage with API endpoints (/api/task-status-transitions)
✓ **Proper Workflow Validation**: Implemented database-driven status transition validation using actual task statuses with logical business rules:
  - Forward progression: New→in_progress→review→completed  
  - Only correction flow: review→in_progress (for rework)
  - No reopening of completed tasks or reverting in_progress to new
✓ **License Management System Complete**: Implemented comprehensive license management with external server integration, encrypted data storage, user limits enforcement, and secure API endpoints for license acquisition, validation, and status checking
✓ **License Display Enhancement**: Fixed License Manager tab to show actual client ID and application ID values from database instead of hardcoded placeholders
✓ **Authentication Integration**: Resolved license status checking to properly detect valid licenses and bypass acquisition screen for authenticated users
✓ **UI Cleanup**: Removed temporary "Complete Logout & Clear Cache" button that was only needed during development phase
✓ **License Validation Workflow Enhancement**: Updated license validation to automatically use database client ID and request header domain, requiring only License Manager Server URL input for development
✓ **Comprehensive API Documentation**: Created LICENSE_VALIDATION_API.md with complete request/response JSON format documentation for both internal API and external license manager integration
✓ **Production-Ready Validation System**: Implemented streamlined validation workflow that will require only single-button operation once license manager URL is permanent
✓ **Multi-Domain License Validation Complete**: Resolved persistent 500 validation errors by implementing comprehensive domain retry logic that prioritizes complete development URL (including subdomain) then falls back to registered domain
✓ **Enhanced Validation Logging**: Added detailed logging system showing validation attempts with domain types, success/failure status, and comprehensive error tracking for debugging
✓ **End-to-End License Testing Success**: Successfully completed full license workflow testing with database clearing, acquisition, and validation - complete development URL validation working on first attempt
✓ **Modern Login Page Redesign**: Completely redesigned login interface with gradient background, glass morphism effects, animated elements, improved feature highlights, and enhanced user experience with better visual hierarchy and modern styling
✓ **First-Time Super Admin Registration System**: Implemented comprehensive first-time setup workflow that automatically detects empty users table and shows beautiful registration form instead of login page
✓ **System Status Detection**: Added API endpoints to check if system has any users and conditionally show registration vs login interface
✓ **Super Admin Creation Flow**: Built secure registration process with password validation, email uniqueness checks, automatic admin role assignment, and seamless transition to normal app workflow
✓ **Enhanced Authentication Context**: Extended AuthContext with system status checking and super admin registration capabilities for complete first-time setup experience

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