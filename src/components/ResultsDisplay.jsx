// File Path: src/components/ResultsDisplay.jsx
'use client'

import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

// --- Helper Function to get Rule Title ---
// Ideally, load this from rules.json, but hardcoding for simplicity now
// Make sure these numbers match the 'originalRuleNumber' in your rules files
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
    // Add more mappings if needed
};

const getRuleTitle = (ruleNum) => {
    return ruleTitles[ruleNum] || 'Unknown Rule';
};

// --- Component to render text with potential MnK tag and tooltip ---
const FeedbackText = ({ text }) => {
    if (!text || typeof text !== 'string') {
        return <span>{text || ''}</span>; // Return empty span or original if not string
    }

    const match = text.match(/^MnK(\d{1,2}):?\s*/); // Match MnK$, MnK$: with optional space
    if (match) {
        const ruleNum = match[1]; // The number part
        const ruleTitle = getRuleTitle(ruleNum);
        const remainingText = text.substring(match[0].length); // Text after the tag

        return (
            <>
                <span
                    className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm text-xs mr-1 cursor-help"
                    title={`${ruleTitle}`} // HTML title attribute for tooltip
                >
                    MnK{ruleNum}
                </span>
                {remainingText}
            </>
        );
    }
    // If no tag, render text as is
    return <span>{text}</span>;
};


export default function ResultsDisplay({ results }) {
  const [activeTab, setActiveTab] = useState('analysis'); // Keep state if needed for future tabs

   // Simple component mount log
   useEffect(() => {
       console.log("[ResultsDisplay] Component mounted with results:", results ? "Yes" : "No");
   }, [results]);


  if (!results) {
    return (
        <div className="text-center p-8 border rounded-lg">
            <p className="text-muted-foreground">No results available</p>
        </div>
        )
  }

  // Helper functions (ensure these are defined correctly)
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'major': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'minor': return <AlertCircle className="h-5 w-5 text-blue-500" />;
      default: return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };
  const formatScore = (score) => {
    const numScore = Number(score);
    if (isNaN(numScore)) return '—';
    const boundedScore = Math.max(0, Math.min(10, numScore));
    return boundedScore;
   };
  const getScoreColor = (score) => {
    const numScore = Number(score);
    if (isNaN(numScore)) return 'text-muted-foreground';
    if (numScore >= 8) return 'text-green-600';
    if (numScore >= 6) return 'text-yellow-600';
    return 'text-destructive';
   };
  const getScoreBarBgClass = (score) => {
    const numScore = Number(score);
    if (isNaN(numScore)) return 'bg-muted';
    if (numScore >= 8) return 'bg-green-500';
    if (numScore >= 6) return 'bg-yellow-500';
    return 'bg-destructive';
   };


  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('analysis')}
          className="px-4 py-2 border-b-2 border-primary font-medium"
        >
          Paper Analysis
        </button>
      </div>

      {/* Download Links */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-medium">Full Analysis Report</h3>
        <div className="flex space-x-2">
          {results.reportLinks && typeof results.reportLinks === 'object' && Object.entries(results.reportLinks).map(([key, url]) => (
             url && typeof url === 'string' && (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>{key.replace(/^\w/, c => c.toUpperCase())}</span>
                </a>
             )
          ))}
        </div>
      </div>

      {/* Analysis Content */}
      <div className="space-y-6">

        {/* Document Assessment */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 font-medium">Document Assessment</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6 p-4">
            {results.documentAssessment && typeof results.documentAssessment === 'object' && Object.entries(results.documentAssessment)
             .filter(([key, assessment]) => assessment && typeof assessment === 'object')
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
                    {/* Use FeedbackText for assessment */}
                    {assessment.assessment && (
                      <p className="text-xs text-muted-foreground pt-1">
                        <FeedbackText text={assessment.assessment} />
                      </p>
                    )}
                    {/* Use FeedbackText for recommendation */}
                     {assessment.recommendation && (
                       <p className="text-xs text-blue-600 pt-1">
                         <span className='italic mr-1'>Recommend:</span><FeedbackText text={assessment.recommendation} />
                       </p>
                     )}
                  </div>
                )
             })}
          </div>
        </div>

        {/* Top Recommendations */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 font-medium">Top Recommendations</div>
          <div className="p-4 space-y-4">
            {results.overallRecommendations && Array.isArray(results.overallRecommendations) && results.overallRecommendations.length > 0 ? (
                results.overallRecommendations.map((recommendation, index) => (
                 recommendation && typeof recommendation === 'string' && (
                    <div key={index} className="flex space-x-3 items-start">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">{index + 1}</div>
                      </div>
                      {/* Use FeedbackText for recommendation */}
                      <p className="text-sm"><FeedbackText text={recommendation} /></p>
                    </div>
                 )
                ))
            ) : ( <p className="text-sm text-muted-foreground px-4">No specific recommendations provided.</p> )}
          </div>
        </div>

         {/* Major Document-Level Issues */}
         {results.majorIssues && Array.isArray(results.majorIssues) && results.majorIssues.length > 0 && (
           <div className="border rounded-lg overflow-hidden">
             <div className="bg-destructive/10 px-4 py-2 font-medium text-destructive flex items-center space-x-2">
                 <AlertTriangle className="h-5 w-5"/><span>Major Document-Level Issues</span>
             </div>
             <div className="divide-y">
               {results.majorIssues.map((issue, index) => (
                 issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                    <div key={index} className="p-4 space-y-1">
                      <div className="flex items-start space-x-2">
                        {getSeverityIcon(issue.severity)}
                        <div>
                          {/* Use FeedbackText for issue */}
                          <p className="font-medium"><FeedbackText text={issue.issue} /></p>
                          {issue.location && (<p className="text-xs text-muted-foreground uppercase tracking-wide">Location: {issue.location}</p>)}
                        </div>
                      </div>
                      {/* Use FeedbackText for recommendation */}
                      <p className="pl-7 text-sm text-muted-foreground"><FeedbackText text={issue.recommendation} /></p>
                    </div>
                 )
               ))}
             </div>
           </div>
         )}

        {/* --- Issues Statistics (Corrected Ternary) --- */}
        <div className="grid grid-cols-3 gap-4">
          {results.statistics && typeof results.statistics === 'object' ? (
            // *** TRUE Branch: Render the statistics blocks ***
            <>
              <div className="border rounded-lg p-4 text-center space-y-1 bg-red-50/50">
                <span className="text-3xl font-bold text-destructive">
                  {results.statistics.critical ?? 0}
                </span>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </div>
              <div className="border rounded-lg p-4 text-center space-y-1 bg-yellow-50/50">
                <span className="text-3xl font-bold text-yellow-500">
                  {results.statistics.major ?? 0}
                </span>
                <p className="text-sm text-muted-foreground">Major Issues</p>
              </div>
              <div className="border rounded-lg p-4 text-center space-y-1 bg-blue-50/50">
                <span className="text-3xl font-bold text-blue-500">
                  {results.statistics.minor ?? 0}
                </span>
                <p className="text-sm text-muted-foreground">Minor Issues</p>
              </div>
            </>
          ) : (
            // *** FALSE Branch: Render the fallback message ***
             <div className="col-span-3 text-center text-muted-foreground text-sm p-4 border rounded-lg">
                 Issue statistics not available.
             </div>
          )}
        </div>
        {/* --- End Issues Statistics --- */}


        {/* Abstract Analysis */}
         {results.abstract && typeof results.abstract === 'object' && (
           <div className="border rounded-lg overflow-hidden">
             <div className="bg-muted/30 px-4 py-2 font-medium">Abstract</div>
             <div className="p-4 space-y-4">
               {results.abstract.text && (
                 <p className="text-sm italic border-l-4 border-muted pl-4 py-2 bg-muted/10 rounded">
                   {results.abstract.text}
                 </p>
               )}
               {results.abstract.summary && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Summary:</p>
                    <p className="text-sm">{results.abstract.summary}</p>
                  </div>
               )}
               {results.abstract.issues && Array.isArray(results.abstract.issues) && results.abstract.issues.length > 0 && (
                 <div className="space-y-2 pt-2">
                   <p className="font-medium text-sm">Issues Found:</p>
                   <div className="space-y-2">
                     {results.abstract.issues.map((issue, index) => (
                        issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                          <div key={index} className="flex items-start space-x-2">
                            {getSeverityIcon(issue.severity)}
                            <div>
                              {/* Use FeedbackText for issue and recommendation */}
                              <p className="text-sm"><FeedbackText text={issue.issue} /></p>
                              <p className="text-xs text-muted-foreground"><FeedbackText text={issue.recommendation} /></p>
                            </div>
                          </div>
                        )
                     ))}
                   </div>
                 </div>
               )}
             </div>
           </div>
         )}

        {/* Sections Analysis */}
         {results.sections && Array.isArray(results.sections) && results.sections.map((section, sectionIndex) => (
            section && typeof section === 'object' && section.name && Array.isArray(section.paragraphs) && (
              <div key={sectionIndex} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">{section.name}</div>
                <div className="divide-y">
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    paragraph && typeof paragraph === 'object' && paragraph.text && (
                      <div key={paragraphIndex} className="p-4 space-y-3">
                         <div className="flex items-center space-x-2 mb-1">
                           <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                           <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Paragraph {paragraphIndex + 1}</p>
                         </div>

                         <div className="text-sm leading-relaxed pl-6">
                           {paragraph.text}
                         </div>

                         {paragraph.summary && (
                           <div className="pl-6">
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-1">Summary:</p>
                              <p className="text-sm italic text-muted-foreground">{paragraph.summary}</p>
                           </div>
                         )}

                         {paragraph.evaluations && typeof paragraph.evaluations === 'object' && (
                            <div className="pl-6 pt-2">
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Structure Assessment:</p>
                              <div className="flex flex-wrap gap-2">
                                {/* ... structure assessment tags ... */}
                                 <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${ paragraph.evaluations.cccStructure ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>C-C-C Structure: {paragraph.evaluations.cccStructure ? '✓' : '✗'}</div>
                                 <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${ paragraph.evaluations.sentenceQuality ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>Sentence Quality: {paragraph.evaluations.sentenceQuality ? '✓' : '✗'}</div>
                                 <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${ paragraph.evaluations.topicContinuity ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>Topic Continuity: {paragraph.evaluations.topicContinuity ? '✓' : '✗'}</div>
                                 <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${ paragraph.evaluations.terminologyConsistency ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>Terminology: {paragraph.evaluations.terminologyConsistency ? '✓' : '✗'}</div>
                                 <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${ paragraph.evaluations.structuralParallelism ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>Parallelism: {paragraph.evaluations.structuralParallelism ? '✓' : '✗'}</div>
                              </div>
                            </div>
                         )}

                         {paragraph.issues && Array.isArray(paragraph.issues) && paragraph.issues.length > 0 && (
                           <div className="pl-6 pt-2">
                             <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Issues Found:</p>
                             <div className="space-y-2 border-l-2 border-red-200 pl-3">
                               {paragraph.issues.map((issue, issueIndex) => (
                                  issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                                    <div key={issueIndex} className="flex items-start space-x-2 text-sm">
                                      {getSeverityIcon(issue.severity)}
                                      <div>
                                        {/* Use FeedbackText for issue and recommendation */}
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
  );
}
