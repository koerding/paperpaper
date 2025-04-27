// File Path: src/app/results/page.js
'use client'

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppContext } from '@/context/AppContext.jsx'; // Using alias based on other files
import ResultsDisplay from '@/components/ResultsDisplay.jsx'; // Using alias
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'; // Added icons

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('id');
  const { getSubmission, submissions } = useAppContext(); // Ensure context provides these
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[ResultsPage] useEffect triggered. ID:', submissionId);
    // Reset state on ID change or initial load
    setLoading(true);
    setError(null);
    setSubmission(null); // Reset submission too

    if (submissionId) {
      console.log('[ResultsPage] Attempting to get submission for ID:', submissionId);
      try {
        const sub = getSubmission(submissionId); // Get submission data from context

        if (sub) {
          console.log('[ResultsPage] Submission found in context:', { id: sub.id, status: sub.status, hasResults: !!sub.results });
          setSubmission(sub); // Set the found submission
           // Optional: Check status and maybe trigger refetch if still processing? For now, just display based on context.
        } else {
          console.warn('[ResultsPage] Submission not found in context for ID:', submissionId);
          setError('Submission not found. It might have been cleared from history or the ID is invalid.');
        }
      } catch(e) {
         console.error("[ResultsPage] Error retrieving submission from context:", e);
         setError("An unexpected error occurred while loading the submission.");
      }
    } else {
      console.warn('[ResultsPage] No submission ID found in URL.');
      setError('No submission ID provided in the URL.');
    }
    setLoading(false); // Loading finished
  // Dependency array: Rerun when ID changes, or when the list of submissions potentially updates
  }, [submissionId, getSubmission, submissions]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium text-muted-foreground">Loading Results...</p>
      </div>
    );
  }

  // --- Error State or No Submission Found ---
  if (error || !submission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center border rounded-lg p-8 bg-destructive/5">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h3 className="text-xl font-semibold text-destructive">
          {error || 'Could not load submission details.'}
        </h3>
         <p className="text-sm text-muted-foreground max-w-md">
           Please check the submission ID in the URL. The submission might not exist in your browser's history anymore.
         </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
           <ArrowLeft className="mr-2 h-4 w-4" /> Back to Upload
        </Link>
      </div>
    );
  }

  // --- Submission Found - Display Details and Results/Status ---
  return (
    <div className="space-y-8"> {/* Increased spacing */}
       {/* Header Section */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
           <div>
              <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
              <p className="text-muted-foreground text-sm mt-1">
                  Displaying analysis for submission ID: {submission.id}
              </p>
           </div>
           <Link
             href="/" // Link back to the main page
             className="inline-flex items-center justify-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium whitespace-nowrap"
           >
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Upload / History
           </Link>
       </div>

       {/* Submission Info Section */}
       <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/20 px-4 py-3 font-semibold text-base"> {/* Adjusted padding/font */}
             Submission Details
          </div>
         <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm"> {/* Adjusted grid/gap */}
           <div>
             <p className="text-xs text-muted-foreground uppercase tracking-wider">File Name</p>
             <p className="font-medium break-words mt-0.5">{submission.fileName || 'N/A'}</p>
           </div>
           <div>
             <p className="text-xs text-muted-foreground uppercase tracking-wider">Date Submitted</p>
             <p className="font-medium mt-0.5">
               {submission.date ? new Date(submission.date).toLocaleString() : 'N/A'}
             </p>
           </div>
           <div>
             <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
             <p className="font-medium capitalize mt-0.5">{submission.status || 'Unknown'}</p>
           </div>
           {submission.fileSize && (
               <div>
                 <p className="text-xs text-muted-foreground uppercase tracking-wider">File Size</p>
                 <p className="font-medium mt-0.5">{(submission.fileSize / 1024).toFixed(1)} KB</p>
               </div>
           )}
         </div>
       </div>


      {/* Conditional Rendering based on Status */}
      {submission.status === 'processing' && (
        <div className="flex flex-col justify-center items-center min-h-[200px] border rounded-lg p-8 text-center bg-blue-50/50">
           <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
           <p className="text-lg font-medium text-primary/90">Analysis Still Processing</p>
           <p className="text-sm text-muted-foreground mt-1">The results are not ready yet. Please check back shortly.</p>
        </div>
      )}

      {submission.status === 'error' && (
          <div className="border rounded-lg p-6 bg-destructive/10 text-destructive">
               <div className="flex items-center space-x-2 mb-2">
                   <AlertCircle className="h-6 w-6"/>
                   <h3 className="text-lg font-semibold">Analysis Error</h3>
               </div>
              <p className='pl-8'>{submission.results?.error || 'An unknown error occurred during analysis.'}</p>
          </div>
      )}

      {submission.status === 'completed' && submission.results && (
         // ***** This is where ResultsDisplay should render *****
         <ResultsDisplay results={submission.results} />
      )}

      {/* Handle case where status is completed but results are missing */}
      {submission.status === 'completed' && !submission.results && (
          <div className="border rounded-lg p-6 bg-yellow-100 text-yellow-800">
               <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-6 w-6"/>
                  <h3 className="text-lg font-semibold">Analysis Incomplete</h3>
               </div>
               <p className='pl-8'>The analysis process completed, but the results data is missing for this submission.</p>
          </div>
      )}

        {/* Removed the Debug Info panel from the main display, use console for debugging */}

    </div>
  )
}
