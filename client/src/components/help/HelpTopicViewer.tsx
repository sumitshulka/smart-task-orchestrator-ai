import React from 'react';
import { ArrowLeft, Clock, Users, BookOpen, Tag, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { HelpTopic } from '@/types/help';
import useHelp from '@/hooks/useHelp';
import ReactMarkdown from 'react-markdown';

interface HelpTopicViewerProps {
  topic: HelpTopic;
  onBack: () => void;
}

const HelpTopicViewer: React.FC<HelpTopicViewerProps> = ({ topic, onBack }) => {
  const { getRelatedTopics, availableTopics } = useHelp();
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const relatedTopics = getRelatedTopics(topic.id);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{topic.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={getDifficultyColor(topic.difficulty)}>
                {topic.difficulty}
              </Badge>
              <Badge variant="outline">
                <BookOpen className="h-3 w-3 mr-1" />
                {topic.category}
              </Badge>
              <Badge variant="outline" className="hidden sm:flex">
                <Calendar className="h-3 w-3 mr-1" />
                {topic.lastUpdated}
              </Badge>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="truncate">{topic.role.join(', ')}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {topic.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full flex flex-col lg:flex-row">
          {/* Related topics sidebar */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r p-4 lg:max-h-full overflow-hidden">
            <ScrollArea className="h-full max-h-64 lg:max-h-full">
              <div className="space-y-6">
                {/* Context info */}
                <div>
                  <h3 className="font-semibold mb-3">Context</h3>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Scenarios:</span>
                      <div className="text-muted-foreground text-xs">
                        {topic.scenario.join(', ')}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Best used in:</span>
                      <div className="text-muted-foreground text-xs">
                        {topic.context.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Related topics */}
                {relatedTopics.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Related Topics</h3>
                    <div className="space-y-2">
                      {relatedTopics.map(relatedTopic => (
                        <Card key={relatedTopic.id} className="p-3 cursor-pointer hover:bg-muted/50">
                          <div className="font-medium text-sm truncate">{relatedTopic.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {relatedTopic.difficulty} • {relatedTopic.category}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick actions */}
                <div>
                  <h3 className="font-semibold mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Print this topic
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Share with team
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 sm:p-6 min-h-0">
            <ScrollArea className="h-full">
              <div className="prose prose-sm sm:prose max-w-none">
                <ReactMarkdown>{topic.content}</ReactMarkdown>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpTopicViewer;