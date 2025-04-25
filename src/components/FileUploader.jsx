'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Cloud, FileText, AlertCircle } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'
import { extractTextFromFile } from '@/services/ProcessingService'

export default function FileUploader({ onFileSubmit, isProcessing }) {
  const { setIsProcessing, setError } = useAppContext()
  const [file, setFile] = useState(null)
  const [fileText, setFileText] = useState('')
  const maxSize = 10 * 1024 * 1024 // 10MB max file size
  
  const onDrop = useCallback(async (acceptedFiles) => {
    try {
      // Reset error state
      setError(null)
      
      // Only accept the first file
      const uploadedFile = acceptedFiles[0]
      if (!uploadedFile) return
      
      setFile(uploadedFile)
      
      // Check file size
      if (uploadedFile.size > maxSize) {
        throw new Error('File is too large. Maximum size is 10MB.')
      }
      
      // Check file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'text/plain', // txt
        'text/markdown', // md
        'text/x-tex', // tex
        'application/x-tex', // tex alternative
      ]
      
      if (!validTypes.includes(uploadedFile.type) && 
          !uploadedFile.name.endsWith('.tex')) {
        throw new Error('Unsupported file type. Please upload .docx, .txt, .md, or .tex files.')
      }
      
      // Try to extract text client-side
      try {
        const extractedText = await extractTextFromFile(uploadedFile)
        
        // Check text length
        if (extractedText.length > 100000) {
          throw new Error('Document is too large. Maximum 100,000 characters allowed.')
        }
        
        setFileText(extractedText)
      } catch (err) {
        console.log('Could not extract text client-side, will process on server:', err)
        // We'll let the server handle text extraction
      }
    } catch (err) {
      console.error('File upload error:', err)
      setError(err.message || 'Error uploading file')
      setFile(null)
      setFileText('')
    }
  }, [setError])
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize,
  })
  
  const handleSubmit = async () => {
    if (!file) return
    
    try {
      setIsProcessing(true)
      await onFileSubmit(file, fileText)
    } catch (err) {
      setError(err.message || 'Error submitting file')
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4">
          <Cloud className="h-12 w-12 text-muted-foreground/50" />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop the file here' : 'Drag and drop your paper file'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse files
            </p>
          </div>
          <div className="text-xs text-muted-foreground max-w-md">
            Supported formats: .docx, .txt, .md, .tex<br />
            Maximum file size: 10MB
          </div>
        </div>
      </div>
      
      {file && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Analyze Paper Structure'}
            </button>
          </div>
        </div>
      )}
      
      {!file && (
        <div className="text-center p-8 border rounded-lg bg-muted/10">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-primary/60" />
            </div>
            <h3 className="text-lg font-medium">About This Tool</h3>
            <p className="text-muted-foreground">
              Upload your scientific paper to analyze its structure according to 
              established best practices for scientific writing. This tool will provide 
              feedback on paragraph structure, section organization, and overall coherence.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
