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

  // Reports & Analytics
  {
    id: 'analytics-dashboard',
    title: 'Analytics Dashboard Overview',
    content: `
# Analytics Dashboard Guide

## Overview:
The Analytics Dashboard provides comprehensive insights into your organization's productivity, task completion rates, and team performance metrics.

## Key Metrics Available:
- **Task Completion Rates**: Track completion percentages by team and individual
- **Time Tracking Analytics**: See actual vs. estimated time spent on tasks
- **Productivity Trends**: Monthly and weekly productivity patterns
- **Team Performance**: Compare team efficiency and output
- **Resource Allocation**: Understand workload distribution across teams

## Dashboard Sections:

### 1. Executive Summary
- Total tasks completed this month
- Average completion time
- Team productivity scores
- Critical metrics overview

### 2. Team Performance
- Individual team performance metrics
- Comparison charts between teams
- Workload distribution analysis
- Team member productivity rankings

### 3. Task Analytics
- Task completion trends over time
- Most common task types
- Average time per task category
- Overdue task analysis

### 4. Time Tracking Insights
- Total hours logged by team/individual
- Efficiency metrics (actual vs. estimated)
- Peak productivity hours
- Time allocation by project/category

## How to Use:
1. Navigate to Reports → Analytics Dashboard
2. Select date range for analysis
3. Choose specific teams or individuals
4. Export reports for presentations
5. Set up automated report delivery

## Best Practices:
- Review weekly for operational insights
- Use monthly data for strategic planning
- Compare teams fairly considering workload
- Focus on trends rather than single data points
`,
    category: 'reporting',
    role: ['admin', 'manager', 'team_manager'],
    scenario: ['performance-review', 'strategic-planning'],
    context: ['reports', 'analytics'],
    tags: ['analytics', 'dashboard', 'metrics', 'performance'],
    difficulty: 'intermediate',
    lastUpdated: '2025-07-15',
    relatedTopics: ['benchmarking-setup', 'team-management', 'task-statuses']
  },

  {
    id: 'benchmarking-reports',
    title: 'Benchmarking Reports',
    content: `
# Benchmarking Reports System

## Overview:
The benchmarking system provides intelligent analysis of employee productivity using advanced query processing and performance metrics.

## Key Features:

### 1. Natural Language Queries
Ask questions in plain English:
- "Who exceeded their weekly hour targets?"
- "Which team has the highest completion rate?"
- "Show me users below benchmark performance"
- "Compare department productivity this month"

### 2. Performance Analysis
- **Individual Performance**: Track each employee against benchmarks
- **Team Comparisons**: Compare team performance metrics
- **Trend Analysis**: See performance changes over time
- **Goal Achievement**: Track progress toward targets

### 3. Productivity Metrics
- **Hours Tracking**: Actual vs. target hours worked
- **Completion Rates**: Task completion percentages
- **Efficiency Scores**: Output quality and speed
- **Workload Balance**: Distribution of work across teams

### 4. Advanced Analytics
- **Percentage-based Analysis**: "Users who exceeded 10% more hours"
- **Comparative Rankings**: Top and bottom performers
- **Department Analytics**: Cross-departmental performance
- **Risk Identification**: Employees at risk of burnout

## Report Types:

### Weekly Performance Report
- Individual productivity scores
- Team achievement summaries
- Trend analysis
- Recommendations for improvement

### Monthly Benchmarking Analysis
- Comprehensive performance review
- Goal achievement tracking
- Resource allocation insights
- Strategic recommendations

### Custom Query Reports
- Natural language query results
- Filtered performance data
- Comparative analysis
- Detailed breakdowns

## How to Generate Reports:
1. Go to Reports → Benchmarking
2. Select report type or enter custom query
3. Choose date range and filters
4. Review results and insights
5. Export or schedule regular delivery

## Best Practices:
- Use consistent measurement periods
- Consider context when interpreting results
- Focus on improvement opportunities
- Regular review and adjustment of benchmarks
`,
    category: 'reporting',
    role: ['admin', 'manager', 'team_manager'],
    scenario: ['performance-review', 'benchmarking-analysis'],
    context: ['reports', 'benchmarking'],
    tags: ['benchmarking', 'reports', 'analytics', 'performance'],
    difficulty: 'advanced',
    lastUpdated: '2025-07-15',
    relatedTopics: ['analytics-dashboard', 'benchmarking-setup', 'user-roles']
  },

  {
    id: 'task-reports',
    title: 'Task Reports & Analysis',
    content: `
# Task Reports System

## Overview:
Generate comprehensive reports on task performance, completion rates, and productivity metrics across your organization.

## Available Reports:

### 1. Task Completion Reports
- **Daily Summaries**: Tasks completed each day
- **Weekly Overviews**: Weekly completion statistics
- **Monthly Analysis**: Monthly productivity trends
- **Project Reports**: Task completion by project

### 2. Time Tracking Reports
- **Time Spent Analysis**: Actual time vs. estimates
- **Efficiency Metrics**: Productivity per hour
- **Overtime Analysis**: Extended work hours tracking
- **Break Down by Category**: Time allocation analysis

### 3. Team Performance Reports
- **Team Productivity**: Overall team performance metrics
- **Individual Contributions**: Personal productivity scores
- **Workload Distribution**: Task assignment balance
- **Collaboration Metrics**: Team interaction analysis

### 4. Status Flow Reports
- **Workflow Analysis**: How tasks move through statuses
- **Bottleneck Identification**: Where tasks get stuck
- **Status Duration**: Time spent in each status
- **Process Optimization**: Workflow improvement opportunities

## Report Filters:
- **Date Range**: Custom date selections
- **Team Selection**: Specific teams or departments
- **Task Categories**: Filter by task types
- **Status Filters**: Focus on specific statuses
- **Priority Levels**: High, medium, low priority tasks
- **User Selection**: Individual or group reports

## Export Options:
- **PDF Reports**: Professional formatted documents
- **Excel Exports**: Detailed data for analysis
- **CSV Data**: Raw data for custom analysis
- **Email Delivery**: Scheduled report delivery

## How to Generate Reports:
1. Navigate to Reports → Task Reports
2. Select report type and parameters
3. Choose date range and filters
4. Preview report before generating
5. Export in desired format
6. Schedule regular delivery if needed

## Best Practices:
- Regular weekly reviews for operational insights
- Monthly analysis for strategic planning
- Compare performance across similar time periods
- Use filters to focus on specific areas
- Archive reports for historical comparison
`,
    category: 'reporting',
    role: ['admin', 'manager', 'team_manager'],
    scenario: ['task-analysis', 'performance-review'],
    context: ['reports', 'tasks'],
    tags: ['reports', 'tasks', 'analysis', 'productivity'],
    difficulty: 'intermediate',
    lastUpdated: '2025-07-15',
    relatedTopics: ['analytics-dashboard', 'task-statuses', 'time-tracking']
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
  },

  {
    id: 'benchmarking-query-patterns',
    title: 'Benchmarking Query Patterns Guide',
    content: `
# Benchmarking Query Patterns Guide

## Overview:
The benchmarking system uses natural language processing to understand and analyze productivity queries. This guide shows all supported query patterns and provides examples for each.

## Query Categories:

### 1. Time-Based Analysis
Use natural date expressions to filter data:
- **Examples**: "users from last month", "tasks from this week", "last week performance"
- **Keywords**: last month, this week, last week, previous month, this month

### 2. Role-Based Analysis
Filter by user roles:
- **Manager Analysis**: "show me task data for managers", "manager performance"
- **Admin Analysis**: "admin task statistics", "administrator workload"
- **Regular Users**: "regular user performance", "user task analysis"

### 3. Percentage Analysis
Find performance outliers:
- **Exceeding Targets**: "users who surpassed hours by more than 20%"
- **Below Targets**: "users who fell short by more than 15%"
- **Keywords**: surpass, exceed, short, below, over, under

### 4. Numerical Analysis
Filter by specific thresholds:
- **Task Counts**: "users with more than 5 tasks", "less than 3 tasks"
- **Hour Limits**: "users working over 40 hours", "under 8 hours daily"

### 5. Comparative Analysis
Compare against averages:
- **Above Average**: "users performing above average"
- **Below Average**: "below average performers"
- **Department Comparison**: "users outperforming department average"

### 6. Advanced Patterns
Complex analytical queries:
- **Completion Rates**: "users with high completion rates"
- **Goal Achievement**: "users achieving goals consistently"
- **Risk Detection**: "users at risk of burnout"
- **Workload Distribution**: "workload balance across teams"

## Best Practices:
- Use natural language - the system understands conversational queries
- Combine concepts: "managers who worked more than 40 hours last week"
- Be specific about time periods for accurate results
- Use percentage queries to find outliers
- Try different phrasings if a query doesn't work as expected

## Example Queries:
- "Show me task data for managers in system"
- "Users who exceeded hours by more than 25%"
- "Team members below benchmark last month"
- "Users with high completion rates this week"
- "Department performance comparison"
- "Users at risk of burnout"
`,
    category: 'benchmarking',
    role: ['admin', 'manager', 'team_manager'],
    scenario: ['performance-analysis', 'productivity-tracking'],
    context: ['benchmarking', 'queries', 'analysis'],
    tags: ['benchmarking', 'queries', 'natural-language', 'analysis'],
    difficulty: 'intermediate',
    lastUpdated: '2025-07-15',
    relatedTopics: ['benchmarking-setup', 'reporting', 'performance-analysis'],
    customComponent: 'BenchmarkingQueryGuide'
  }
];

export const helpScenarios: HelpScenario[] = [
  {
    id: 'generate-weekly-report',
    name: 'Generating Weekly Performance Report',
    description: 'Step-by-step process to create and distribute weekly team performance reports',
    steps: [
      {
        id: 'navigate-reports',
        title: 'Navigate to Reports Section',
        description: 'Access the reporting dashboard from the main menu',
        action: 'Go to Reports → Analytics Dashboard',
        tips: [
          'Make sure you have proper permissions for the report type',
          'Check if you need admin or manager access',
          'Verify your role allows viewing team data'
        ]
      },
      {
        id: 'select-parameters',
        title: 'Configure Report Parameters',
        description: 'Choose the appropriate date range and filters for your report',
        action: 'Set date range to last 7 days and select relevant teams',
        tips: [
          'Use consistent date ranges for comparison',
          'Select only teams you manage or have access to',
          'Consider time zones for accurate reporting'
        ]
      },
      {
        id: 'review-data',
        title: 'Review Generated Data',
        description: 'Examine the report results and verify accuracy',
        action: 'Check metrics for completeness and identify any anomalies',
        tips: [
          'Look for unusual patterns or missing data',
          'Verify team member inclusion',
          'Check for any system outages that might affect data'
        ]
      },
      {
        id: 'export-report',
        title: 'Export and Distribute',
        description: 'Export the report in appropriate format and share with stakeholders',
        action: 'Export as PDF or Excel and email to relevant team members',
        tips: [
          'Choose format based on recipient preferences',
          'Include context and analysis with raw data',
          'Set up automated delivery for regular reports'
        ]
      }
    ],
    roles: ['admin', 'manager', 'team_manager'],
    estimatedTime: '10-15 minutes',
    difficulty: 'beginner'
  },

  {
    id: 'benchmarking-analysis',
    name: 'Conducting Benchmarking Analysis',
    description: 'Complete process for analyzing team performance using benchmarking tools',
    steps: [
      {
        id: 'access-benchmarking',
        title: 'Access Benchmarking Reports',
        description: 'Navigate to the benchmarking section and prepare for analysis',
        action: 'Go to Reports → Benchmarking',
        tips: [
          'Ensure benchmarking is enabled for your organization',
          'Check if users have proper benchmark settings',
          'Verify data collection period is sufficient'
        ]
      },
      {
        id: 'formulate-query',
        title: 'Create Natural Language Query',
        description: 'Write clear questions to get specific insights',
        action: 'Enter query like "Which team members exceeded their weekly targets?"',
        tips: [
          'Use specific timeframes in your queries',
          'Ask about percentages for better comparisons',
          'Focus on actionable insights rather than raw numbers'
        ]
      },
      {
        id: 'analyze-results',
        title: 'Interpret Results',
        description: 'Review the analysis results and identify key insights',
        action: 'Examine performance patterns and identify improvement opportunities',
        tips: [
          'Look for trends rather than isolated incidents',
          'Consider external factors affecting performance',
          'Focus on sustainable improvements'
        ]
      },
      {
        id: 'action-planning',
        title: 'Create Action Plan',
        description: 'Develop specific steps based on the analysis',
        action: 'Document findings and create improvement strategies',
        tips: [
          'Set specific, measurable goals',
          'Include timelines for implementation',
          'Consider individual vs. team-level interventions'
        ]
      }
    ],
    roles: ['admin', 'manager', 'team_manager'],
    estimatedTime: '20-30 minutes',
    difficulty: 'intermediate'
  },
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
    answer: 'The benchmarking system supports natural language queries like "users who exceeded 10% more hours", "team members below benchmark", "highest completion rates", and "department performance comparison". You can ask about hours, completion rates, team performance, and efficiency metrics. For detailed patterns, see the Benchmarking Query Guide.',
    category: 'benchmarking',
    roles: ['admin', 'manager', 'team_manager'],
    popularity: 75,
    lastUpdated: '2025-07-15',
    relatedTopics: ['benchmarking-setup', 'reporting', 'performance-analysis', 'benchmarking-query-patterns']
  },

  {
    id: 'report-access-permissions',
    question: 'Why can\'t I access certain reports?',
    answer: 'Report access is based on your role permissions. Admins can access all reports, Managers can view team and individual reports for their teams, Team Managers can access reports for their specific team, and regular Users can only view their personal reports. Contact your administrator if you need additional access.',
    category: 'reporting',
    roles: ['admin', 'manager', 'team_manager', 'user'],
    popularity: 84,
    lastUpdated: '2025-07-15',
    relatedTopics: ['user-roles', 'analytics-dashboard', 'permissions']
  },

  {
    id: 'export-report-formats',
    question: 'What formats can I export reports in?',
    answer: 'Reports can be exported in multiple formats: PDF for professional presentations, Excel for detailed data analysis, CSV for raw data import into other systems, and you can also set up automated email delivery for regular reports. Choose the format that best suits your needs.',
    category: 'reporting',
    roles: ['admin', 'manager', 'team_manager'],
    popularity: 78,
    lastUpdated: '2025-07-15',
    relatedTopics: ['analytics-dashboard', 'task-reports', 'benchmarking-reports']
  },

  {
    id: 'report-scheduling',
    question: 'Can I schedule reports to be sent automatically?',
    answer: 'Yes, you can set up automated report delivery through the Reports section. Choose your report type, set the frequency (daily, weekly, monthly), select recipients, and configure the delivery format. This is perfect for regular team updates and management reviews.',
    category: 'reporting',
    roles: ['admin', 'manager', 'team_manager'],
    popularity: 81,
    lastUpdated: '2025-07-15',
    relatedTopics: ['analytics-dashboard', 'task-reports', 'team-management']
  },

  {
    id: 'report-data-accuracy',
    question: 'How do I ensure my reports show accurate data?',
    answer: 'Report accuracy depends on proper time tracking and task status updates. Ensure team members are using timers correctly, updating task statuses promptly, and logging time accurately. Review data for any anomalies and check for system outages that might affect data collection.',
    category: 'reporting',
    roles: ['admin', 'manager', 'team_manager'],
    popularity: 86,
    lastUpdated: '2025-07-15',
    relatedTopics: ['time-tracking', 'task-statuses', 'analytics-dashboard']
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