// File Path: src/app/page.js
'use client'

import { useState } from 'react'
// Using absolute paths with @ alias
import FileUploader from '@/components/FileUploader.jsx'
import HistoryDisplay from '@/components/HistoryDisplay.jsx'
import { useAppContext } from '@/context/AppContext.jsx'
import { useRouter } from 'next/navigation'

export default function Home() {
  const {
    isProcessing,
    error,
    setError,
    addSubmission,
    updateSubmissionResults,
    setIsProcessing,
    getSubmission // Added getSubmission to update status correctly on error
  } = useAppContext()

  const router = useRouter()
  const [activeTab, setActiveTab] = useState('upload')
  const [analysisProgress, setAnalysisProgress] = useState(null)

  // Handle file upload and processing
  const handleFileSubmit = async (file, fileText) => {
    console.log('[Home Page] handleFileSubmit triggered for file:', file.name);
    setError(null); // Clear errors from previous attempts
    setIsProcessing(true); // Ensure processing state is set
    setAnalysisProgress('Uploading file...');

    let submissionId; // Define submissionId here to access in finally block

    try {
      // Add submission to context immediately
      submissionId = addSubmission({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'processing', // Initial status
      });
      console.log('[Home Page] Added submission to context with ID:', submissionId);

      // Prepare form data for API
      const formData = new FormData();
      formData.append('file', file);

      if (fileText) {
        console.log('[Home Page] Appending client-extracted text to FormData.');
        formData.append('fileText', fileText);
        setAnalysisProgress('Sending extracted text for analysis...');
      } else {
        console.log('[Home Page] No client-extracted text available, server will extract.');
        setAnalysisProgress('Sending file for text extraction and analysis...');
      }

      // Enhanced error handling with retries
      let response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`[Home Page] Sending request to /api/analyze (attempt ${retryCount + 1})...`);
          
          // Add a query parameter with timestamp to avoid caching
          const timestamp = new Date().getTime();
          setAnalysisProgress(`Analyzing document structure (attempt ${retryCount + 1})...`);
          
          // We need to set a long timeout for fetch (3+ minutes)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
          
          response = await fetch(`/api/analyze?t=${timestamp}`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            // Add explicit headers
            headers: {
              // Don't set Content-Type with FormData
              // (browser will set it with the correct boundary)
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          console.log('[Home Page] Received response from /api/analyze. Status:', response.status);
          
          // Break the retry loop if we got a valid response
          if (response.ok) break;
          
          // If we got a 404, let's try an alternative API path
          if (response.status === 404 && retryCount === 0) {
            console.log('[Home Page] Got 404, trying alternative API path...');
            retryCount++;
            setAnalysisProgress('Retrying with alternative path...');
            continue;
          }
          
          // For 504 timeout errors, inform the user the operation takes too long
          if (response.status === 504) {
            throw new Error('The analysis is taking too long to complete. This may be due to the document size or complexity.');
          }
          
          // For other error status codes, throw an error
          throw new Error(`HTTP error! status: ${response.status}`);
        } catch (fetchError) {
          // Special handling for timeout errors
          if (fetchError.name === 'AbortError') {
            console.error('[Home Page] Request timed out');
            throw new Error('Request timed out. The server took too long to respond.');
          }
          
          console.error(`[Home Page] Fetch error (attempt ${retryCount + 1}):`, fetchError);
          retryCount++;
          
          // On last retry, throw the error to be caught by outer catch
          if (retryCount > maxRetries) throw fetchError;
          
          // Wait before retry (exponential backoff)
          const backoffMs = 1000 * Math.pow(2, retryCount - 1);
          console.log(`[Home Page] Retrying in ${backoffMs}ms...`);
          setAnalysisProgress(`Network error, retrying in ${backoffMs/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }

      if (!response.ok) {
        let errorData = { message: `HTTP error! status: ${response.status}` };
        try {
          // Try to parse JSON error, but handle cases where it's not JSON
          errorData = await response.json();
          console.error('[Home Page] API Error Response Body:', errorData);
        } catch (parseError) {
          console.error('[Home Page] Could not parse error response as JSON:', parseError);
          // Attempt to read as text if JSON parsing fails
          try {
            const textError = await response.text();
            console.error('[Home Page] API Error Response Text:', textError);
            errorData.message = textError || errorData.message;
          } catch (textErrorErr) {
            console.error('[Home Page] Could not read error response as text:', textErrorErr);
          }
        }
        // Use the detailed message from API if available, otherwise use a generic one
        throw new Error(errorData.error || errorData.message || 'Error analyzing document');
      }

      setAnalysisProgress('Processing results...');
      const results = await response.json();
      console.log('[Home Page] Successfully parsed results from API for submission:', submissionId);
      console.log('[Home Page] Results structure from API - top-level keys:', Object.keys(results));

      // CRITICAL FIX: Instead of updating with properties from the results,
      // we update the submission with a separate results property
      if (typeof updateSubmissionResults === 'function') {
         // Get the existing submission
         const currentSubmission = getSubmission(submissionId);
         
         // Create an updated version with both status and the full results object
         const updatedSubmission = {
            ...currentSubmission,
            status: 'completed',
            results: results  // Store the entire results object
         };
         
         console.log('[Home Page] Updating submission with data structure:', 
           JSON.stringify({
             id: submissionId,
             status: 'completed',
             hasResults: !!results,
             resultKeys: Object.keys(results)
           })
         );
         
         // Update the submission in the context
         updateSubmissionResults(submissionId, updatedSubmission);
         console.log('[Home Page] Updated submission in context with results.');
      } else {
         console.error('[Home Page] updateSubmissionResults is not a function in context!');
      }

      // Navigate to results page
      setAnalysisProgress('Analysis complete! Redirecting to results...');
      console.log('[Home Page] Navigating to results page for submission:', submissionId);
      router.push(`/results?id=${submissionId}`);

    } catch (err) {
      // This catches errors from fetch, response parsing, context updates, navigation
      console.error('[Home Page] Error processing file submission:', err);
      setError(err.message || 'An unexpected error occurred during processing.');
       // Optionally update submission status to 'error' if submissionId exists
       if (submissionId && typeof updateSubmissionResults === 'function' && typeof getSubmission === 'function') {
           const currentSubmission = getSubmission(submissionId); // Use getSubmission if available
           // Ensure results object exists before trying to update, and set status to error
           const updatedSubmission = {
             ...currentSubmission,
             status: 'error',
             results: { error: err.message || 'Processing failed' }
           };
           updateSubmissionResults(submissionId, updatedSubmission);
           console.log('[Home Page] Updated submission in context with error status.');
       } else {
           console.error('[Home Page] Could not update submission status to error; updateSubmissionResults or getSubmission missing from context?');
       }
    } finally {
       // Ensure processing state is always reset
       console.log('[Home Page] handleFileSubmit finished.');
       setIsProcessing(false);
       setAnalysisProgress(null);
    }
  };


  return (
    <div className="flex flex-col space-y-8">
      <div className="flex justify-center border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'upload'
              ? 'border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Paper
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'history'
              ? 'border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
          onClick={() => setActiveTab('history')}
        >
          Submission History
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/30">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {analysisProgress && (
        <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200">
          <div className="flex items-center">
            <div className="mr-3 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <p className="font-medium">{analysisProgress}</p>
          </div>
          <p className="mt-2 text-sm">Paper analysis can take up to 10 minutes depending on length and complexity.</p>
        </div>
      )}

      {activeTab === 'upload' ? (
        // Pass the updated handleFileSubmit
        <FileUploader onFileSubmit={handleFileSubmit} isProcessing={isProcessing} />
      ) : (
        <HistoryDisplay />
      )}
    </div>
  )
}
