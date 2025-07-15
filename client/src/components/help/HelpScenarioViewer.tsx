import React, { useState } from 'react';
import { ArrowLeft, Clock, Users, CheckCircle, Circle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { HelpScenario } from '@/types/help';
import useHelp from '@/hooks/useHelp';

interface HelpScenarioViewerProps {
  scenario: HelpScenario;
  onBack: () => void;
}

const HelpScenarioViewer: React.FC<HelpScenarioViewerProps> = ({ scenario, onBack }) => {
  const { completedTutorials, completeTutorial } = useHelp();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStepComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId]);
    }
  };

  const handleScenarioComplete = () => {
    completeTutorial(scenario.id);
  };

  const progress = (completedSteps.length / scenario.steps.length) * 100;

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
            <h1 className="text-xl sm:text-2xl font-bold truncate">{scenario.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm line-clamp-2">{scenario.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={getDifficultyColor(scenario.difficulty)}>
                {scenario.difficulty}
              </Badge>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {scenario.estimatedTime}
              </Badge>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="truncate">{scenario.roles.join(', ')}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span>{completedSteps.length} of {scenario.steps.length} steps</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full flex flex-col lg:flex-row">
          {/* Steps sidebar */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r p-4 lg:max-h-full overflow-hidden">
            <ScrollArea className="h-full max-h-64 lg:max-h-full">
              <div className="space-y-2">
                {scenario.steps.map((step, index) => (
                  <Card 
                    key={step.id} 
                    className={`cursor-pointer transition-colors ${
                      currentStep === index ? 'ring-2 ring-primary' : ''
                    } ${completedSteps.includes(step.id) ? 'bg-green-50' : ''}`}
                    onClick={() => setCurrentStep(index)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        {completedSteps.includes(step.id) ? (
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm truncate">{step.title}</CardTitle>
                          <div className="text-xs text-muted-foreground">
                            Step {index + 1} of {scenario.steps.length}
                          </div>
                        </div>
                        {currentStep === index && (
                          <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Current step content */}
          <div className="flex-1 p-4 sm:p-6 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
              {scenario.steps[currentStep] && (
                <div className="space-y-6 pr-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      {scenario.steps[currentStep].title}
                    </h2>
                    <p className="text-muted-foreground">
                      {scenario.steps[currentStep].description}
                    </p>
                  </div>

                  {/* Action */}
                  {scenario.steps[currentStep].action && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-blue-900">Action Required</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-blue-800">
                          {scenario.steps[currentStep].action}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tips */}
                  {scenario.steps[currentStep].tips && scenario.steps[currentStep].tips!.length > 0 && (
                    <Card className="bg-green-50 border-green-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-green-900">Tips</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1">
                          {scenario.steps[currentStep].tips!.map((tip, index) => (
                            <li key={index} className="text-sm text-green-800 flex items-start gap-2">
                              <span className="text-green-600 mt-0.5">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Warnings */}
                  {scenario.steps[currentStep].warnings && scenario.steps[currentStep].warnings!.length > 0 && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-yellow-900">Warnings</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1">
                          {scenario.steps[currentStep].warnings!.map((warning, index) => (
                            <li key={index} className="text-sm text-yellow-800 flex items-start gap-2">
                              <span className="text-yellow-600 mt-0.5">⚠</span>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Next steps */}
                  {scenario.steps[currentStep].nextSteps && scenario.steps[currentStep].nextSteps!.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Next Steps</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1">
                          {scenario.steps[currentStep].nextSteps!.map((nextStep, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-0.5">→</span>
                              {nextStep}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Step actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                      className="w-full sm:w-auto"
                    >
                      Previous
                    </Button>
                    
                    {!completedSteps.includes(scenario.steps[currentStep].id) && (
                      <Button
                        onClick={() => handleStepComplete(scenario.steps[currentStep].id)}
                        className="gap-2 w-full sm:w-auto"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Complete
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => setCurrentStep(Math.min(scenario.steps.length - 1, currentStep + 1))}
                      disabled={currentStep === scenario.steps.length - 1}
                      className="w-full sm:w-auto"
                    >
                      Next
                    </Button>

                    {completedSteps.length === scenario.steps.length && 
                     !completedTutorials.includes(scenario.id) && (
                      <Button
                        onClick={handleScenarioComplete}
                        className="gap-2 w-full sm:w-auto sm:ml-auto"
                        variant="default"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Complete Tutorial
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpScenarioViewer;