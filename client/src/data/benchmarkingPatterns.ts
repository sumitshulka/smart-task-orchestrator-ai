// Benchmarking Query Pattern Documentation
// This file documents all the query patterns that the benchmarking system can understand and process

export interface QueryPattern {
  category: string;
  name: string;
  description: string;
  examples: string[];
  expectedOutput: string;
  keywords: string[];
}

export const benchmarkingPatterns: QueryPattern[] = [
  // TIME-BASED QUERIES
  {
    category: "Time-Based Analysis",
    name: "Natural Date Expressions",
    description: "Analyze data for specific time periods using natural language",
    examples: [
      "Show me users from last month",
      "Display tasks from this week",
      "Users who worked last week",
      "Task data from previous month"
    ],
    expectedOutput: "Filters data to the specified time period and recalculates all metrics",
    keywords: ["last month", "this week", "last week", "previous month", "this month"]
  },

  // ROLE-BASED QUERIES
  {
    category: "Role-Based Analysis",
    name: "Manager Performance Analysis",
    description: "Filter and analyze data specifically for users with manager roles",
    examples: [
      "Show me task data for managers in system",
      "Manager task count analysis",
      "How are managers performing on tasks",
      "Manager workload distribution"
    ],
    expectedOutput: "Shows only users with manager roles and their task/hour statistics",
    keywords: ["manager", "managers", "task", "count", "data"]
  },
  {
    category: "Role-Based Analysis", 
    name: "Admin Performance Analysis",
    description: "Filter and analyze data specifically for users with admin roles",
    examples: [
      "Show me task data for admins",
      "Admin task count analysis", 
      "How are admins performing",
      "Admin workload statistics"
    ],
    expectedOutput: "Shows only users with admin roles and their task/hour statistics",
    keywords: ["admin", "admins", "administrator", "task", "count", "data"]
  },
  {
    category: "Role-Based Analysis",
    name: "Regular User Analysis", 
    description: "Filter and analyze data for regular users (excluding managers and admins)",
    examples: [
      "Show me task data for regular users",
      "User task count analysis",
      "How are regular users performing",
      "Regular user workload statistics"
    ],
    expectedOutput: "Shows only regular users (no admin/manager roles) and their statistics",
    keywords: ["user", "users", "regular", "task", "count", "data"]
  },

  // PERCENTAGE-BASED QUERIES
  {
    category: "Percentage Analysis",
    name: "Performance Surpass Analysis",
    description: "Find users who exceed expected hours by a specific percentage",
    examples: [
      "Users who surpassed hours by more than 20%",
      "Show me users who exceeded target by 15%",
      "Users surpassing goals by over 30%",
      "Who exceeded expectations by 25%"
    ],
    expectedOutput: "Lists users whose actual hours exceed estimated hours by the specified percentage",
    keywords: ["surpass", "exceed", "exceeded", "surpassed", "more than", "over", "%"]
  },
  {
    category: "Percentage Analysis",
    name: "Performance Shortfall Analysis", 
    description: "Find users who fall short of expected hours by a specific percentage",
    examples: [
      "Users who fell short by more than 15%",
      "Show me users below target by 20%",
      "Users short of goals by over 25%",
      "Who underperformed by 30%"
    ],
    expectedOutput: "Lists users whose actual hours fall below estimated hours by the specified percentage",
    keywords: ["short", "below", "fell short", "underperformed", "less than", "under", "%"]
  },

  // NUMERICAL FILTERING
  {
    category: "Numerical Analysis",
    name: "Task Count Filtering",
    description: "Filter users based on specific task count thresholds",
    examples: [
      "Users with more than 5 tasks",
      "Show me users with less than 3 tasks",
      "Users who have over 10 tasks",
      "People with fewer than 2 tasks"
    ],
    expectedOutput: "Lists users who meet the specified task count criteria",
    keywords: ["more than", "less than", "over", "under", "fewer than", "tasks"]
  },
  {
    category: "Numerical Analysis",
    name: "Hours-Based Filtering",
    description: "Filter users based on specific hour thresholds (daily/weekly)",
    examples: [
      "Users with more than 40 hours weekly",
      "Show me users with less than 8 hours daily",
      "Users working over 50 hours per week",
      "People with under 6 hours per day"
    ],
    expectedOutput: "Lists users who meet the specified hour criteria",
    keywords: ["more than", "less than", "over", "under", "hours", "daily", "weekly"]
  },

  // COMPARATIVE ANALYSIS
  {
    category: "Comparative Analysis",
    name: "Above Average Performance",
    description: "Find users performing better than the overall average",
    examples: [
      "Users performing above average",
      "Show me above average performers",
      "Users who are above average",
      "Above average productivity users"
    ],
    expectedOutput: "Lists users whose performance metrics exceed the calculated average",
    keywords: ["above", "average", "performing", "performers", "productivity"]
  },
  {
    category: "Comparative Analysis",
    name: "Below Average Performance",
    description: "Find users performing below the overall average",
    examples: [
      "Users performing below average", 
      "Show me below average performers",
      "Users who are below average",
      "Below average productivity users"
    ],
    expectedOutput: "Lists users whose performance metrics fall below the calculated average",
    keywords: ["below", "average", "performing", "performers", "productivity"]
  },
  {
    category: "Comparative Analysis",
    name: "Department Average Comparison",
    description: "Find users outperforming their department average",
    examples: [
      "Users outperforming department average",
      "Show me users above department average",
      "Department top performers",
      "Users exceeding department benchmarks"
    ],
    expectedOutput: "Lists users whose performance exceeds their department's average",
    keywords: ["department", "average", "outperform", "exceeding", "benchmarks"]
  },

  // ADVANCED ANALYTICAL PATTERNS
  {
    category: "Advanced Analysis",
    name: "Completion Rate Analysis",
    description: "Analyze task completion efficiency and rates",
    examples: [
      "Users with high completion rates",
      "Show me completion efficiency analysis",
      "Task completion rate breakdown",
      "Completion efficiency metrics"
    ],
    expectedOutput: "Shows users ranked by task completion efficiency and rates",
    keywords: ["completion", "efficiency", "rates", "finished", "completed"]
  },
  {
    category: "Advanced Analysis",
    name: "Goal Achievement Analysis",
    description: "Track progress toward organizational goals and targets",
    examples: [
      "Users achieving goals consistently",
      "Show me goal achievement progress",
      "Target achievement analysis",
      "Goal completion metrics"
    ],
    expectedOutput: "Shows users' progress toward achieving set goals and targets",
    keywords: ["goal", "goals", "achievement", "target", "targets", "progress"]
  },
  {
    category: "Advanced Analysis",
    name: "Team Performance Comparison",
    description: "Compare performance across different teams or departments",
    examples: [
      "Team performance comparison",
      "Show me top performing teams",
      "Department productivity analysis",
      "Team benchmark comparison"
    ],
    expectedOutput: "Compares performance metrics across teams and departments",
    keywords: ["team", "teams", "department", "comparison", "benchmark", "productivity"]
  },
  {
    category: "Advanced Analysis",
    name: "Workload Distribution Analysis",
    description: "Analyze how tasks and hours are distributed across users",
    examples: [
      "Workload distribution analysis",
      "Show me task distribution patterns",
      "Hour allocation across users",
      "Workload balance metrics"
    ],
    expectedOutput: "Shows how tasks and hours are distributed and balanced across users",
    keywords: ["workload", "distribution", "allocation", "balance", "patterns"]
  },
  {
    category: "Advanced Analysis",
    name: "Risk and Alert Detection",
    description: "Identify users who may be at risk of burnout or underperformance",
    examples: [
      "Users at risk of burnout",
      "Show me performance risk alerts",
      "Burnout risk analysis",
      "Performance warning indicators"
    ],
    expectedOutput: "Identifies users with concerning performance patterns or risk factors",
    keywords: ["risk", "alert", "alerts", "burnout", "warning", "concern"]
  },

  // BENCHMARKING SPECIFIC
  {
    category: "Benchmarking Analysis",
    name: "Consistently High Performers",
    description: "Find users who consistently exceed benchmarks",
    examples: [
      "Users consistently above benchmarks",
      "Show me consistent high performers",
      "Users always exceeding targets",
      "Consistent top performers"
    ],
    expectedOutput: "Lists users who consistently perform above set benchmarks",
    keywords: ["consistently", "consistent", "always", "high", "top", "performers"]
  },
  {
    category: "Benchmarking Analysis",
    name: "Consistently Low Performers",
    description: "Find users who consistently fall below benchmarks",
    examples: [
      "Users consistently below benchmarks",
      "Show me consistent low performers", 
      "Users always below targets",
      "Consistent underperformers"
    ],
    expectedOutput: "Lists users who consistently perform below set benchmarks",
    keywords: ["consistently", "consistent", "always", "low", "below", "underperformers"]
  },
  {
    category: "Benchmarking Analysis",
    name: "Exact Hours Analysis",
    description: "Find users who work exactly the expected benchmark hours",
    examples: [
      "Users working exact benchmark hours",
      "Show me users hitting exact targets",
      "Users meeting precise benchmarks",
      "Exact hour compliance analysis"
    ],
    expectedOutput: "Lists users whose hours match exactly with benchmark expectations",
    keywords: ["exact", "exactly", "precise", "hitting", "compliance", "benchmarks"]
  }
];

// Helper function to get patterns by category
export const getPatternsByCategory = (category: string): QueryPattern[] => {
  return benchmarkingPatterns.filter(pattern => pattern.category === category);
};

// Helper function to get all categories
export const getAllCategories = (): string[] => {
  return [...new Set(benchmarkingPatterns.map(pattern => pattern.category))];
};

// Helper function to search patterns by keyword
export const searchPatterns = (keyword: string): QueryPattern[] => {
  const searchTerm = keyword.toLowerCase();
  return benchmarkingPatterns.filter(pattern => 
    pattern.keywords.some(k => k.toLowerCase().includes(searchTerm)) ||
    pattern.name.toLowerCase().includes(searchTerm) ||
    pattern.description.toLowerCase().includes(searchTerm) ||
    pattern.examples.some(ex => ex.toLowerCase().includes(searchTerm))
  );
};

// Usage examples for developers
export const usageExamples = {
  basicQuery: "Show me task data for managers in system",
  timeBasedQuery: "Users who worked last month",
  percentageQuery: "Users who surpassed hours by more than 20%",
  numericalQuery: "Users with more than 5 tasks",
  comparativeQuery: "Users performing above average",
  advancedQuery: "Users at risk of burnout"
};