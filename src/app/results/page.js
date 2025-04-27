// File Path: src/app/results/page.js
// Add runtime logging and markers
'use client'

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppContext } from '@/context/AppContext.jsx'; // Using alias
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
    console.log('[ResultsPage CLEAN] useEffect triggered. ID:', submissionId);
    setLoading(true);
    setError(null);
    setSubmission(null);

    if (submissionId) {
      console.log('[ResultsPage CLEAN] Attempting to get submission for ID:', submissionId);
      try {
        const sub = getSubmission(submissionId);

        if (sub) {
          console.log('[ResultsPage CLEAN] Submission found in context:', { id: sub.id, status: sub.status, hasResults: !!sub.results });
          console.log('[ResultsPage CLEAN] Full submission object structure:', JSON.stringify(sub, null, 2));
          setSubmission(sub);
        } else {
          console.warn('[ResultsPage CLEAN] Submission not found in context for ID:', submissionId);
          setError('Submission not found. It might have been cleared from history or the ID is invalid.');
        }
      } catch(e) {
         console.error("[ResultsPage CLEAN] Error retrieving submission from context:", e);
         setError("An unexpected error occurred while loading the submission.");
      }
    } else {
      console.warn('[ResultsPage CLEAN] No submission ID found in URL.');
      setError('No submission ID provided in the URL.');
    }
    setLoading(false);
  }, [submissionId, getSubmission, submissions]);


  // **** LOG STATE BEFORE RENDER ****
  console.log('[ResultsPage RENDER] State before return:', {
    loading,
    error,
    submissionId,
    submissionStatus: submission?.status,
    hasResults: !!submission?.results,
    isSubmissionObject: typeof submission === 'object' && submission !== null
  });
  // **********************************


  // --- Loading State ---
  if (loading) {
    // Add log inside
    console.log('[ResultsPage RENDER] Rendering: Loading state');
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium text-muted-foreground">Loading Results...</p>
      </div>
    );
  }

  // --- Error State or No Submission Found ---
  if (error || !submission) {
     // Add log inside
    console.log('[ResultsPage RENDER] Rendering: Error or No Submission state. Error:', error, 'Submission:', submission);
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
  // Add log before the main return if submission exists
  console.log(`[ResultsPage RENDER] Rendering main content for submission ID: ${submission.id}, Status: ${submission.status}, Has Results: ${!!submission.results}`);

  return (
    <div className="space-y-8">
       {/* Header Section */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
           <div>
              <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
              <p className="text-muted-foreground text-sm mt-1">
                  Displaying analysis for submission ID: {submission.id}
              </p>
           </div>
           <Link href="/" className="inline-flex items-center justify-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium whitespace-nowrap">
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Upload / History
           </Link>
       </div>

       {/* Submission Info Section */}
       <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/20 px-4 py-3 font-semibold text-base">
             Submission Details
          </div>
         <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
           {/* ... details grid ... */}
           <div><p className="text-xs ...">File Name</p><p className="font-medium ...">{submission.fileName || 'N/A'}</p></div>
           <div><p className="text-xs ...">Date Submitted</p><p className="font-medium ...">{submission.date ? new Date(submission.date).toLocaleString() : 'N/A'}</p></div>
           <div><p className="text-xs ...">Status</p><p className="font-medium ...">{submission.status || 'Unknown'}</p></div>
           {submission.fileSize && <div><p className="text-xs ...">File Size</p><p className="font-medium ...">{(submission.fileSize / 1024).toFixed(1)} KB</p></div>}
         </div>
       </div>


      {/* Conditional Rendering based on Status */}
      {/* Log before the conditional block */}
      {console.log('[ResultsPage RENDER] Evaluating status conditions. Status:', submission.status, 'Has results:', !!submission.results)}

      {submission.status === 'processing' && (
        // Log which block is being entered
        console.log('[ResultsPage RENDER] Condition met: status === processing') ||
        <div className="flex flex-col justify-center items-center min-h-[200px] border rounded-lg p-8 text-center bg-blue-50/50">
           <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
           <p className="text-lg font-medium text-primary/90">Analysis Still Processing</p>
           <p className="text-sm text-muted-foreground mt-1">The results are not ready yet. Please check back shortly.</p>
        </div>
      )}

      {submission.status === 'error' && (
         // Log which block is being entered
         console.log('[ResultsPage RENDER] Condition met: status === error') ||
          <div className="border rounded-lg p-6 bg-destructive/10 text-destructive">
               <div className="flex items-center space-x-2 mb-2">
                   <AlertCircle className="h-6 w-6"/>
                   <h3 className="text-lg font-semibold">Analysis Error</h3>
               </div>
              <p className='pl-8'>{submission.results?.error || 'An unknown error occurred during analysis.'}</p>
          </div>
      )}

      {/* Render ResultsDisplay only when completed and results exist */}
      {submission.status === 'completed' && submission.results && (
         // Log which block is being entered
         console.log('[ResultsPage RENDER] Condition met: status === completed && submission.results === true. Rendering ResultsDisplay.') ||
         <ResultsDisplay results={submission.results} />
      )}

      {/* Handle case where status is completed but results are missing */}
      {submission.status === 'completed' && !submission.results && (
         // Log which block is being entered
         console.log('[ResultsPage RENDER] Condition met: status === completed && submission.results === false. Rendering Incomplete state.') ||
          <div className="border rounded-lg p-6 bg-yellow-100 text-yellow-800">
               <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-6 w-6"/>
                  <h3 className="text-lg font-semibold">Analysis Incomplete</h3>
               </div>
               <p className='pl-8'>The analysis process completed, but the results data is missing for this submission.</p>
          </div>
      )}

      {/* **** ADD THIS MARKER **** */}
      <h2 style={{color: 'fuchsia', border: '3px dashed fuchsia', marginTop: '20px', padding: '10px', textAlign: 'center' }}>
          --- END OF ResultsPage CONDITIONAL RENDERING --- (Should not see MnK Summary below this)
      </h2>
      {/* ************************* */}

    </div>
  )
}
