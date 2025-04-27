// File Path: src/components/ResultsDisplay.jsx
// Addressed layout overflow and tooltip issue debugging
'use client'

import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

// --- Helper Function to get Rule Title ---
// Ensure keys are strings to match potential regex capture group type
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
    // Log the lookup attempt
    console.log(`[getRuleTitle] Looking up rule number: "${ruleNum}" (type: ${typeof ruleNum})`);
    const title = ruleTitles[ruleNum]; // Direct lookup using string key
    if (!title) {
        console.warn(`[getRuleTitle] No title found for rule number: "${ruleNum}"`);
    }
    return title || 'Unknown Rule'; // Return title or default
};

// --- Component to render text with potential MnK tag and tooltip ---
const FeedbackText = ({ text }) => {
    if (!text || typeof text !== 'string') {
        return <span>{text || ''}</span>;
    }
    // Regex looks for MnK, 1 or 2 digits, optional colon, optional space
    const match = text.match(/^MnK(\d{1,2}):?\s*/);
    if (match) {
        const ruleNum = match[1]; // Captured number (string)
        const tagText = match[0]; // The full tag matched (e.g., "MnK3: ")
        // Log extracted number for debugging tooltip issue
        console.log(`[FeedbackText] Matched tag: "${tagText}", Extracted ruleNum: "${ruleNum}"`);
        const ruleTitle = getRuleTitle(ruleNum); // Pass the string number
        const remainingText = text.substring(tagText.length);

        return (
            <>
                <span
                    className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm text-xs mr-1 cursor-help whitespace-nowrap" // Added whitespace-nowrap
                    title={`${ruleTitle}`} // HTML title attribute for tooltip
                >
                    MnK{ruleNum}
                </span>
                {/* Render remaining text, allow it to wrap */}
                <span>{remainingText}</span>
            </>
        );
    }
    // If no tag, render text as is
    return <span>{text}</span>;
};


export default function ResultsDisplay({ results }) {
  const [activeTab, setActiveTab] = useState('analysis');

   useEffect(() => {
       // console.log("[ResultsDisplay] Component mounted/updated.");
   }, [results]);

  if (!results) { return ( <div className="text-center p-8 border rounded-lg"><p className="text-muted-foreground">No results available</p></div>) }

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
      <div className="flex justify-between items-center flex-wrap gap-2"> <h3 className="text-lg font-medium">Full Analysis Report</h3> <div className="flex space-x-2">{/* ... links ... */}</div> </div>

      {/* Analysis Content */}
      <div className="space-y-6">

         {/* Document Assessment */}
         {/* This section seems okay layout-wise, no fixed heights */}
         <div className="border rounded-lg overflow-hidden"> <div className="bg-muted/30 px-4 py-2 font-medium">Document Assessment</div> <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6 p-4">{/* ... assessment items using FeedbackText ... */}</div> </div>

         {/* Top Recommendations */}
         {/* This section seems okay layout-wise */}
         <div className="border rounded-lg overflow-hidden"> <div className="bg-muted/30 px-4 py-2 font-medium">Top Recommendations</div> <div className="p-4 space-y-4">{/* ... recommendations using FeedbackText ... */}</div> </div>

          {/* Major Document-Level Issues */}
          {/* This section seems okay layout-wise */}
          {results.majorIssues && Array.isArray(results.majorIssues) && results.majorIssues.length > 0 && ( <div className="border rounded-lg overflow-hidden"> <div className="bg-destructive/10 ...">Major Document-Level Issues</div> <div className="divide-y">{/* ... major issues using FeedbackText ... */}</div> </div> )}

         {/* Issues Statistics */}
         {/* This section is fixed size, no overflow issues here */}
         <div className="grid grid-cols-3 gap-4">{/* ... stats ... */}</div>

         {/* Abstract Analysis */}
         {/* Ensure abstract text can wrap */}
         {results.abstract && typeof results.abstract === 'object' && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 font-medium">Abstract</div>
              <div className="p-4 space-y-4">
                {results.abstract.text && <p className="text-sm italic border-l-4 border-muted pl-4 py-2 bg-muted/10 rounded">{results.abstract.text}</p>}
                {results.abstract.summary && <div className="space-y-1"><p className="font-medium text-sm">Summary:</p><p className="text-sm">{results.abstract.summary}</p></div>}
                {results.abstract.issues && Array.isArray(results.abstract.issues) && results.abstract.issues.length > 0 && ( <div className="space-y-2 pt-2"><p className="font-medium text-sm">Issues Found:</p><div className="space-y-2">{/* ... abstract issues using FeedbackText ... */}</div></div> )}
              </div>
            </div>
          )}

         {/* --- Sections Analysis (Most likely place for cutoff) --- */}
          {results.sections && Array.isArray(results.sections) && results.sections.map((section, sectionIndex) => (
             section && typeof section === 'object' && section.name && Array.isArray(section.paragraphs) && (
               <div key={sectionIndex} className="border rounded-lg overflow-hidden"> {/* Ensure this container can grow */}
                 <div className="bg-muted/30 px-4 py-2 font-medium">{section.name}</div>
                 <div className="divide-y"> {/* Removes internal borders if they constrain height */}
                   {section.paragraphs.map((paragraph, paragraphIndex) => (
                     paragraph && typeof paragraph === 'object' && paragraph.text && (
                       // Removed fixed heights or overflow constraints from this div if any existed
                       <div key={paragraphIndex} className="p-4 space-y-3">
                          <div className="flex items-center space-x-2 mb-1"><FileText className="h-4 w-4 ..."/><p className="text-sm ...">Paragraph {paragraphIndex + 1}</p></div>
                          {/* Allow paragraph text to wrap and take space */}
                          <div className="text-sm leading-relaxed pl-6">{paragraph.text}</div>
                          {paragraph.summary && <div className="pl-6"><p className="font-medium ...">Summary:</p><p className="text-sm ...">{paragraph.summary}</p></div>}
                          {/* Structure Assessment - flex-wrap helps */}
                          {paragraph.evaluations && typeof paragraph.evaluations === 'object' && ( <div className="pl-6 pt-2"><p className="font-medium ...">Structure Assessment:</p><div className="flex flex-wrap gap-2"> {/* ... tags ... */} </div></div> )}
                          {/* Issues Found - Allow this block to grow */}
                          {paragraph.issues && Array.isArray(paragraph.issues) && paragraph.issues.length > 0 && (
                            <div className="pl-6 pt-2">
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Issues Found:</p>
                              {/* Ensure this inner div can grow */}
                              <div className="space-y-2 border-l-2 border-red-200 pl-3">
                                {paragraph.issues.map((issue, issueIndex) => (
                                   issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                                     <div key={issueIndex} className="flex items-start space-x-2 text-sm">
                                       {getSeverityIcon(issue.severity)}
                                       <div>
                                         <p className="font-medium"><FeedbackText text={issue.issue} /></p>
                                         <p className="text-xs text-muted-foreground"><FeedbackText text={issue.recommendation} /></p>
                                       </div>
                                     </div>
                                   )
                                ))}
                              </div>
                            </div>
                          )}
                       </div>
                     )
                   ))}
                 </div>
               </div>
             )
          ))}
       </div>
    </div>
  )
}
