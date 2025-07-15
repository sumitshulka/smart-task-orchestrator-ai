import React, { useState, useEffect } from 'react';
import { Search, BookOpen, MessageSquare, Play, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useHelp from '@/hooks/useHelp';
import HelpTopicViewer from './HelpTopicViewer';
import HelpScenarioViewer from './HelpScenarioViewer';
import HelpCategoryFilter from './HelpCategoryFilter';
import { HelpTopic, HelpScenario, FAQ } from '@/types/help';

interface HelpCenterProps {
  initialTopic?: string;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ initialTopic }) => {
  const {
    availableCategories,
    availableTopics,
    availableScenarios,
    availableFAQs,
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedCategory,
    setSelectedCategory,
    getContextualHelp,
    helpContext
  } = useHelp();

  const [activeTab, setActiveTab] = useState<string>('topics');
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<HelpScenario | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get contextual help for current page
  const contextualHelp = getContextualHelp();

  // Filter topics based on selected category
  const filteredTopics = selectedCategory
    ? availableTopics.filter(topic => topic.category === selectedCategory)
    : availableTopics;

  // Filter scenarios based on selected category
  const filteredScenarios = selectedCategory
    ? availableScenarios.filter(scenario => 
        availableCategories.find(cat => cat.id === selectedCategory)?.roles.some(role => 
          scenario.roles.includes(role)
        )
      )
    : availableScenarios;

  // Filter FAQs based on selected category
  const filteredFAQs = selectedCategory
    ? availableFAQs.filter(faq => faq.category === selectedCategory)
    : availableFAQs;

  // Handle initial topic selection
  useEffect(() => {
    if (initialTopic) {
      const topic = availableTopics.find(t => t.id === initialTopic);
      if (topic) {
        setSelectedTopic(topic);
        setActiveTab('topics');
      }
    }
  }, [initialTopic, availableTopics]);

  // Clear search and filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setShowFilters(false);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header with search and filters */}
      <div className="p-4 sm:p-6 border-b flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search help topics, FAQs, or scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            {(searchQuery || selectedCategory) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <HelpCategoryFilter
                categories={availableCategories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </CardContent>
          </Card>
        )}

        {/* Role and context info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Your role:</span>
            {helpContext.userRole.map(role => (
              <Badge key={role} variant="secondary" className="text-xs">
                {role}
              </Badge>
            ))}
          </div>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span className="truncate">Current page: {helpContext.currentPage}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {selectedTopic ? (
          <HelpTopicViewer
            topic={selectedTopic}
            onBack={() => setSelectedTopic(null)}
          />
        ) : selectedScenario ? (
          <HelpScenarioViewer
            scenario={selectedScenario}
            onBack={() => setSelectedScenario(null)}
          />
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {/* Compact header - hamburger menu style */}
            <div className="flex-shrink-0 p-2 border-b">
              <div className="flex items-center gap-2">
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topics">Topics</SelectItem>
                    <SelectItem value="scenarios">Scenarios</SelectItem>
                    <SelectItem value="faqs">FAQs</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? null : value)}>
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {availableCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Maximized content area */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Search Results */}
              {searchQuery && (
                <div className="mb-3">
                  <h3 className="font-medium text-sm mb-2">
                    Search Results ({searchResults.length})
                  </h3>
                  <div className="h-32 overflow-y-auto overflow-x-hidden">
                    <div className="space-y-2">
                      {searchResults.map((result, index) => (
                        <Card key={index} className="p-2 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {'title' in result.item ? result.item.title : 
                                 'question' in result.item ? result.item.question : result.item.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {result.type} • Relevance: {result.relevanceScore}
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                              {result.type}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Content sections */}
              {activeTab === "topics" && (
                <div className="space-y-2">
                      {filteredTopics.length > 0 ? (
                        filteredTopics.map(topic => (
                          <Card key={topic.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTopic(topic)}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base">{topic.title}</CardTitle>
                                  <CardDescription className="mt-1 line-clamp-2">
                                    {topic.content.substring(0, 150)}...
                                  </CardDescription>
                                </div>
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  <Badge variant="secondary" className="text-xs">
                                    {topic.difficulty}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {topic.category}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-muted-foreground">
                                <span>Updated: {topic.lastUpdated}</span>
                                <Separator orientation="vertical" className="h-3 hidden sm:block" />
                                <span className="truncate">{topic.tags.slice(0, 3).join(', ')}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Topics Available</h3>
                          <p className="text-muted-foreground mb-4">
                            {selectedCategory 
                              ? `No topics found for the "${availableCategories.find(cat => cat.id === selectedCategory)?.name}" category.`
                              : 'No help topics are available for your role at this time.'
                            }
                          </p>
                          <Button 
                            variant="outline" 
                            onClick={() => setSelectedCategory(null)}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Clear Filters
                          </Button>
                        </div>
                      )}
                </div>
              )}

              {activeTab === "scenarios" && (
                <div className="space-y-2">
                      {filteredScenarios.length > 0 ? (
                        filteredScenarios.map(scenario => (
                          <Card key={scenario.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedScenario(scenario)}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Play className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{scenario.name}</span>
                                  </CardTitle>
                                  <CardDescription className="mt-1 line-clamp-2">
                                    {scenario.description}
                                  </CardDescription>
                                </div>
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  <Badge variant="secondary" className="text-xs">
                                    {scenario.difficulty}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {scenario.estimatedTime}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="text-xs text-muted-foreground">
                                {scenario.steps.length} steps • {scenario.roles.join(', ')}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Scenarios Available</h3>
                          <p className="text-muted-foreground mb-4">
                            {selectedCategory 
                              ? `No step-by-step scenarios found for the "${availableCategories.find(cat => cat.id === selectedCategory)?.name}" category.`
                              : 'No guided scenarios are available for your role at this time.'
                            }
                          </p>
                          <Button 
                            variant="outline" 
                            onClick={() => setSelectedCategory(null)}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Clear Filters
                          </Button>
                        </div>
                      )}
                </div>
              )}

              {activeTab === "faqs" && (
                <div className="space-y-2">
                      {filteredFAQs.length > 0 ? (
                        filteredFAQs.map(faq => (
                          <Card key={faq.id}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base flex items-center gap-2 min-w-0">
                                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{faq.question}</span>
                                </CardTitle>
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {faq.popularity}% helpful
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm text-muted-foreground mb-3">{faq.answer}</p>
                              <div className="text-xs text-muted-foreground">
                                Updated: {faq.lastUpdated} • {faq.category}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No FAQs Available</h3>
                          <p className="text-muted-foreground mb-4">
                            {selectedCategory 
                              ? `No frequently asked questions found for the "${availableCategories.find(cat => cat.id === selectedCategory)?.name}" category.`
                              : 'No frequently asked questions are available for your role at this time.'
                            }
                          </p>
                          <Button 
                            variant="outline" 
                            onClick={() => setSelectedCategory(null)}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Clear Filters
                          </Button>
                        </div>
                      )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpCenter;