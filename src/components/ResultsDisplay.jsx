// File Path: src/components/ResultsDisplay.jsx
// Implemented CSS-based tooltip, removed title attribute
'use client'

import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
// Import the rules directly
import allRulesData from '@/rules.json'; // Adjust path if needed

// --- Build Rule Title Map Dynamically ---
const buildRuleMap = () => {
    const map = new Map();
    if (allRulesData?.rules && Array.isArray(allRulesData.rules)) {
        allRulesData.rules.forEach(rule => {
            if (rule.originalRuleNumber && rule.title) {
                map.set(String(rule.originalRuleNumber), rule.title);
            }
        });
        console.log('[ResultsDisplay] Built rule title map dynamically:', map.size, 'entries');
    } else {
        console.error('[ResultsDisplay] Failed to load or parse rules.json for tooltips.');
    }
    return map;
};
const ruleTitleMap = buildRuleMap(); // Build map once

const getRuleTitle = (ruleNum) => {
    const key = String(ruleNum);
    // console.log(`[getRuleTitle] Looking up rule number: "${key}" (type: ${typeof key})`); // Can comment out if logs are clean
    const title = ruleTitleMap.get(key);
    if (!title) {
        console.warn(`[getRuleTitle] No title found for rule number: "${key}" in dynamic map.`);
    }
    return title || 'Unknown Rule';
};

// --- Component to render text with potential MnK tag and CSS tooltip ---
const FeedbackText = ({ text }) => {
    if (!text || typeof text !== 'string') { return <span>{text || ''}</span>; }
    const match = text.match(/^MnK(\d{1,2}):?\s*/);
    if (match) {
        const ruleNum = match[1];
        const tagText = match[0];
        // console.log(`[FeedbackText] Matched tag: "${tagText}", Extracted ruleNum: "${ruleNum}"`); // Can comment out if logs are clean
        const ruleTitle = getRuleTitle(ruleNum);
        const remainingText = text.substring(tagText.length);

        return (
            <>
                {/* Tooltip Container */}
                <span className="relative inline-block group">
                    {/* The MnK Tag itself */}
                    <span
                        className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm text-xs mr-1 cursor-help whitespace-nowrap"
                        // Removed title={ruleTitle} attribute
                    >
                        MnK{ruleNum}
                    </span>
                    {/* The CSS Tooltip Span (Hidden by default, shown on hover) */}
                    <span className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 px-2 py-1
                                     text-xs leading-tight text-white whitespace-nowrap
                                     bg-gray-700 rounded-md shadow-sm
                                     opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        {ruleTitle}
                        {/* Optional: Add a little arrow */}
                        <svg className="absolute text-gray-700 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                    </span>
                </span>
                {' '} {/* Explicit space */}
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
     if(results){
        console.log("[ResultsDisplay] Checking data: DA keys:", results.documentAssessment ? Object.keys(results.documentAssessment) : 'N/A', "|| Recs count:", results.overallRecommendations?.length ?? 'N/A');
     }
   }, [results]);

  if (!results) { return ( <div className="text-center p-8 border rounded-lg"><p className="text-muted-foreground">No results available</p></div>) }

  const hasDisplayableData = results.documentAssessment || results.overallRecommendations || results.majorIssues || results.statistics || results.abstract || results.sections;

  // Helper functions
  const getSeverityIcon = (severity) => { /* ... implementation ... */ };
  const formatScore = (score) => { /* ... implementation ... */ };
  const getScoreColor = (score) => { /* ... implementation ... */ };
  const getScoreBarBgClass = (score) => { /* ... implementation ... */ };


  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b"> <button onClick={() => setActiveTab('analysis')} className="px-4 py-2 border-b-2 border-primary font-medium">Paper Analysis</button> </div>

      {/* Download Links */}
      <div className="flex justify-between items-center flex-wrap gap-2"> <h3 className="text-lg font-medium">Full Analysis Report</h3> <div className="flex space-x-2">{/* ... render links ... */}</div> </div>

       {/* Fallback */}
       {!hasDisplayableData && ( <div className="border rounded-lg p-6 bg-yellow-100 text-yellow-800 text-center"><p>Analysis data seems incomplete or missing.</p></div> )}

      {/* Analysis Content */}
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
                            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
                            const displayScore = formatScore(assessment.score);
                            const scoreColor = getScoreColor(displayScore);
                            const barBgClass = getScoreBarBgClass(displayScore);
                            return (
                              <div key={key} className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-sm font-medium text-muted-foreground">{formattedKey}</span>
                                  <span className={`font-bold text-lg ${scoreColor}`}>{displayScore}/10</span>
                                </div>
                                <div className="w-full bg-muted/30 rounded-full h-2.5 overflow-hidden">
                                  <div className={`h-2.5 rounded-full ${barBgClass} transition-all duration-500 ease-out`} style={{ width: `${displayScore * 10}%` }}></div>
                                </div>
                                {assessment.assessment && <p className="text-xs text-muted-foreground pt-1"><FeedbackText text={assessment.assessment} /></p>}
                                {assessment.recommendation && <p className="text-xs text-blue-600 pt-1"><span className='italic mr-1'>Recommend:</span><FeedbackText text={assessment.recommendation} /></p>}
                              </div>
                            );
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
                    {results.overallRecommendations.map((recommendation, index) => (
                         recommendation && typeof recommendation === 'string' && (
                             <div key={index} className="flex space-x-3 items-start">
                                 <div className="flex-shrink-0 mt-1"><div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">{index + 1}</div></div>
                                 <p className="text-sm"><FeedbackText text={recommendation} /></p>
                             </div>
                         )
                    ))}
                </div>
            </div>
         ) : null }

          {/* Major Document-Level Issues */}
          {results.majorIssues && Array.isArray(results.majorIssues) && results.majorIssues.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2 font-medium text-destructive flex items-center space-x-2"><AlertTriangle className="h-5 w-5"/><span>Major Document-Level Issues</span></div>
              <div className="divide-y">
                {results.majorIssues.map((issue, index) => {
                  if (!issue || typeof issue !== 'object' || !issue.issue || !issue.severity || !issue.recommendation) return null;
                  return (
                     <div key={index} className="p-4 space-y-1">
                       <div className="flex items-start space-x-2">
                         {getSeverityIcon(issue.severity)}
                         <div className='flex-grow'>
                           <p className="font-medium"><FeedbackText text={issue.issue} /></p>
                           {issue.location && (<p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">Location: {issue.location}</p>)}
                         </div>
                       </div>
                       <p className="pl-7 text-sm text-muted-foreground"><FeedbackText text={issue.recommendation} /></p>
                     </div>
                  );
                })}
              </div>
            </div>
          ) : null }

         {/* Issues Statistics */}
         {results.statistics && typeof results.statistics === 'object' ? (
             <div className="grid grid-cols-3 gap-4">
                 {/* ... Stats blocks ... */}
             </div>
         ) : null }

         {/* Abstract Analysis */}
         {results.abstract && typeof results.abstract === 'object' ? (
             <div className="border rounded-lg overflow-hidden">
                 {/* ... Abstract header/content ... */}
                 {results.abstract.issues && Array.isArray(results.abstract.issues) && results.abstract.issues.length > 0 && (
                     <div className="space-y-2 pt-2">
                         <p className="font-medium text-sm">Issues Found:</p>
                         <div className="space-y-2">
                            {/* Abstract Issues Map */}
                         </div>
                     </div>
                  )}
             </div>
          ) : null }

         {/* Sections Analysis */}
          {results.sections && Array.isArray(results.sections) && results.sections.length > 0 ? (
             results.sections.map((section, sectionIndex) => {
                /* ... Section map ... */
               return (
                 <div key={sectionIndex} className="border rounded-lg overflow-hidden">
                     {/* ... Section header ... */}
                     <div className="divide-y">
                       {section.paragraphs.map((paragraph, paragraphIndex) => {
                         /* ... Paragraph map ... */
                         return (
                           <div key={paragraphIndex} className="p-4 space-y-3">
                              {/* ... Paragraph details ... */}
                              {paragraph.issues && Array.isArray(paragraph.issues) && paragraph.issues.length > 0 && (
                                <div className="pl-6 pt-2">
                                  <p className="font-medium ...">Issues Found:</p>
                                  <div className="space-y-2 border-l-2 border-red-200 pl-3">
                                    {paragraph.issues.map((issue, issueIndex) => {
                                       /* ... Paragraph Issue map ... */
                                       return (
                                         <div key={issueIndex} className="flex items-start space-x-2 text-sm">
                                           {getSeverityIcon(issue.severity)}
                                           <div className='flex-grow'>
                                             <p className="font-medium"><FeedbackText text={issue.issue} /></p>
                                             <p className="text-xs text-muted-foreground"><FeedbackText text={issue.recommendation} /></p>
                                           </div>
                                         </div>
                                       );
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
