import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import HelpCenter from './HelpCenter';

interface HelpButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  contextualTopic?: string;
}

const HelpButton: React.FC<HelpButtonProps> = ({ 
  variant = 'ghost', 
  size = 'sm', 
  showText = false,
  contextualTopic
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <HelpCircle className="h-4 w-4" />
          {showText && 'Help'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[80vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Help Center</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <HelpCenter initialTopic={contextualTopic} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpButton;