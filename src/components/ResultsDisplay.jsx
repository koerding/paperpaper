'use client'

import { useState } from 'react'
import { Download, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'

export default function ResultsDisplay({ results }) {
  const [activeTab, setActiveTab] = useState('summary')
  
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
    return numScore
  }
  
  // Get color for score
  const getScoreColor = (score) => {
    const numScore = Number(score)
    if (isNaN(numScore)) return 'text-muted-foreground'
    if (numScore >= 8) return 'text-green-600'
    if (numScore >= 6) return 'text-yellow-600' 
    return 'text-destructive'
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 ${
            activeTab === 'summary' 
              ? 'border-b-2 border-primary' 
              : 'text-muted-foreground'
          }`}
        >
          Executive Summary
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`px-4 py-2 ${
            activeTab === 'issues' 
              ? 'border-b-2 border-primary' 
              : 'text-muted-foreground'
          }`}
        >
          Issues List
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 ${
            activeTab === 'sections' 
              ? 'border-b-2 border-primary' 
              : 'text-muted-foreground'
          }`}
        >
          Section Analysis
        </button>
      </div>
      
      {/* Download Links */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Analysis Report</h3>
        <div className="flex space-x-2">
          {results.reportLinks && Object.entries(results.reportLinks).map(([key, url]) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-md"
            >
              <Download className="h-4 w-4" />
              <span>{key.replace(/^\w/, c => c.toUpperCase())}</span>
            </a>
          ))}
        </div>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Overall Scores */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 font-medium">Overall Assessment</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {results.documentAssessment && Object.entries(results.documentAssessment).map(([key, assessment]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())}
                    </span>
                    <span className={`font-medium ${getScoreColor(assessment.score)}`}>
                      {formatScore(assessment.score)}/10
                    </span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        Number(assessment.score) >= 8 
                          ? 'bg-green-500' 
                          : Number(assessment.score) >= 6 
                            ? 'bg-yellow-500' 
                            : 'bg-destructive'
                      }`}
                      style={{ width: `${Number(assessment.score) * 10}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Top Recommendations */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 font-medium">Top Recommendations</div>
            <div className="p-4 space-y-4">
              {results.overallRecommendations?.map((recommendation, index) => (
                <div key={index} className="flex space-x-2">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground">
                      {index + 1}
                    </div>
                  </div>
                  <p>{recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'issues' && (
        <div className="space-y-6">
          {/* Issues Statistics */}
          <div className="grid grid-cols-3 gap-4">
            {results.statistics && (
              <>
                <div className="border rounded-lg p-4 text-center space-y-1">
                  <span className="text-3xl font-bold text-destructive">
                    {results.statistics.critical || 0}
                  </span>
                  <p className="text-sm text-muted-foreground">Critical Issues</p>
                </div>
                <div className="border rounded-lg p-4 text-center space-y-1">
                  <span className="text-3xl font-bold text-yellow-500">
                    {results.statistics.major || 0}
                  </span>
                  <p className="text-sm text-muted-foreground">Major Issues</p>
                </div>
                <div className="border rounded-lg p-4 text-center space-y-1">
                  <span className="text-3xl font-bold text-blue-500">
                    {results.statistics.minor || 0}
                  </span>
                  <p className="text-sm text-muted-foreground">Minor Issues</p>
                </div>
              </>
            )}
          </div>
          
          {/* Prioritized Issues List */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 font-medium">Prioritized Issues</div>
            <div className="divide-y">
              {results.prioritizedIssues?.map((issue, index) => (
                <div key={index} className="p-4 space-y-2">
                  <div className="flex items-start space-x-2">
                    {getSeverityIcon(issue.severity)}
                    <div>
                      <p className="font-medium">{issue.issue}</p>
                      <p className="text-sm text-muted-foreground">{issue.location}</p>
                    </div>
                  </div>
                  <p className="pl-7 text-sm">{issue.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Abstract Analysis */}
          {results.abstract && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 font-medium">Abstract</div>
              <div className="p-4 space-y-4">
                <p className="text-sm italic border-l-4 border-muted pl-4 py-2">
                  {results.abstract.text}
                </p>
                <div className="space-y-2">
                  <p className="font-medium">Summary</p>
                  <p>{results.abstract.summary}</p>
                </div>
                {results.abstract.issues && results.abstract.issues.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium">Issues</p>
                    <div className="space-y-2">
                      {results.abstract.issues.map((issue, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          {getSeverityIcon(issue.severity)}
                          <div>
                            <p>{issue.issue}</p>
                            <p className="text-sm text-muted-foreground">{issue.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Sections Analysis */}
          {results.sections?.map((section, sectionIndex) => (
            <div key={sectionIndex} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 font-medium">{section.name}</div>
              <div className="p-4 space-y-4">
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <div key={paragraphIndex} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Paragraph {paragraphIndex + 1}</p>
                    </div>
                    
                    {/* Full paragraph text instead of preview */}
                    <div className="mb-3 p-3 bg-muted/10 rounded text-sm">
                      {paragraph.text}
                    </div>
                    
                    <p className="mb-3 font-medium text-sm">Summary:</p>
                    <p className="mb-4 pl-3 border-l-2 border-muted">{paragraph.summary}</p>
                    
                    {/* Paragraph Structure Checks */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      <div className={`text-xs px-2 py-1 rounded ${
                        paragraph.evaluations?.cccStructure 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        C-C-C Structure: {paragraph.evaluations?.cccStructure ? 'Yes' : 'No'}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        paragraph.evaluations?.sentenceQuality 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Sentence Quality: {paragraph.evaluations?.sentenceQuality ? 'Good' : 'Needs Work'}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        paragraph.evaluations?.topicContinuity 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Topic Continuity: {paragraph.evaluations?.topicContinuity ? 'Good' : 'Fragmented'}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        paragraph.evaluations?.terminologyConsistency 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Terminology: {paragraph.evaluations?.terminologyConsistency ? 'Consistent' : 'Inconsistent'}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        paragraph.evaluations?.structuralParallelism 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Parallelism: {paragraph.evaluations?.structuralParallelism ? 'Good' : 'Needs Work'}
                      </div>
                    </div>
                    
                    {/* Paragraph Issues */}
                    {paragraph.issues && paragraph.issues.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-sm mb-2">Issues:</p>
                        <div className="space-y-2 pl-3 border-l-2 border-red-200">
                          {paragraph.issues.map((issue, issueIndex) => (
                            <div key={issueIndex} className="flex items-start space-x-2 text-sm">
                              {getSeverityIcon(issue.severity)}
                              <div>
                                <p className="font-medium">{issue.issue}</p>
                                <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
