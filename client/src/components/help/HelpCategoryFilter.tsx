import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpCategory } from '@/types/help';
import { 
  Rocket, 
  CheckSquare, 
  Users, 
  Users2, 
  BarChart3, 
  Settings, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';

interface HelpCategoryFilterProps {
  categories: HelpCategory[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}

const HelpCategoryFilter: React.FC<HelpCategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange
}) => {
  const getIcon = (iconName: string) => {
    const icons = {
      'Rocket': Rocket,
      'CheckSquare': CheckSquare,
      'Users': Users,
      'Users2': Users2,
      'BarChart3': BarChart3,
      'Settings': Settings,
      'TrendingUp': TrendingUp,
      'AlertCircle': AlertCircle
    };
    
    const IconComponent = icons[iconName as keyof typeof icons] || CheckSquare;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Filter by Category:</span>
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => onCategoryChange(null)}
        >
          All
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {categories.map(category => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            className="justify-start h-auto p-3"
            onClick={() => onCategoryChange(category.id)}
          >
            <div className="flex items-center gap-3">
              {getIcon(category.icon)}
              <div className="text-left">
                <div className="font-medium text-sm">{category.name}</div>
                <div className="text-xs text-muted-foreground">
                  {category.description}
                </div>
              </div>
            </div>
          </Button>
        ))}
      </div>
      
      {selectedCategory && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <span>Showing content for:</span>
            <Badge variant="secondary">
              {categories.find(c => c.id === selectedCategory)?.name}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpCategoryFilter;