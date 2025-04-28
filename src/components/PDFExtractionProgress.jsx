// components/PDFExtractionProgress.jsx
'use client'

import React from 'react';

export default function PDFExtractionProgress({ current, total, isComplete }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Extracting PDF text...</span>
        <span>{isComplete ? 'Complete!' : `${current} of ${total} pages (${percentage}%)`}</span>
      </div>
      
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-primary'}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
