// File Path: src/components/ResultsDisplay.jsx
// Uses dynamic import for rule titles, keeps tooltip logs
'use client'

import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
// Import the rules directly - ensure path is correct
// Using alias assuming it's set up, otherwise use relative path like '../../rules.json'
import allRulesData from '@/rules.json';

// --- Build Rule Title Map Dynamically ---
const buildRuleMap = () => {
    const map = new Map();
    if (allRulesData?.rules && Array.isArray(allRulesData.rules)) {
        allRulesData.rules.forEach(rule => {
            // Use originalRuleNumber (as string) as key, store title
            if (rule.originalRuleNumber && rule.title) {
                map.set(String(rule.originalRuleNumber), rule.title);
            }
        });
        console.log('[ResultsDisplay] Built rule title map dynamically:', map);
    } else {
        console.error('[ResultsDisplay] Failed to load or parse rules.json for tooltips.');
    }
    return map;
};
// Create the map instance once
const ruleTitleMap = buildRuleMap();

const getRuleTitle = (ruleNum) => {
    // Ensure ruleNum is treated as a string for map lookup
    const key = String(ruleNum);
    console.log(`[getRuleTitle] Looking up rule number: "${key}" (type: ${typeof key})`);
    const title = ruleTitleMap.get(key); // Use Map's get method
    if (!title) {
        console.warn(`[getRuleTitle] No title found for rule number: "${key}" in dynamic map.`);
    }
    return title || 'Unknown Rule';
};

// --- Component to render text with potential MnK tag and tooltip ---
const FeedbackText = ({ text }) => {
    if (!text || typeof text !== 'string') { return <span>{text || ''}</span>; }
    // Regex looks for MnK, 1 or 2 digits, optional colon, optional space
    const match = text.match(/^MnK(\d{1,2}):?\s*/);
    if (match) {
        const ruleNum = match[1]; // Captured number (string)
        const tagText = match[0];
        console.log(`[FeedbackText] Matched tag: "${tagText}", Extracted ruleNum: "${ruleNum}"`); // Keep log
        const ruleTitle = getRuleTitle(ruleNum);
        const remainingText = text.substring(tagText.length);
        return (
            <>
                <span
                    className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm text-xs mr-1 cursor-help whitespace-nowrap"
                    title={ruleTitle} // Use the looked-up title (or default)
                >
                    MnK{ruleNum}
                </span>
                <span>{remainingText}</span>
            </>
        );
    }
    return <span>{text}</span>;
};


export default function ResultsDisplay({ results }) {
  const [activeTab, setActiveTab] = useState('analysis');

  useEffect(() => {
     console.log("[ResultsDisplay] Received results prop keys:", results ? JSON.stringify(Object.keys(results)) : "null/undefined");
   }, [results]);

  if (!results) { return ( <div className="text-center p-8 border rounded-lg"><p className="text-muted-foreground">No results available</p></div>) }

  const hasAnyResultsToShow = results.documentAssessment || results.overallRecommendations || results.majorIssues || results.statistics || results.abstract || results.sections;

  // Helper functions (ensure these are defined/imported if used)
  const getSeverityIcon = (severity) => { /* ... implementation ... */ };
  const formatScore = (score) => { /* ... implementation ... */ };
  const getScoreColor = (score) => { /* ... implementation ... */ };
  const getScoreBarBgClass = (score) => { /* ... implementation ... */ };


  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b"> <button onClick={() => setActiveTab('analysis')} className="px-4 py-2 border-b-2 border-primary font-medium">Paper Analysis</button> </div>

      {/* Download Links */}
      <div className="flex justify-between items-center flex-wrap gap-2"> <h3 className="text-lg font-medium">Full Analysis Report</h3> <div className="flex space-x-2">{/* ... links ... */}</div> </div>

       {/* Fallback */}
       {!hasAnyResultsToShow && ( <div className="border rounded-lg p-6 bg-yellow-100 text-yellow-800 text-center"><p>Analysis data seems incomplete or missing.</p></div> )}

      {/* Analysis Content - Render sections only if they have data */}
      <div className="space-y-6">

         {/* Document Assessment */}
         {results.documentAssessment && typeof results.documentAssessment === 'object' && Object.keys(results.documentAssessment).length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">Document Assessment</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6 p-4">
                    {/* Map over assessment items */}
                    {Object.entries(results.documentAssessment)
                        .filter(([, assessment]) => assessment && typeof assessment === 'object')
                        .map(([key, assessment]) => {
                            // ... rendering logic using FeedbackText ...
                             const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
                             const displayScore = formatScore(assessment.score);
                             const scoreColor = getScoreColor(displayScore);
                             const barBgClass = getScoreBarBgClass(displayScore);
                             return ( <div key={key} className="space-y-2"> ... </div> ); // Ensure inner JSX uses FeedbackText
                        })
                    }
                </div>
            </div>
         ) : null }

         {/* Top Recommendations */}
         {results.overallRecommendations && Array.isArray(results.overallRecommendations) && results.overallRecommendations.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">Top Recommendations</div>
                <div className="p-4 space-y-4">
                    {/* Map over recommendations */}
                    {results.overallRecommendations.map((recommendation, index) => (
                        recommendation && typeof recommendation === 'string' && ( <div key={index} className="flex space-x-3 items-start"> ... <p className="text-sm"><FeedbackText text={recommendation} /></p></div> )
                    ))}
                </div>
            </div>
         ) : null }

          {/* Major Document-Level Issues */}
          {results.majorIssues && Array.isArray(results.majorIssues) && results.majorIssues.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2 font-medium text-destructive flex items-center space-x-2"><AlertTriangle className="h-5 w-5"/><span>Major Document-Level Issues</span></div>
              <div className="divide-y">
                 {/* Map over major issues */}
                 {results.majorIssues.map((issue, index) => {
                    if (!issue || typeof issue !== 'object' || !issue.issue || !issue.severity || !issue.recommendation) return null;
                    return ( <div key={index} className="p-4 space-y-1"> ... </div> ); // Ensure inner JSX uses FeedbackText
                 })}
              </div>
            </div>
          ) : null }

         {/* Issues Statistics */}
         {results.statistics && typeof results.statistics === 'object' ? (
             <div className="grid grid-cols-3 gap-4"> {/* ... stats ... */} </div>
         ) : null }

         {/* Abstract Analysis */}
         {results.abstract && typeof results.abstract === 'object' ? (
             <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">Abstract</div>
                <div className="p-4 space-y-4">
                    {/* ... abstract content ... */}
                    {results.abstract.issues && Array.isArray(results.abstract.issues) && results.abstract.issues.length > 0 && (
                         <div className="space-y-2 pt-2">
                            <p className="font-medium text-sm">Issues Found:</p>
                            <div className="space-y-2">
                                {/* Map over abstract issues */}
                                {results.abstract.issues.map((issue, index) => {
                                     if (!issue || typeof issue !== 'object' || !issue.issue || !issue.severity || !issue.recommendation) return null;
                                     return ( <div key={index} className="flex items-start space-x-2"> ... </div> ); // Ensure inner JSX uses FeedbackText
                                })}
                            </div>
                         </div>
                    )}
                </div>
             </div>
          ) : null }

         {/* Sections Analysis */}
          {results.sections && Array.isArray(results.sections) && results.sections.length > 0 ? (
             results.sections.map((section, sectionIndex) => {
               if (!section || typeof section !== 'object' || !section.name || !Array.isArray(section.paragraphs)) return null;
               return (
               <div key={sectionIndex} className="border rounded-lg overflow-hidden">
                 <div className="bg-muted/30 px-4 py-2 font-medium">{section.name}</div>
                 <div className="divide-y">
                   {section.paragraphs.map((paragraph, paragraphIndex) => {
                     if (!paragraph || typeof paragraph !== 'object' || !paragraph.text) return null;
                     return (
                       <div key={paragraphIndex} className="p-4 space-y-3">
                          {/* ... paragraph details ... */}
                          {paragraph.issues && Array.isArray(paragraph.issues) && paragraph.issues.length > 0 && (
                            <div className="pl-6 pt-2">
                              <p className="font-medium ...">Issues Found:</p>
                              <div className="space-y-2 border-l-2 border-red-200 pl-3">
                                 {/* Map over paragraph issues */}
                                 {paragraph.issues.map((issue, issueIndex) => {
                                   if (!issue || typeof issue !== 'object' || !issue.issue || !issue.severity || !issue.recommendation) return null;
                                   return ( <div key={issueIndex} className="flex items-start space-x-2 text-sm"> ... </div> ); // Ensure inner JSX uses FeedbackText
                                })}
                              </div>
                            </div>
                          )}
                       </div>
                     );
                   })}
                 </div>
               </div>
              );
            })
          ) : null }
       </div>
    </div>
  )
}
