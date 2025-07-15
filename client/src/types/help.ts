export interface HelpTopic {
  id: string;
  title: string;
  content: string;
  category: string;
  role: string[];
  scenario: string[];
  context: string[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lastUpdated: string;
  relatedTopics: string[];
  videoUrl?: string;
  attachments?: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  roles: string[];
}

export interface HelpScenario {
  id: string;
  name: string;
  description: string;
  steps: HelpStep[];
  roles: string[];
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface HelpStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  tips?: string[];
  warnings?: string[];
  nextSteps?: string[];
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  roles: string[];
  popularity: number;
  lastUpdated: string;
  relatedTopics: string[];
}

export interface HelpContext {
  currentPage: string;
  userRole: string[];
  userTeams: string[];
  isFirstTime: boolean;
  completedTutorials: string[];
  preferences: {
    showTooltips: boolean;
    showWelcomeMessages: boolean;
    preferredHelpFormat: 'text' | 'video' | 'interactive';
  };
}

export interface HelpSearchResult {
  type: 'topic' | 'faq' | 'scenario';
  item: HelpTopic | FAQ | HelpScenario;
  relevanceScore: number;
  matchedTerms: string[];
}