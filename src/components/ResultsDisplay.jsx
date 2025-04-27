// File Path: src/components/ResultsDisplay.jsx
'use client'

import { useState } from 'react'
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'

export default function ResultsDisplay({ results }) {
  const [activeTab, setActiveTab] = useState('analysis')

  if (!results) {
    return (
      <div className="text-center p-8 border rounded-lg">
        <p className="text-muted-foreground">No results available</p>
      </div>
    )
  }

  // Helper function to determine severity icon
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-destructive" />
      case 'major':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'minor':
        return <AlertCircle className="h-5 w-5 text-blue-500" />
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />
    }
  }

  // Format score for display
  const formatScore = (score) => {
    const numScore = Number(score)
    if (isNaN(numScore)) return '—'
    // Ensure score is within 0-10 range for display consistency
    const boundedScore = Math.max(0, Math.min(10, numScore));
    return boundedScore;
  }

  // Get color for score
  const getScoreColor = (score) => {
    const numScore = Number(score)
    if (isNaN(numScore)) return 'text-muted-foreground'
    if (numScore >= 8) return 'text-green-600'
    if (numScore >= 6) return 'text-yellow-600'
    return 'text-destructive'
  }

  // Get background color class for score bar
   const getScoreBarBgClass = (score) => {
    const numScore = Number(score);
    if (isNaN(numScore)) return 'bg-muted'; // Default grey for invalid scores
    if (numScore >= 8) return 'bg-green-500';
    if (numScore >= 6) return 'bg-yellow-500';
    return 'bg-destructive';
   };


  return (
    <div className="space-y-6">
      {/* Tab Navigation - Simplified to just Analysis tab */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('analysis')}
          className="px-4 py-2 border-b-2 border-primary font-medium" // Always active look
        >
          Paper Analysis
        </button>
      </div>

      {/* Download Links */}
      <div className="flex justify-between items-center flex-wrap gap-2"> {/* Added flex-wrap and gap */}
        <h3 className="text-lg font-medium">Full Analysis Report</h3>
        <div className="flex space-x-2">
          {/* Ensure reportLinks exists and is an object before mapping */}
          {results.reportLinks && typeof results.reportLinks === 'object' && Object.entries(results.reportLinks).map(([key, url]) => (
             url && typeof url === 'string' && ( // Check if url is valid string
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors" // Added inline-flex and transition
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

        {/* --- MODIFIED Document Assessment Section --- */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 font-medium">Document Assessment</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6 p-4"> {/* Increased gap-y */}
            {/* Ensure documentAssessment exists and is an object */}
            {results.documentAssessment && typeof results.documentAssessment === 'object' && Object.entries(results.documentAssessment)
             // Filter out any potential null/undefined assessment objects
             .filter(([key, assessment]) => assessment && typeof assessment === 'object')
             .map(([key, assessment]) => {
                // Format the key for display (e.g., titleQuality -> Title Quality)
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
                const displayScore = formatScore(assessment.score); // Use formatted score (0-10)
                const scoreColor = getScoreColor(displayScore);
                const barBgClass = getScoreBarBgClass(displayScore);

                return (
                  <div key={key} className="space-y-2"> {/* Increased space-y */}
                    <div className="flex justify-between items-baseline"> {/* Use items-baseline for alignment */}
                      <span className="text-sm font-medium text-muted-foreground"> {/* Made key font-medium */}
                        {formattedKey}
                      </span>
                      <span className={`font-bold text-lg ${scoreColor}`}> {/* Made score bigger/bold */}
                        {displayScore}/10
                      </span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2.5 overflow-hidden"> {/* Made bar slightly thicker */}
                      <div
                        className={`h-2.5 rounded-full ${barBgClass} transition-all duration-500 ease-out`} // Added transition
                        style={{ width: `${displayScore * 10}%` }}
                      ></div>
                    </div>
                    {/* Display the assessment text below the bar */}
                    {assessment.assessment && (
                      <p className="text-xs text-muted-foreground pt-1"> {/* Added padding-top */}
                        {assessment.assessment}
                      </p>
                    )}
                     {/* Optionally display recommendation too */}
                     {/*
                     {assessment.recommendation && (
                       <p className="text-xs text-blue-600 pt-1">
                         Recommendation: {assessment.recommendation}
                       </p>
                     )}
                     */}
                  </div>
                )
             })}
          </div>
        </div>
        {/* --- END MODIFIED Document Assessment Section --- */}


        {/* Top Recommendations */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 font-medium">Top Recommendations</div>
          <div className="p-4 space-y-4">
            {/* Check if overallRecommendations exists and is an array */}
            {results.overallRecommendations && Array.isArray(results.overallRecommendations) && results.overallRecommendations.length > 0 ? (
                results.overallRecommendations.map((recommendation, index) => (
                 recommendation && typeof recommendation === 'string' && ( // Check if recommendation is valid string
                    <div key={index} className="flex space-x-3 items-start"> {/* Adjusted spacing/alignment */}
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground"> {/* Added font-medium */}
                          {index + 1}
                        </div>
                      </div>
                      <p className="text-sm">{recommendation}</p> {/* Ensure text size consistency */}
                    </div>
                 )
                ))
            ) : (
                <p className="text-sm text-muted-foreground px-4">No specific recommendations provided.</p>
            )}
          </div>
        </div>


         {/* Major Document-Level Issues (Using majorIssues array) */}
         {/* Check if majorIssues exists, is array, and has items */}
         {results.majorIssues && Array.isArray(results.majorIssues) && results.majorIssues.length > 0 && (
           <div className="border rounded-lg overflow-hidden">
             <div className="bg-destructive/10 px-4 py-2 font-medium text-destructive flex items-center space-x-2">
                 <AlertTriangle className="h-5 w-5"/>
                 <span>Major Document-Level Issues</span>
             </div>
             <div className="divide-y">
               {results.majorIssues.map((issue, index) => (
                 // Ensure issue is a valid object with expected properties
                 issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                    <div key={index} className="p-4 space-y-1">
                      <div className="flex items-start space-x-2">
                        {getSeverityIcon(issue.severity)}
                        <div>
                          <p className="font-medium">{issue.issue}</p>
                          {issue.location && (
                             <p className="text-xs text-muted-foreground uppercase tracking-wide">Location: {issue.location}</p>
                          )}
                        </div>
                      </div>
                      <p className="pl-7 text-sm text-muted-foreground">{issue.recommendation}</p>
                    </div>
                 )
               ))}
             </div>
           </div>
         )}


        {/* Issues Statistics */}
        <div className="grid grid-cols-3 gap-4">
          {/* Check if statistics exists and is an object */}
          {results.statistics && typeof results.statistics === 'object' ? (
            <>
              <div className="border rounded-lg p-4 text-center space-y-1 bg-red-50/50">
                <span className="text-3xl font-bold text-destructive">
                  {results.statistics.critical ?? 0} {/* Use nullish coalescing */}
                </span>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </div>
              <div className="border rounded-lg p-4 text-center space-y-1 bg-yellow-50/50">
                <span className="text-3xl font-bold text-yellow-500">
                  {results.statistics.major ?? 0} {/* Use nullish coalescing */}
                </span>
                <p className="text-sm text-muted-foreground">Major Issues</p>
              </div>
              <div className="border rounded-lg p-4 text-center space-y-1 bg-blue-50/50">
                <span className="text-3xl font-bold text-blue-500">
                  {results.statistics.minor ?? 0} {/* Use nullish coalescing */}
                </span>
                <p className="text-sm text-muted-foreground">Minor Issues</p>
              </div>
            </>
          ) : (
             <div className="col-span-3 text-center text-muted-foreground text-sm p-4 border rounded-lg">
                 Issue statistics not available.
             </div>
          )}
        </div>


        {/* Abstract Analysis */}
         {/* Check if abstract exists and is an object */}
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
               {/* Check if abstract issues exist and have items */}
               {results.abstract.issues && Array.isArray(results.abstract.issues) && results.abstract.issues.length > 0 && (
                 <div className="space-y-2 pt-2">
                   <p className="font-medium text-sm">Issues Found:</p>
                   <div className="space-y-2">
                     {results.abstract.issues.map((issue, index) => (
                        // Ensure issue is valid object
                        issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                          <div key={index} className="flex items-start space-x-2">
                            {getSeverityIcon(issue.severity)}
                            <div>
                              <p className="text-sm">{issue.issue}</p>
                              <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
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
         {/* Check if sections exists and is an array */}
         {results.sections && Array.isArray(results.sections) && results.sections.map((section, sectionIndex) => (
            // Ensure section is valid object with name and paragraphs array
            section && typeof section === 'object' && section.name && Array.isArray(section.paragraphs) && (
              <div key={sectionIndex} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 font-medium">{section.name}</div>
                <div className="divide-y"> {/* Use divide-y for paragraph separation */}
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    // Ensure paragraph is valid object with text
                    paragraph && typeof paragraph === 'object' && paragraph.text && (
                      <div key={paragraphIndex} className="p-4 space-y-3"> {/* Added space-y */}
                        <div className="flex items-center space-x-2 mb-1">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Paragraph {paragraphIndex + 1}</p> {/* Changed style */}
                        </div>

                        {/* Full paragraph text */}
                        <div className="text-sm leading-relaxed pl-6"> {/* Indent paragraph text */}
                          {paragraph.text}
                        </div>

                         {/* Summary */}
                        {paragraph.summary && (
                           <div className="pl-6">
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-1">Summary:</p>
                              <p className="text-sm italic text-muted-foreground">{paragraph.summary}</p>
                           </div>
                        )}


                        {/* Paragraph Structure Checks */}
                         {paragraph.evaluations && typeof paragraph.evaluations === 'object' && (
                            <div className="pl-6 pt-2">
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Structure Assessment:</p>
                              <div className="flex flex-wrap gap-2"> {/* Use flex-wrap for responsiveness */}
                                <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                                  paragraph.evaluations.cccStructure
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  C-C-C Structure: {paragraph.evaluations.cccStructure ? '✓' : '✗'}
                                </div>
                                <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                                  paragraph.evaluations.sentenceQuality
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Sentence Quality: {paragraph.evaluations.sentenceQuality ? '✓' : '✗'}
                                </div>
                                <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                                  paragraph.evaluations.topicContinuity
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Topic Continuity: {paragraph.evaluations.topicContinuity ? '✓' : '✗'}
                                </div>
                                <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                                  paragraph.evaluations.terminologyConsistency
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Terminology: {paragraph.evaluations.terminologyConsistency ? '✓' : '✗'}
                                </div>
                                <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                                  paragraph.evaluations.structuralParallelism
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Parallelism: {paragraph.evaluations.structuralParallelism ? '✓' : '✗'}
                                </div>
                              </div>
                            </div>
                         )}


                        {/* Paragraph Issues */}
                         {/* Check if paragraph issues exist and have items */}
                         {paragraph.issues && Array.isArray(paragraph.issues) && paragraph.issues.length > 0 && (
                           <div className="pl-6 pt-2">
                             <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Issues Found:</p>
                             <div className="space-y-2 border-l-2 border-red-200 pl-3"> {/* Use border and padding */}
                               {paragraph.issues.map((issue, issueIndex) => (
                                 // Ensure issue is valid object
                                  issue && typeof issue === 'object' && issue.issue && issue.severity && issue.recommendation && (
                                    <div key={issueIndex} className="flex items-start space-x-2 text-sm">
                                      {getSeverityIcon(issue.severity)}
                                      <div>
                                        <p className="font-medium">{issue.issue}</p>
                                        <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
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
