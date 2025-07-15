import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Copy, CheckCircle, Clock, Users, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
import { benchmarkingPatterns, getAllCategories, searchPatterns, usageExamples } from '@/data/benchmarkingPatterns';

export const BenchmarkingQueryGuide: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  
  const categories = getAllCategories();
  const filteredPatterns = searchTerm ? searchPatterns(searchTerm) : benchmarkingPatterns;
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedExample(text);
    setTimeout(() => setCopiedExample(null), 2000);
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Time-Based Analysis': return <Clock className="w-4 h-4" />;
      case 'Role-Based Analysis': return <Users className="w-4 h-4" />;
      case 'Percentage Analysis': return <TrendingUp className="w-4 h-4" />;
      case 'Numerical Analysis': return <BarChart3 className="w-4 h-4" />;
      case 'Comparative Analysis': return <TrendingUp className="w-4 h-4" />;
      case 'Advanced Analysis': return <AlertTriangle className="w-4 h-4" />;
      case 'Benchmarking Analysis': return <BarChart3 className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Time-Based Analysis': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Role-Based Analysis': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Percentage Analysis': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Numerical Analysis': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Comparative Analysis': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Advanced Analysis': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'Benchmarking Analysis': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Benchmarking Query Patterns Guide</h2>
        <p className="text-muted-foreground">
          Learn how to use natural language queries to analyze productivity data and generate insights
        </p>
      </div>

      <Tabs defaultValue="patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="patterns">Query Patterns</TabsTrigger>
          <TabsTrigger value="examples">Quick Examples</TabsTrigger>
          <TabsTrigger value="tips">Tips & Best Practices</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patterns by keyword, category, or example..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="grid gap-4">
            {filteredPatterns.map((pattern, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(pattern.category)}
                      <CardTitle className="text-lg">{pattern.name}</CardTitle>
                    </div>
                    <Badge className={getCategoryColor(pattern.category)}>
                      {pattern.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{pattern.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Example Queries:</h4>
                    <div className="grid gap-2">
                      {pattern.examples.map((example, exIndex) => (
                        <div key={exIndex} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                          <span className="font-mono">{example}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(example)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedExample === example ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">Expected Output:</h4>
                    <p className="text-sm text-muted-foreground">{pattern.expectedOutput}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">Key Keywords:</h4>
                    <div className="flex flex-wrap gap-1">
                      {pattern.keywords.map((keyword, kIndex) => (
                        <Badge key={kIndex} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Examples</CardTitle>
              <p className="text-sm text-muted-foreground">
                Copy these examples directly into the benchmarking query box to get started
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(usageExamples).map(([key, example]) => (
                <div key={key} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                      <p className="text-sm font-mono text-muted-foreground mt-1">{example}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(example)}
                    >
                      {copiedExample === example ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tips & Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium">Natural Language Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    The system understands natural language queries. You don't need to use exact syntax - 
                    phrases like "show me", "display", "find users who" all work the same way.
                  </p>
                </div>
                
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium">Time-Based Queries</h4>
                  <p className="text-sm text-muted-foreground">
                    Use natural time expressions like "last month", "this week", "previous month". 
                    The system will automatically recalculate all metrics for that time period.
                  </p>
                </div>
                
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-medium">Role-Based Filtering</h4>
                  <p className="text-sm text-muted-foreground">
                    Role queries will only show users you have permission to see. Managers see their teams, 
                    admins see all users, and regular users see only their own data.
                  </p>
                </div>
                
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-medium">Percentage Queries</h4>
                  <p className="text-sm text-muted-foreground">
                    Use percentage queries to find performance outliers. For example, "users who surpassed 
                    hours by more than 20%" finds users whose actual work significantly exceeded estimates.
                  </p>
                </div>
                
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-medium">Combining Patterns</h4>
                  <p className="text-sm text-muted-foreground">
                    You can combine multiple concepts in one query. For example, "managers who worked 
                    more than 40 hours last week" combines role-based, numerical, and time-based patterns.
                  </p>
                </div>
                
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h4 className="font-medium">Query Troubleshooting</h4>
                  <p className="text-sm text-muted-foreground">
                    If a query doesn't work as expected, try using simpler language or breaking it into 
                    smaller parts. The system works best with clear, focused queries.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};