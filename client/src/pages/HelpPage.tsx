import React from 'react';
import { useLocation } from 'react-router-dom';
import HelpCenter from '@/components/help/HelpCenter';

const HelpPage: React.FC = () => {
  const location = useLocation();
  
  // Extract initial topic from query params if provided
  const searchParams = new URLSearchParams(location.search);
  const initialTopic = searchParams.get('topic');

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <HelpCenter initialTopic={initialTopic || undefined} />
      </div>
    </div>
  );
};

export default HelpPage;