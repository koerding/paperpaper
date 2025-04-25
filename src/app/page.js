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
    updateSubmissionResults 
  } = useAppContext()
  
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('upload')

  // Handle file upload and processing
  const handleFileSubmit = async (file, fileText) => {
    try {
      // Add submission to context
      const submissionId = addSubmission({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'processing',
      })

      // Send to API for analysis
      const formData = new FormData()
      formData.append('file', file)
      
      // Process text directly if available, otherwise server will extract it
      if (fileText) {
        formData.append('fileText', fileText)
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error analyzing document')
      }

      const results = await response.json()
      
      // Update submission with results
      updateSubmissionResults(submissionId, results)
      
      // Navigate to results page
      router.push(`/results?id=${submissionId}`)
    } catch (err) {
      console.error('Error processing file:', err)
      setError(err.message || 'Error processing file')
    }
  }

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
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      {activeTab === 'upload' ? (
        <FileUploader onFileSubmit={handleFileSubmit} isProcessing={isProcessing} />
      ) : (
        <HistoryDisplay />
      )}
    </div>
  )
}
