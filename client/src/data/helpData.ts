import { HelpTopic, HelpCategory, HelpScenario, FAQ } from '@/types/help';

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of TaskRep',
    icon: 'Rocket',
    order: 1,
    roles: ['admin', 'manager', 'team_manager', 'user']
  },
  {
    id: 'task-management',
    name: 'Task Management',
    description: 'Creating, assigning, and tracking tasks',
    icon: 'CheckSquare',
    order: 2,
    roles: ['admin', 'manager', 'team_manager', 'user']
  },
  {
    id: 'user-management',
    name: 'User Management',
    description: 'Managing users, roles, and permissions',
    icon: 'Users',
    order: 3,
    roles: ['admin', 'manager']
  },
  {
    id: 'team-management',
    name: 'Team Management',
    description: 'Creating and managing teams',
    icon: 'Users2',
    order: 4,
    roles: ['admin', 'manager', 'team_manager']
  },
  {
    id: 'reporting',
    name: 'Reports & Analytics',
    description: 'Generating reports and analyzing data',
    icon: 'BarChart3',
    order: 5,
    roles: ['admin', 'manager', 'team_manager']
  },
  {
    id: 'settings',
    name: 'Settings & Configuration',
    description: 'System configuration and preferences',
    icon: 'Settings',
    order: 6,
    roles: ['admin', 'manager']
  },
  {
    id: 'benchmarking',
    name: 'Benchmarking & Productivity',
    description: 'Tracking and analyzing productivity metrics',
    icon: 'TrendingUp',
    order: 7,
    roles: ['admin', 'manager', 'team_manager']
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: 'AlertCircle',
    order: 8,
    roles: ['admin', 'manager', 'team_manager', 'user']
  }
];

export const helpTopics: HelpTopic[] = [
  // Getting Started
  {
    id: 'first-login',
    title: 'Your First Login',
    content: `
# Welcome to TaskRep!

## What is TaskRep?
TaskRep is a comprehensive task management system designed to help teams collaborate effectively with role-based access control and detailed productivity tracking.

## Your First Steps:
1. **Review Your Dashboard**: Start with the dashboard to see an overview of your tasks and activities
2. **Check Your Profile**: Ensure your profile information is complete
3. **Explore Your Role**: Your permissions are based on your assigned role
4. **Review Active Tasks**: Check what tasks are currently assigned to you

## Key Features:
- **Task Management**: Create, assign, and track tasks with detailed status workflows
- **Team Collaboration**: Work together with team members based on your role
- **Time Tracking**: Monitor time spent on tasks for productivity analysis
- **Reporting**: Generate reports and analyze performance metrics
- **Benchmarking**: Track productivity against organizational standards

## Next Steps:
- Complete the "Creating Your First Task" tutorial
- Set up your notification preferences
- Join your team discussions
`,
    category: 'getting-started',
    role: ['admin', 'manager', 'team_manager', 'user'],
    scenario: ['first-time-user', 'onboarding'],
    context: ['dashboard', 'login'],
    tags: ['welcome', 'introduction', 'basics', 'first-time'],
    difficulty: 'beginner',
    lastUpdated: '2025-07-15',
    relatedTopics: ['dashboard-overview', 'user-roles', 'task-basics']
  },
  
  {
    id: 'dashboard-overview',
    title: 'Understanding Your Dashboard',
    content: `
# Dashboard Overview

## Main Dashboard Components:

### 1. Quick Stats
- **Active Tasks**: Number of tasks currently assigned to you
- **Completed Today**: Tasks you've completed today
- **Overdue Tasks**: Tasks past their due date
- **Team Performance**: Overview of your team's progress

### 2. Tasks Due Today
- Shows all tasks due today with priority indicators
- Click on any task to view details
- Color-coded by priority (Red: High, Orange: Medium, Green: Low)

### 3. Recent Activity
- Latest updates on your tasks
- Team member activities
- System notifications

### 4. Time Tracking
- Active timers for tasks you're working on
- Daily time spent summary
- Weekly productivity trends

## Customizing Your Dashboard:
- Use the settings icon to personalize your view
- Filter information by team, priority, or date range
- Set up notifications for important updates
`,
    category: 'getting-started',
    role: ['admin', 'manager', 'team_manager', 'user'],
    scenario: ['daily-workflow', 'overview'],
    context: ['dashboard'],
    tags: ['dashboard', 'overview', 'navigation', 'stats'],
    difficulty: 'beginner',
    lastUpdated: '2025-07-15',
    relatedTopics: ['first-login', 'task-basics', 'notifications']
  },

  // Task Management
  {
    id: 'creating-tasks',
    title: 'Creating Tasks',
    content: `
# Creating Tasks

## Step-by-Step Guide:

### 1. Navigate to Task Creation
- Go to "Task Management" → "All Tasks"
- Click the "Create Task" button
- Or use the "+" icon in the top navigation

### 2. Fill Required Information
- **Task Title**: Clear, descriptive title
- **Description**: Detailed task requirements
- **Priority**: High, Medium, or Low
- **Estimated Hours**: Time needed to complete
- **Start Date**: When work should begin
- **End Date**: Task deadline

### 3. Assignment & Organization
- **Assign To**: Select team member (based on your role permissions)
- **Task Group**: Organize related tasks together
- **Dependencies**: Link to prerequisite tasks
- **Status**: Usually starts as "To Do"

### 4. Advanced Options
- **Time Management**: Enable for time tracking
- **Attachments**: Add relevant files
- **Tags**: Categorize for easy filtering
- **Comments**: Add initial notes

## Best Practices:
- Use clear, action-oriented titles
- Include acceptance criteria in descriptions
- Set realistic time estimates
- Choose appropriate priority levels
- Link related tasks as dependencies

## Tips for Different Roles:
- **Admin**: Can assign to anyone, create for any team
- **Manager**: Can assign to team members and subordinates
- **Team Manager**: Can assign within their team
- **User**: Can create tasks for themselves or request assignments
`,
    category: 'task-management',
    role: ['admin', 'manager', 'team_manager', 'user'],
    scenario: ['task-creation', 'project-setup', 'daily-workflow'],
    context: ['tasks', 'create-task'],
    tags: ['tasks', 'create', 'assignment', 'workflow'],
    difficulty: 'beginner',
    lastUpdated: '2025-07-15',
    relatedTopics: ['task-assignment', 'task-statuses', 'time-tracking']
  },

  {
    id: 'task-statuses',
    title: 'Understanding Task Statuses',
    content: `
# Task Status Workflow

## Default Status Flow:
1. **To Do** → Ready to start work
2. **In Progress** → Currently being worked on
3. **Review** → Waiting for approval/feedback
4. **Completed** → Task finished successfully

## Status Management:
- **Status Colors**: Each status has a color indicator for easy identification
- **Transitions**: Some statuses may have restricted transitions
- **Permissions**: Your role determines which status changes you can make
- **Automatic Updates**: Some statuses update automatically based on actions

## Status-Specific Actions:
- **To Do**: Start timer, edit task details, assign to team members
- **In Progress**: Log time, add progress comments, request help
- **Review**: Submit for approval, attach deliverables
- **Completed**: View final metrics, add completion notes

## Custom Statuses:
Admins can create custom statuses for specific workflows:
- **Planning**: For tasks in planning phase
- **Blocked**: When task is waiting for dependencies
- **Testing**: For tasks in quality assurance
- **Deployed**: For completed and deployed features

## Status Indicators:
- **Priority Colors**: Red (High), Orange (Medium), Green (Low)
- **Due Date Colors**: Red (Overdue), Orange (Due Soon), Green (On Track)
- **Time Tracking**: Shows if task is actively being timed
`,
    category: 'task-management',
    role: ['admin', 'manager', 'team_manager', 'user'],
    scenario: ['task-workflow', 'status-management'],
    context: ['tasks', 'status'],
    tags: ['status', 'workflow', 'progress', 'management'],
    difficulty: 'intermediate',
    lastUpdated: '2025-07-15',
    relatedTopics: ['creating-tasks', 'time-tracking', 'task-assignment']
  },

  // User Management
  {
    id: 'user-roles',
    title: 'Understanding User Roles',
    content: `
# User Roles & Permissions

## Role Hierarchy:

### 1. Admin
- **Full System Access**: Complete control over all features
- **User Management**: Create, edit, delete users
- **Role Management**: Assign and modify user roles
- **System Settings**: Configure organization-wide settings
- **All Reports**: Access to all reporting features
- **Team Management**: Create and manage all teams

### 2. Manager
- **Team Oversight**: Manage assigned teams and departments
- **User Management**: Limited to their team members
- **Task Assignment**: Assign tasks to team members
- **Reports**: Access to team and individual reports
- **Settings**: Limited configuration options

### 3. Team Manager
- **Team Leadership**: Manage specific team operations
- **Task Coordination**: Assign tasks within their team
- **Team Reports**: Access to team performance metrics
- **Member Support**: Help team members with task issues

### 4. User
- **Task Execution**: Create and manage personal tasks
- **Time Tracking**: Log time on assigned tasks
- **Profile Management**: Update personal information
- **Basic Reports**: Access to personal productivity reports

## Permission Matrix:
| Feature | Admin | Manager | Team Manager | User |
|---------|-------|---------|--------------|------|
| Create Users | ✓ | ✓ (team only) | ✗ | ✗ |
| Assign Tasks | ✓ | ✓ | ✓ (team only) | ✓ (self only) |
| View Reports | ✓ | ✓ | ✓ (team only) | ✓ (self only) |
| System Settings | ✓ | ✗ | ✗ | ✗ |
| Delete Tasks | ✓ | ✓ | ✓ (team only) | ✓ (own only) |

## Role-Based Visibility:
- **Organization Scope**: Admins see all users and data
- **Team Scope**: Managers see their teams and subordinates
- **User Scope**: Regular users see only their own data
`,
    category: 'user-management',
    role: ['admin', 'manager'],
    scenario: ['user-setup', 'permission-management'],
    context: ['admin', 'users', 'roles'],
    tags: ['roles', 'permissions', 'access', 'hierarchy'],
    difficulty: 'intermediate',
    lastUpdated: '2025-07-15',
    relatedTopics: ['creating-users', 'team-management', 'security']
  },

  // Benchmarking
  {
    id: 'benchmarking-setup',
    title: 'Setting Up Benchmarking',
    content: `
# Benchmarking System Setup

## Overview:
The benchmarking system tracks employee productivity against organizational standards to ensure optimal performance and identify improvement opportunities.

## Configuration Steps:

### 1. Organization Settings
- **Daily Hour Limits**: Set minimum and maximum hours per day
- **Weekly Targets**: Define weekly hour requirements
- **Monthly Goals**: Set monthly productivity targets
- **User Overrides**: Allow custom targets for specific users

### 2. User-Level Configuration
- **Custom Targets**: Set individual goals for specific users
- **Exclusions**: Exclude certain users from benchmarking
- **Role-Based Defaults**: Different targets for different roles

### 3. Reporting Configuration
- **Frequency**: Daily, weekly, or monthly reports
- **Recipients**: Who receives benchmarking reports
- **Thresholds**: When to trigger alerts or notifications

## Key Metrics:
- **Daily Hours**: Average hours worked per day
- **Weekly Hours**: Total hours per week
- **Task Completion**: Rate of task completion
- **Efficiency**: Tasks completed per hour
- **Consistency**: Meeting targets consistently

## Advanced Queries:
The system supports natural language queries like:
- "Show me users who exceeded 10% more hours than target"
- "Find team members below benchmark"
- "Users with highest completion rates"
- "Department performance comparison"

## Best Practices:
- Set realistic targets based on role and experience
- Regular review and adjustment of benchmarks
- Use data for coaching, not punishment
- Consider context when interpreting results
`,
    category: 'benchmarking',
    role: ['admin', 'manager'],
    scenario: ['performance-tracking', 'productivity-analysis'],
    context: ['admin', 'settings', 'benchmarking'],
    tags: ['benchmarking', 'productivity', 'metrics', 'performance'],
    difficulty: 'advanced',
    lastUpdated: '2025-07-15',
    relatedTopics: ['time-tracking', 'reporting', 'user-management']
  }
];

export const helpScenarios: HelpScenario[] = [
  {
    id: 'onboarding-new-user',
    name: 'Onboarding a New User',
    description: 'Complete process for adding and setting up a new team member',
    steps: [
      {
        id: 'create-user-account',
        title: 'Create User Account',
        description: 'Add the new user to the system with basic information',
        action: 'Go to Admin → Users → Create User',
        tips: [
          'Use the user\'s work email address',
          'Set a temporary password they can change later',
          'Include their department and phone number'
        ]
      },
      {
        id: 'assign-role',
        title: 'Assign Appropriate Role',
        description: 'Set the user\'s role based on their responsibilities',
        action: 'In user details, click "Change Role"',
        tips: [
          'Consider their seniority and responsibilities',
          'Most new employees start with "User" role',
          'Managers should get "Manager" or "Team Manager" role'
        ]
      },
      {
        id: 'add-to-team',
        title: 'Add to Team',
        description: 'Assign the user to their appropriate team',
        action: 'Go to Admin → Teams → Select Team → Add Member',
        tips: [
          'Users can be on multiple teams',
          'Set their role within the team',
          'Consider their reporting structure'
        ]
      },
      {
        id: 'set-benchmarks',
        title: 'Configure Benchmarking',
        description: 'Set productivity targets if different from defaults',
        action: 'In user profile, edit benchmarking settings',
        tips: [
          'New employees may need adjusted targets',
          'Consider their experience level',
          'Review targets after 90 days'
        ]
      },
      {
        id: 'first-task-assignment',
        title: 'Assign First Task',
        description: 'Create an initial task to get them started',
        action: 'Create a simple, well-defined task',
        tips: [
          'Make it achievable and clear',
          'Include detailed instructions',
          'Set a reasonable timeline'
        ]
      }
    ],
    roles: ['admin', 'manager'],
    estimatedTime: '15-20 minutes',
    difficulty: 'intermediate'
  },
  
  {
    id: 'daily-task-workflow',
    name: 'Daily Task Management Workflow',
    description: 'How to efficiently manage tasks throughout the day',
    steps: [
      {
        id: 'morning-review',
        title: 'Morning Task Review',
        description: 'Start your day by reviewing tasks and priorities',
        action: 'Check Dashboard → Tasks Due Today',
        tips: [
          'Review overnight updates and comments',
          'Prioritize based on urgency and importance',
          'Check for any blockers or dependencies'
        ]
      },
      {
        id: 'start-work',
        title: 'Begin Working on Tasks',
        description: 'Start timer and begin work on highest priority task',
        action: 'Click task → Start Timer → Begin work',
        tips: [
          'Focus on one task at a time',
          'Update status to "In Progress"',
          'Add comments for significant progress'
        ]
      },
      {
        id: 'progress-updates',
        title: 'Regular Progress Updates',
        description: 'Update task status and add comments throughout the day',
        action: 'Add comments and update status as needed',
        tips: [
          'Update every few hours or at major milestones',
          'Be specific about progress and challenges',
          'Tag team members if input is needed'
        ]
      },
      {
        id: 'end-of-day',
        title: 'End of Day Wrap-up',
        description: 'Stop timers and prepare for next day',
        action: 'Stop all timers → Update task statuses → Plan tomorrow',
        tips: [
          'Stop all active timers',
          'Update task statuses accurately',
          'Leave notes for tomorrow\'s priorities'
        ]
      }
    ],
    roles: ['admin', 'manager', 'team_manager', 'user'],
    estimatedTime: 'Ongoing throughout day',
    difficulty: 'beginner'
  }
];

export const helpFAQs: FAQ[] = [
  {
    id: 'password-reset',
    question: 'How do I reset my password?',
    answer: 'Contact your system administrator to reset your password. Admins can reset passwords through the User Management section.',
    category: 'getting-started',
    roles: ['admin', 'manager', 'team_manager', 'user'],
    popularity: 95,
    lastUpdated: '2025-07-15',
    relatedTopics: ['first-login', 'user-management']
  },
  
  {
    id: 'task-assignment-permissions',
    question: 'Why can\'t I assign tasks to certain users?',
    answer: 'Task assignment is based on your role permissions. Users can only assign tasks to themselves, Team Managers can assign within their team, Managers can assign to their team members and subordinates, and Admins can assign to anyone.',
    category: 'task-management',
    roles: ['admin', 'manager', 'team_manager', 'user'],
    popularity: 88,
    lastUpdated: '2025-07-15',
    relatedTopics: ['user-roles', 'creating-tasks', 'task-assignment']
  },
  
  {
    id: 'time-tracking-accuracy',
    question: 'How accurate is the time tracking?',
    answer: 'Time tracking is accurate to the minute. The system tracks actual time spent working on tasks when timers are active. Make sure to start/stop timers properly to ensure accurate tracking.',
    category: 'task-management',
    roles: ['admin', 'manager', 'team_manager', 'user'],
    popularity: 82,
    lastUpdated: '2025-07-15',
    relatedTopics: ['time-tracking', 'benchmarking-setup', 'task-workflow']
  },
  
  {
    id: 'benchmarking-queries',
    question: 'What kind of queries can I use in the benchmarking report?',
    answer: 'The benchmarking system supports natural language queries like "users who exceeded 10% more hours", "team members below benchmark", "highest completion rates", and "department performance comparison". You can ask about hours, completion rates, team performance, and efficiency metrics.',
    category: 'benchmarking',
    roles: ['admin', 'manager', 'team_manager'],
    popularity: 75,
    lastUpdated: '2025-07-15',
    relatedTopics: ['benchmarking-setup', 'reporting', 'performance-analysis']
  },
  
  {
    id: 'role-visibility',
    question: 'Why can\'t I see all users in the system?',
    answer: 'User visibility is based on your role scope. Admins see all users, Managers see their teams and subordinates, Team Managers see their team members, and regular Users see only themselves. This is for security and data privacy.',
    category: 'user-management',
    roles: ['admin', 'manager', 'team_manager', 'user'],
    popularity: 79,
    lastUpdated: '2025-07-15',
    relatedTopics: ['user-roles', 'security', 'permissions']
  },
  
  {
    id: 'task-deletion',
    question: 'Can I delete tasks?',
    answer: 'Task deletion permissions depend on your role and the task status. Some task statuses may not allow deletion to maintain audit trails. Admins have full deletion rights, while other roles have limited deletion permissions based on their scope.',
    category: 'task-management',
    roles: ['admin', 'manager', 'team_manager', 'user'],
    popularity: 71,
    lastUpdated: '2025-07-15',
    relatedTopics: ['task-statuses', 'user-roles', 'permissions']
  }
];