// File Path: src/components/ResultsDisplay.jsx
'use client'

import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

// --- Helper Function to get Rule Title ---
const ruleTitles = { /* ... rule titles map ... */ };
const getRuleTitle = (ruleNum) => { /* ... getRuleTitle function ... */ };

// --- FeedbackText Component ---
const FeedbackText = ({ text }) => { /* ... FeedbackText component ... */ };


export default function ResultsDisplay({ results }) {
  // **** ADD THIS LOG ****
  console.log('[ResultsDisplay RENDER] Component rendering started. Received results:', !!results);
  // **********************

  const [activeTab, setActiveTab] = useState('analysis');

   useEffect(() => {
       console.log("[ResultsDisplay] Component mounted/updated.");
   }, [results]); // Log when results prop changes


  if (!results) {
    // Log if results are missing when rendering
    console.log('[ResultsDisplay RENDER] No results prop provided, rendering empty state.');
    return (
      <div className="text-center p-8 border rounded-lg">
        <p className="text-muted-foreground">No results available</p>
      </div>
    )
  }

  // Rest of the component logic...
  const getSeverityIcon = (severity) => { /* ... */ };
  const formatScore = (score) => { /* ... */ };
  const getScoreColor = (score) => { /* ... */ };
  const getScoreBarBgClass = (score) => { /* ... */ };

  // Log right before returning the main JSX
  console.log('[ResultsDisplay RENDER] Returning main JSX structure.');

  return (
    // ... rest of the existing ResultsDisplay JSX ...
    // Make sure this JSX doesn't accidentally include <FileUploader /> or its summary!
    <div className="space-y-6">
        {/* Tab Nav */}
        {/* Download Links */}
        {/* Document Assessment */}
        {/* Top Recommendations */}
        {/* Major Issues */}
        {/* Statistics */}
        {/* Abstract */}
        {/* Sections */}
    </div>
  );
}
