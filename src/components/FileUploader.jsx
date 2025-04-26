// File Path: src/components/FileUploader.jsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Cloud, FileText, AlertCircle } from 'lucide-react'
// Using relative paths for imports from other src subdirectories
import { useAppContext } from '../context/AppContext.jsx'
import { extractTextFromFile } from '../services/ProcessingService.js'

export default function FileUploader({ onFileSubmit, isProcessing }) {
  const { setIsProcessing, setError } = useAppContext()
  const [file, setFile] = useState(null)
  const [fileText, setFileText] = useState('') // Store extracted text
  const maxSize = 10 * 1024 * 1024 // 10MB max file size

  const onDrop = useCallback(async (acceptedFiles) => {
    console.log('[FileUploader] onDrop triggered.');
    setError(null); // Reset error on new drop
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) {
      console.log('[FileUploader] No file accepted.');
      return;
    }

    console.log('[FileUploader] File accepted:', uploadedFile.name, uploadedFile.size, uploadedFile.type);
    setFile(uploadedFile);
    setFileText(''); // Reset previous text

    // Basic client-side validation (size, type)
    if (uploadedFile.size > maxSize) {
        const errorMsg = 'File is too large. Maximum size is 10MB.';
        console.error('[FileUploader] Validation Error:', errorMsg);
        setError(errorMsg);
        setFile(null);
        return;
    }
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'text/plain', // txt
      'text/markdown', // md
      'text/x-tex', // tex
      'application/x-tex', // tex alternative
    ];
    // Use optional chaining for name check
    if (!validTypes.includes(uploadedFile.type) && !uploadedFile.name?.endsWith('.tex')) {
        const errorMsg = 'Unsupported file type. Please upload .docx, .txt, .md, or .tex files.';
        console.error('[FileUploader] Validation Error:', errorMsg);
        setError(errorMsg);
        setFile(null);
        return;
    }

    // Attempt client-side text extraction
    console.log('[FileUploader] Attempting client-side text extraction...');
    try {
      // Ensure the function exists before calling
      if (typeof extractTextFromFile !== 'function') {
         console.error('[FileUploader] extractTextFromFile is not available! Skipping client-side extraction.');
         // Let server handle it, maybe log a warning or specific error
         setError('Client-side processing setup error. Analysis will proceed on server.');
         return; // Or proceed without fileText, letting server handle it
      }

      const extractedText = await extractTextFromFile(uploadedFile);
      console.log(`[FileUploader] Client-side text extracted successfully. Length: ${extractedText.length}`);

      // Optional: Add text length validation here if needed
      if (extractedText.length > 100000) { // Example limit
          const errorMsg = 'Document is too long (client-side check). Maximum 100,000 characters allowed.';
           console.error('[FileUploader] Validation Error:', errorMsg);
           setError(errorMsg);
           setFile(null); // Prevent submission of overly large text
           return;
      }

      setFileText(extractedText);
    } catch (err) {
      // This catch block will now correctly handle errors from the *actual* extraction function
      console.warn('[FileUploader] Could not extract text client-side, will process on server:', err);
      // Optionally set a state or message indicating server-side processing will be used
      // setError('Could not process file in browser, sending to server for analysis.'); // Maybe too alarming?
    }
  }, [setError]); // Added setError dependency

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize, // Let dropzone handle basic size check too
  });

  const handleSubmit = async () => {
    if (!file) {
        console.log('[FileUploader] handleSubmit called but no file is selected.');
        setError('Please select a file first.');
        return;
    }
    console.log('[FileUploader] handleSubmit called for file:', file.name);
    setIsProcessing(true);
    setError(null); // Clear previous errors before submitting

    try {
      // Pass the file object and the potentially extracted text
      await onFileSubmit(file, fileText);
      console.log('[FileUploader] onFileSubmit completed successfully.');
    } catch (err) {
      // This catch is primarily for errors thrown by onFileSubmit itself (e.g., network issues)
      console.error('[FileUploader] Error during onFileSubmit:', err);
      setError(err.message || 'Error submitting file for analysis.');
    } finally {
      console.log('[FileUploader] handleSubmit finished.');
      setIsProcessing(false);
    }
  };

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
                {fileText && ` (~${fileText.length} chars extracted)`}
                 {!fileText && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && ' (Text will be extracted on server)'}
                 {!fileText && file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && ' (Text will be extracted on server)'}
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
            <AlertCircle className="h-12 w-12 text-primary/60 mx-auto" />
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
