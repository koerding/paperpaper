'use client'

import { useState } from 'react'
import FileUploader from '@/components/FileUploader'
import HistoryDisplay from '@/components/HistoryDisplay'
import { useAppContext } from '@/context/AppContext'
import { useRouter } from 'next/navigation'

export default function Home() {
  const {
    isProcessing,
    error,
    setError,
    addSubmission,
    updateSubmissionResults,
    setIsProcessing // Added setIsProcessing from context
  } = useAppContext()

  const router = useRouter()
  const [activeTab, setActiveTab] = useState('upload')

  // Handle file upload and processing
  const handleFileSubmit = async (file, fileText) => {
    console.log('[Home Page] handleFileSubmit triggered for file:', file.name);
    setError(null); // Clear errors from previous attempts
    setIsProcessing(true); // Ensure processing state is set

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
      } else {
        console.log('[Home Page] No client-extracted text available, server will extract.');
      }

      console.log('[Home Page] Sending request to /api/analyze...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      console.log('[Home Page] Received response from /api/analyze. Status:', response.status);

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

      const results = await response.json();
      console.log('[Home Page] Successfully parsed results from API for submission:', submissionId, results);

      // Update submission with results (ensure updateSubmissionResults exists and works)
      if (typeof updateSubmissionResults === 'function') {
         updateSubmissionResults(submissionId, results);
         console.log('[Home Page] Updated submission in context with results.');
      } else {
         console.error('[Home Page] updateSubmissionResults is not a function in context!');
      }


      // Navigate to results page
      console.log('[Home Page] Navigating to results page for submission:', submissionId);
      router.push(`/results?id=${submissionId}`);

    } catch (err) {
      // This catches errors from fetch, response parsing, context updates, navigation
      console.error('[Home Page] Error processing file submission:', err);
      setError(err.message || 'An unexpected error occurred during processing.');
       // Optionally update submission status to 'error' if submissionId exists
       if (submissionId && typeof updateSubmissionResults === 'function') {
           updateSubmissionResults(submissionId, { error: err.message || 'Processing failed' }); // Update with error info
       }
    } finally {
       // Ensure processing state is always reset
       console.log('[Home Page] handleFileSubmit finished.');
       setIsProcessing(false);
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

      {activeTab === 'upload' ? (
        // Pass the updated handleFileSubmit
        <FileUploader onFileSubmit={handleFileSubmit} isProcessing={isProcessing} />
      ) : (
        <HistoryDisplay />
      )}
    </div>
  )
}
