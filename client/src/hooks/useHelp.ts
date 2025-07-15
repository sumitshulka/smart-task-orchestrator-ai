import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentUserRoleAndTeams } from './useCurrentUserRoleAndTeams';
import { HelpTopic, HelpCategory, HelpScenario, FAQ, HelpContext, HelpSearchResult } from '@/types/help';
import { helpTopics, helpCategories, helpScenarios, helpFAQs } from '@/data/helpData';

export const useHelp = () => {
  const location = useLocation();
  const { roles, teams } = useCurrentUserRoleAndTeams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);
  const [preferences, setPreferences] = useState({
    showTooltips: true,
    showWelcomeMessages: true,
    preferredHelpFormat: 'text' as const
  });

  // Build help context
  const helpContext: HelpContext = useMemo(() => ({
    currentPage: location.pathname,
    userRole: roles,
    userTeams: teams.map(t => t.id),
    isFirstTime: completedTutorials.length === 0,
    completedTutorials,
    preferences
  }), [location.pathname, roles, teams, completedTutorials, preferences]);

  // Filter content based on user role
  const getFilteredContent = <T extends { roles?: string[]; role?: string[] }>(
    items: T[]
  ): T[] => {
    return items.filter(item => {
      const itemRoles = item.roles || item.role || [];
      return itemRoles.length === 0 || itemRoles.some(role => roles.includes(role));
    });
  };

  // Get categories for current user
  const availableCategories = useMemo(() => 
    getFilteredContent(helpCategories).sort((a, b) => a.order - b.order),
    [roles]
  );

  // Get topics for current user
  const availableTopics = useMemo(() => 
    getFilteredContent(helpTopics),
    [roles]
  );

  // Get scenarios for current user
  const availableScenarios = useMemo(() => 
    getFilteredContent(helpScenarios),
    [roles]
  );

  // Get FAQs for current user
  const availableFAQs = useMemo(() => 
    getFilteredContent(helpFAQs).sort((a, b) => b.popularity - a.popularity),
    [roles]
  );

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: HelpSearchResult[] = [];

    // Search topics
    availableTopics.forEach(topic => {
      const titleMatch = topic.title.toLowerCase().includes(query);
      const contentMatch = topic.content.toLowerCase().includes(query);
      const tagMatch = topic.tags.some(tag => tag.toLowerCase().includes(query));
      
      if (titleMatch || contentMatch || tagMatch) {
        const relevanceScore = (titleMatch ? 3 : 0) + (contentMatch ? 2 : 0) + (tagMatch ? 1 : 0);
        results.push({
          type: 'topic',
          item: topic,
          relevanceScore,
          matchedTerms: [query]
        });
      }
    });

    // Search FAQs
    availableFAQs.forEach(faq => {
      const questionMatch = faq.question.toLowerCase().includes(query);
      const answerMatch = faq.answer.toLowerCase().includes(query);
      
      if (questionMatch || answerMatch) {
        const relevanceScore = (questionMatch ? 3 : 0) + (answerMatch ? 2 : 0);
        results.push({
          type: 'faq',
          item: faq,
          relevanceScore,
          matchedTerms: [query]
        });
      }
    });

    // Search scenarios
    availableScenarios.forEach(scenario => {
      const nameMatch = scenario.name.toLowerCase().includes(query);
      const descMatch = scenario.description.toLowerCase().includes(query);
      const stepMatch = scenario.steps.some(step => 
        step.title.toLowerCase().includes(query) || 
        step.description.toLowerCase().includes(query)
      );
      
      if (nameMatch || descMatch || stepMatch) {
        const relevanceScore = (nameMatch ? 3 : 0) + (descMatch ? 2 : 0) + (stepMatch ? 1 : 0);
        results.push({
          type: 'scenario',
          item: scenario,
          relevanceScore,
          matchedTerms: [query]
        });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [searchQuery, availableTopics, availableFAQs, availableScenarios]);

  // Get contextual help for current page
  const getContextualHelp = () => {
    const currentPage = location.pathname;
    const contextualTopics = availableTopics.filter(topic => 
      topic.context.some(ctx => currentPage.includes(ctx))
    );
    
    const contextualFAQs = availableFAQs.filter(faq => 
      faq.category === getPageCategory(currentPage)
    ).slice(0, 3);

    return { topics: contextualTopics, faqs: contextualFAQs };
  };

  // Get page category based on current route
  const getPageCategory = (pathname: string): string => {
    if (pathname.includes('/admin/users') || pathname.includes('/admin/roles')) return 'user-management';
    if (pathname.includes('/admin/teams')) return 'team-management';
    if (pathname.includes('/admin/settings')) return 'settings';
    if (pathname.includes('/admin/reports') || pathname.includes('/admin/analytics')) return 'reporting';
    if (pathname.includes('/tasks') || pathname.includes('/my-tasks')) return 'task-management';
    if (pathname.includes('/benchmarking')) return 'benchmarking';
    if (pathname.includes('/admin/dashboard') || pathname === '/') return 'getting-started';
    return 'getting-started';
  };

  // Get related topics
  const getRelatedTopics = (topicId: string): HelpTopic[] => {
    const topic = availableTopics.find(t => t.id === topicId);
    if (!topic) return [];
    
    return availableTopics.filter(t => 
      topic.relatedTopics.includes(t.id) || 
      (t.category === topic.category && t.id !== topicId)
    ).slice(0, 3);
  };

  // Tutorial completion
  const completeTutorial = (tutorialId: string) => {
    setCompletedTutorials(prev => [...prev, tutorialId]);
    localStorage.setItem('completedTutorials', JSON.stringify([...completedTutorials, tutorialId]));
  };

  // Load completed tutorials from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('completedTutorials');
    if (stored) {
      setCompletedTutorials(JSON.parse(stored));
    }
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('helpPreferences');
    if (stored) {
      setPreferences(JSON.parse(stored));
    }
  }, []);

  // Save preferences to localStorage
  const updatePreferences = (newPreferences: Partial<typeof preferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    localStorage.setItem('helpPreferences', JSON.stringify(updated));
  };

  return {
    // Data
    helpContext,
    availableCategories,
    availableTopics,
    availableScenarios,
    availableFAQs,
    
    // Search
    searchQuery,
    setSearchQuery,
    searchResults,
    
    // Filtering
    selectedCategory,
    setSelectedCategory,
    
    // Contextual help
    getContextualHelp,
    getRelatedTopics,
    
    // Tutorials
    completedTutorials,
    completeTutorial,
    
    // Preferences
    preferences,
    updatePreferences,
    
    // Utilities
    getPageCategory: () => getPageCategory(location.pathname)
  };
};

export default useHelp;