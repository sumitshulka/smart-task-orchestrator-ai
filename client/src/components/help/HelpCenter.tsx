import React, { useState, useEffect } from 'react';
import { Search, BookOpen, MessageSquare, Play, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
          <div className="h-full flex flex-col lg:flex-row min-h-0">
            {/* Sidebar with contextual help - collapsible on mobile */}
            <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r p-4 lg:max-h-full overflow-hidden">
              <ScrollArea className="h-full max-h-64 lg:max-h-full">
                {/* Contextual help */}
                {contextualHelp.topics.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Help for this page
                    </h3>
                    <div className="space-y-2">
                      {contextualHelp.topics.map(topic => (
                        <Button
                          key={topic.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 text-left"
                          onClick={() => setSelectedTopic(topic)}
                        >
                          <div>
                            <div className="font-medium text-sm">{topic.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {topic.difficulty} • {topic.category}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick FAQs */}
                {contextualHelp.faqs.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Common Questions
                    </h3>
                    <div className="space-y-2">
                      {contextualHelp.faqs.map(faq => (
                        <Card key={faq.id} className="p-3">
                          <div className="font-medium text-sm mb-1">{faq.question}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{faq.answer}</div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div>
                  <h3 className="font-semibold mb-3">Categories</h3>
                  <div className="space-y-1">
                    {availableCategories.map(category => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "ghost"}
                        className="w-full justify-start text-xs sm:text-sm"
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setActiveTab('topics');
                        }}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Main content area */}
            <div className="flex-1 min-h-0 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3 m-4 flex-shrink-0">
                  <TabsTrigger value="topics">Topics</TabsTrigger>
                  <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
                  <TabsTrigger value="faqs">FAQs</TabsTrigger>
                </TabsList>

                <div className="px-4 pb-4 flex-1 min-h-0">
                  {/* Search Results */}
                  {searchQuery && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2">
                        Search Results ({searchResults.length})
                      </h3>
                      <ScrollArea className="h-32 sm:h-40">
                        <div className="space-y-2">
                          {searchResults.map((result, index) => (
                            <Card key={index} className="p-3 cursor-pointer hover:bg-muted/50">
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
                      </ScrollArea>
                    </div>
                  )}

                  <TabsContent value="topics" className="mt-0 flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="grid gap-4">
                        {filteredTopics.map(topic => (
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
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="scenarios" className="mt-0 flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="grid gap-4">
                        {filteredScenarios.map(scenario => (
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
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="faqs" className="mt-0 flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="grid gap-4">
                        {filteredFAQs.map(faq => (
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
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpCenter;