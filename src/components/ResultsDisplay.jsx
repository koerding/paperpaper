// File Path: src/components/ResultsDisplay.jsx
// Added data checks for missing sections, kept tooltip logs
'use client'

import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

// --- Helper Function to get Rule Title ---
const ruleTitles = {
    '1': 'Rule 1: Focus on a central contribution, communicate in the title',
    '2': 'Rule 2: Write for human beings who do not know your work',
    '3': 'Rule 3: Stick to the context-content-conclusion (C-C-C) scheme',
    '4': 'Rule 4: Optimize logical flow (avoid zig-zag, use parallelism)',
    '5': 'Rule 5: Tell a complete story in the abstract',
    '6': 'Rule 6: Communicate why the paper matters in the introduction',
    '7': 'Rule 7: Deliver results as a sequence of statements',
    '8': 'Rule 8: Discuss gap filled, limitations, and relevance',
    '9': 'Rule 9: Allocate time effectively (Title, Abstract, Figures, Outlining)',
    '10': 'Rule 10: Get feedback to reduce, reuse, and recycle',
};

const getRuleTitle = (ruleNum) => {
    console.log(`[getRuleTitle] Looking up rule number: "${ruleNum}" (type: ${typeof ruleNum})`);
    const title = ruleTitles[ruleNum];
    if (!title) {
        console.warn(`[getRuleTitle] No title found for rule number: "${ruleNum}"`);
    }
    return title || 'Unknown Rule';
};

// --- Component to render text with potential MnK tag and tooltip ---
const FeedbackText = ({ text }) => {
    if (!text || typeof text !== 'string') { return <span>{text || ''}</span>; }
    const match = text.match(/^MnK(\d{1,2}):?\s*/);
    if (match) {
        const ruleNum = match[1];
        const tagText = match[0];
        console.log(`[FeedbackText] Matched tag: "${tagText}", Extracted ruleNum: "${ruleNum}"`); // Keep log for tooltip debug
        const ruleTitle = getRuleTitle(ruleNum);
        const remainingText = text.substring(tagText.length);
        return (
            <>
                <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm text-xs mr-1 cursor-help whitespace-nowrap" title={`${ruleTitle}`}>MnK{ruleNum}</span>
                <span>{remainingText}</span>
            </>
        );
    }
    return <span>{text}</span>;
};


export default function ResultsDisplay({ results }) {
  const [activeTab, setActiveTab] = useState('analysis');

  // Log the received results prop structure on mount/update
  useEffect(() => {
     console.log("[ResultsDisplay] Received results prop:", results ? JSON.stringify(Object.keys(results)) : "null/undefined");
     if(results){
        console.log("[ResultsDisplay] has documentAssessment:", !!results.documentAssessment, "has overallRecommendations:", !!results.overallRecommendations);
     }
   }, [results]);

  if (!results) { return ( <div className="text-center p-8 border rounded-lg"><p className="text-muted-foreground">No results available</p></div>) }

  // --- Check for essential keys needed for rendering ---
  // We need at least some data to show anything meaningful below downloads
   const hasAnyResultsToShow = results.documentAssessment || results.overallRecommendations || results.majorIssues || results.statistics || results.abstract || results.sections;

  // Helper functions
  const getSeverityIcon = (severity) => { /* ... */ };
  const formatScore = (score) => { /* ... */ };
  const getScoreColor = (score) => { /* ... */ };
  const getScoreBarBgClass = (score) => { /* ... */ };


  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b"> <button onClick={() => setActiveTab('analysis')} className="px-4 py-2 border-b-2 border-primary font-medium">Paper Analysis</button> </div>

      {/* Download Links */}
      <div className="flex justify-between items-center flex-wrap gap-2">
         <h3 className="text-lg font-medium">Full Analysis Report</h3>
         <div className="flex space-x-2">
            {results.reportLinks && typeof results.reportLinks === 'object' && Object.entries(results.reportLinks).map(([key, url]) => (
                url && typeof url === 'string' && ( <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center ..."><Download className="h-4 w-4" /><span>{key.replace(/^\w/, c => c.toUpperCase())}</span></a> )
            ))}
         </div>
       </div>

       {/* Fallback if no results data is present at all */}
       {!hasAnyResultsToShow && (
            <div className="border rounded-lg p-6 bg-yellow-100 text-yellow-800 text-center">
               <p>Analysis data seems incomplete or missing.</p>
            </div>
       )}

      {/* Analysis Content - Render sections only if they have data */}
      <div className="space-y-6">

         {/* Document Assessment */}
         {/* Check if documentAssessment exists and is a non-empty object */}
         {results.documentAssessment && typeof results.documentAssessment === 'object' && Object.keys(results.documentAssessment).length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">Document Assessment</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6 p-4">
                {Object.entries(results.documentAssessment)
                 .filter(([key, assessment]) => assessment && typeof assessment === 'object') // Filter valid items
                 .map(([key, assessment]) => {
                     // ... rendering logic for each assessment item ...
                    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
                    const displayScore = formatScore(assessment.score);
                    const scoreColor = getScoreColor(displayScore);
                    const barBgClass = getScoreBarBgClass(displayScore);
                    return ( <div key={key} className="space-y-2"> ... </div> ); // Ensure this inner JSX is complete
                 })}
                </div>
            </div>
         ) : (
            console.log("[ResultsDisplay] Skipping Document Assessment render - data missing or empty.") // Log if skipped
         )}

         {/* Top Recommendations */}
         {/* Check if overallRecommendations exists and is a non-empty array */}
         {results.overallRecommendations && Array.isArray(results.overallRecommendations) && results.overallRecommendations.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">Top Recommendations</div>
                <div className="p-4 space-y-4">
                {results.overallRecommendations.map((recommendation, index) => (
                 recommendation && typeof recommendation === 'string' && ( <div key={index} className="flex space-x-3 items-start"> ... <p className="text-sm"><FeedbackText text={recommendation} /></p></div> )
                ))}
                </div>
            </div>
         ) : (
             console.log("[ResultsDisplay] Skipping Top Recommendations render - data missing or empty.") // Log if skipped
         )}

          {/* Major Document-Level Issues */}
          {/* Check if majorIssues exists and is a non-empty array */}
          {results.majorIssues && Array.isArray(results.majorIssues) && results.majorIssues.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2 font-medium text-destructive flex items-center space-x-2"><AlertTriangle className="h-5 w-5"/><span>Major Document-Level Issues</span></div>
              <div className="divide-y">
                {results.majorIssues.map((issue, index) => ( /* ... render issue using FeedbackText ... */ ))}
              </div>
            </div>
          ) : (
             console.log("[ResultsDisplay] Skipping Major Issues render - data missing or empty.") // Log if skipped
          )}

         {/* Issues Statistics */}
         {/* Check if statistics exists */}
         {results.statistics && typeof results.statistics === 'object' ? (
            <div className="grid grid-cols-3 gap-4"> {/* ... stats ... */} </div>
         ) : (
            console.log("[ResultsDisplay] Skipping Statistics render - data missing.") // Log if skipped
         )}

         {/* Abstract Analysis */}
         {/* Check if abstract exists */}
         {results.abstract && typeof results.abstract === 'object' ? (
            <div className="border rounded-lg overflow-hidden"> {/* ... abstract content ... */} </div>
         ) : (
            console.log("[ResultsDisplay] Skipping Abstract render - data missing.") // Log if skipped
         )}

         {/* Sections Analysis */}
         {/* Check if sections exists and is a non-empty array */}
         {results.sections && Array.isArray(results.sections) && results.sections.length > 0 ? (
            results.sections.map((section, sectionIndex) => ( /* ... sections map ... */ ))
         ) : (
             console.log("[ResultsDisplay] Skipping Sections render - data missing or empty.") // Log if skipped
         )}
       </div>
    </div>
  )
}
