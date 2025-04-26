// File Path: src/app/results/page.js
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
// ****** THIS IS THE LINE TO CHECK - Ensure it uses ../../ ******
import { useAppContext } from '../../context/AppContext.jsx'
import ResultsDisplay from '../../components/ResultsDisplay.jsx' // This relative path should be correct
import Link from 'next/link'

export default function ResultsPage() {
  const searchParams = useSearchParams()
  const submissionId = searchParams.get('id')
  // Ensure getSubmission is destructured correctly
  const { getSubmission, submissions } = useAppContext() // Also get submissions if needed for useEffect dependency
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('[ResultsPage] useEffect triggered. ID:', submissionId);
    setLoading(true); // Set loading true at the start
    setError(null); // Clear previous errors

    if (submissionId) {
      console.log('[ResultsPage] Attempting to get submission for ID:', submissionId);
      const sub = getSubmission(submissionId);
      if (sub) {
        console.log('[ResultsPage] Submission found:', sub);
        setSubmission(sub);
      } else {
        console.warn('[ResultsPage] Submission not found for ID:', submissionId);
        setError('Submission not found or history cleared.');
      }
    } else {
      console.warn('[ResultsPage] No submission ID found in URL.');
      setError('No submission ID provided in the URL.');
    }
    setLoading(false); // Set loading false after processing
  // Rerun effect if the submissionId changes OR if the list of submissions changes (e.g., after initial load)
  }, [submissionId, getSubmission, submissions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="sr-only">Loading results...</span>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-center border rounded-lg p-8">
        <h3 className="text-lg font-medium text-destructive">
          {error || 'Could not load submission details.'}
        </h3>
         <p className="text-sm text-muted-foreground">
            Please check the submission ID or go back home.
         </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // Display submission details and results
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Analysis Results</h2>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap"
        >
          New Analysis
        </Link>
      </div>

      {/* Submission Info Section */}
      <div className="border rounded-md p-4 bg-muted/30">
        <h3 className="text-lg font-semibold mb-3">Submission Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">File Name</p>
            <p className="font-medium break-words">{submission.fileName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date Submitted</p>
            <p className="font-medium">
              {submission.date ? new Date(submission.date).toLocaleString() : 'N/A'}
            </p>
          </div>
           <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{submission.status || 'Unknown'}</p>
          </div>
           {submission.fileSize && (
               <div>
                 <p className="text-sm text-muted-foreground">File Size</p>
                 <p className="font-medium">{(submission.fileSize / 1024).toFixed(1)} KB</p>
               </div>
           )}
        </div>
      </div>

        {/* Results Display or Status Indicator */}
       {submission.status === 'processing' && (
        <div className="flex flex-col justify-center items-center h-64 border rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Analyzing your paper...</p>
           <p className="text-sm text-muted-foreground">This might take a moment.</p>
        </div>
       )}

      {submission.status === 'error' && (
          <div className="border rounded-lg p-6 bg-destructive/10 text-destructive">
              <h3 className="text-lg font-semibold mb-2">Analysis Error</h3>
              {/* Ensure results and results.error exist before accessing */}
              <p>{submission.results?.error || 'An unknown error occurred during analysis.'}</p>
          </div>
      )}

      {submission.status === 'completed' && submission.results && (
         <ResultsDisplay results={submission.results} />
      )}

       {submission.status === 'completed' && !submission.results && (
           <div className="border rounded-lg p-6 bg-yellow-100 text-yellow-800">
              <h3 className="text-lg font-semibold mb-2">Analysis Incomplete</h3>
              <p>The analysis process completed, but no results were found for this submission.</p>
           </div>
       )}

    </div>
  )
}
