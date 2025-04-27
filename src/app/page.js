// File Path: src/app/page.js
'use client'

import { useState } from 'react';
// Using absolute paths with @ alias
import FileUploader from '@/components/FileUploader.jsx';
import HistoryDisplay from '@/components/HistoryDisplay.jsx';
import DebugHelper from '@/components/DebugHelper.jsx'; // Assuming DebugHelper is still used
import { useAppContext } from '@/context/AppContext.jsx';
import { useRouter } from 'next/navigation';

export default function Home() {
  const {
    isProcessing,
    error,
    setError,
    addSubmission,
    updateSubmissionResults,
    setIsProcessing,
    getSubmission // Added getSubmission to update status correctly on error
  } = useAppContext();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState('upload');
  const [showDebug, setShowDebug] = useState(false); // Assuming DebugHelper toggle exists

  // Function definition for handling file submission
  const handleFileSubmit = async (file, fileText) => {
    console.log('[Home Page] handleFileSubmit triggered for file:', file?.name); // Added optional chaining
    setError(null);
    setIsProcessing(true);
    let submissionId;

    try {
      console.log('[Home Page] Adding submission to context...');
      submissionId = addSubmission({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'processing',
      });
      console.log('[Home Page] Added submission ID:', submissionId);

      const formData = new FormData();
      formData.append('file', file);
      if (fileText) {
        console.log('[Home Page] Appending client-extracted text.');
        formData.append('fileText', fileText);
      }

      console.log('[Home Page] Sending request to /api/analyze...');
      // Add timestamp to avoid caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/analyze?t=${timestamp}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
      });

      console.log('[Home Page] Received response status:', response.status);
      if (!response.ok) {
        let errorData = { message: `HTTP error! status: ${response.status}` };
        try {
          errorData = await response.json();
        } catch (parseError) {
           try {
              const textError = await response.text();
              errorData.message = textError || errorData.message;
           } catch(e){} // Ignore error reading text response if JSON parse failed
        }
        console.error('[Home Page] API Error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Error analyzing document');
      }

      const results = await response.json();
      console.log('[Home Page] Successfully parsed API results for:', submissionId);

      if (typeof updateSubmissionResults === 'function') {
         const currentSubmission = getSubmission(submissionId);
         const updatedSubmission = {
            ...currentSubmission,
            status: 'completed',
            results: results // Store the entire results object
         };
         console.log('[Home Page] Updating submission in context...');
         updateSubmissionResults(submissionId, updatedSubmission);
      } else {
         console.error('[Home Page] updateSubmissionResults is not a function!');
      }

      console.log('[Home Page] Navigating to results page...');
      router.push(`/results?id=${submissionId}`);

    } catch (err) {
      console.error('[Home Page] Error processing file submission:', err);
      setError(err.message || 'An unexpected error occurred.');
       if (submissionId && typeof updateSubmissionResults === 'function' && typeof getSubmission === 'function') {
           const currentSubmission = getSubmission(submissionId);
           const updatedSubmission = {
             ...currentSubmission,
             status: 'error',
             results: { error: err.message || 'Processing failed' }
           };
           updateSubmissionResults(submissionId, updatedSubmission);
           console.log('[Home Page] Updated submission to error status.');
       } else {
            console.error('[Home Page] Could not update submission to error status.');
       }
    } finally {
       console.log('[Home Page] handleFileSubmit finished.');
       setIsProcessing(false);
    }
  };

  // Toggle debug panel (hidden by default)
  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };


  return (
    <div className="flex flex-col space-y-8">
      <div className="flex justify-center border-b">
        <button
          className={`px-4 py-2 font-medium ${ activeTab === 'upload' ? 'border-b-2 border-primary' : 'text-muted-foreground' }`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Paper
        </button>
        <button
          className={`px-4 py-2 font-medium ${ activeTab === 'history' ? 'border-b-2 border-primary' : 'text-muted-foreground' }`}
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
        // Passing the handleFileSubmit function as the onFileSubmit prop
        <FileUploader onFileSubmit={handleFileSubmit} isProcessing={isProcessing} />
      ) : (
        <HistoryDisplay />
      )}

      {/* Debug tools - conditionally rendered */}
      {showDebug && (
         <>
             <button onClick={toggleDebug} className="text-xs text-gray-500 hover:text-gray-700 self-center">Hide Debug</button>
             <DebugHelper />
         </>
      )}
       {!showDebug && (
           <div className="mt-10 text-center">
                <button onClick={toggleDebug} className="text-xs text-gray-300 hover:text-gray-500">Toggle Debug</button>
           </div>
       )}
    </div>
  )
}
