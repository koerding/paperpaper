// File Path: src/components/FileUploader.jsx
'use client'

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Cloud, FileText, Info, ExternalLink } from 'lucide-react'; // Added Info, ExternalLink icons
import { useAppContext } from '@/context/AppContext.jsx';
import { extractTextFromFile } from '@/services/ProcessingService.client.js';

// MnK Paper Details (Could also be loaded from a config/JSON file)
const mnkPaper = {
  title: "Ten simple rules for structuring papers",
  authors: "Brett Mensh & Konrad Kording",
  journal: "PLoS Comput Biol",
  year: 2017,
  doi: "10.1371/journal.pcbi.1005619",
  url: "https://doi.org/10.1371/journal.pcbi.1005619",
  popularity: "viewed over a million times", // As per user request
  rules: [
    "Focus your paper on a central contribution, communicated in the title",
    "Write for flesh-and-blood human beings who do not know your work",
    "Stick to the context-content-conclusion (C-C-C) scheme",
    "Optimize logical flow: avoid zig-zag, use parallelism",
    "Tell a complete story in the abstract",
    "Communicate why the paper matters in the introduction",
    "Deliver results as a sequence of statements supported by figures",
    "Discuss how the gap was filled, limitations, and relevance",
    "Allocate time where it matters: title, abstract, figures, outlining", // Rule 9 from paper
    "Get feedback to reduce, reuse, and recycle your story" // Rule 10 from paper
  ]
};

export default function FileUploader({ onFileSubmit, isProcessing }) {
  const { setIsProcessing, setError } = useAppContext();
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState(''); // Store extracted text
  const maxSize = 10 * 1024 * 1024; // 10MB max file size

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
      if (typeof extractTextFromFile !== 'function') {
         console.error('[FileUploader] extractTextFromFile is not available! Skipping client-side extraction.');
         setError('Client-side processing setup error. Analysis will proceed on server.');
         return;
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
      console.warn('[FileUploader] Could not extract text client-side, will process on server:', err);
    }
  // Added missing dependency array closer ']', removed setError dependency as it comes from context and is stable
  }, [setError, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize,
  });

  const handleSubmit = async () => {
    if (!file) {
        console.log('[FileUploader] handleSubmit called but no file is selected.');
        setError('Please select a file first.');
        return;
    }
    console.log('[FileUploader] handleSubmit called for file:', file.name);
    // NOTE: setIsProcessing and setError are now handled within handleFileSubmit in page.js
    // If this component needs to manage its own processing state distinct from the page,
    // you might need to pass down callbacks or adjust state management.
    // For now, assuming the page's isProcessing prop handles the button state.

    try {
        await onFileSubmit(file, fileText); // Call the handler passed from the page
        console.log('[FileUploader] Handed off file to onFileSubmit');
        // Reset local state after successful handoff (optional)
        // setFile(null);
        // setFileText('');
    } catch (err) {
        // Errors should ideally be caught and handled in the onFileSubmit function (in page.js)
        // But we can log here if needed.
        console.error('[FileUploader] Error calling onFileSubmit:', err);
        // Optionally set a local error state if needed: setError(err.message || 'Error submitting file.');
    } finally {
       console.log('[FileUploader] handleSubmit finished.');
       // Resetting processing state is likely handled in page.js's finally block
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
                 {!fileText && ' (Text extraction/analysis occurs on server)'}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isProcessing} // Use the processing state from the page context
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Analyze Paper Structure'}
            </button>
          </div>
        </div>
      )}

      {/* --- Updated 'About' Section --- */}
      {!file && (
        <div className="text-left p-6 border rounded-lg bg-muted/10 space-y-4">
           <div className="flex items-center space-x-2">
               <Info className="h-6 w-6 text-primary/80" />
               <h3 className="text-lg font-semibold">Based on "Ten Simple Rules for Structuring Papers"</h3>
           </div>
           <p className="text-sm text-muted-foreground">
              This tool analyzes your scientific paper's structure based on the principles outlined in the highly influential paper
              by <span className='font-medium'>{mnkPaper.authors}</span> (<span className='italic'>{mnkPaper.journal}, {mnkPaper.year}</span>),
              which has been {mnkPaper.popularity}. The goal is to help you communicate your work clearly and effectively.
           </p>
            <div className="text-sm">
               <p className="font-medium mb-1">The 10 Rules (MnK):</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                   {mnkPaper.rules.map((rule, index) => (
                       <li key={index}>{rule}</li>
                   ))}
                </ol>
            </div>
            <p className='text-sm text-muted-foreground'>
                Feedback provided by this tool will often reference these rules using the notation <span className='font-mono bg-muted px-1 py-0.5 rounded'>MnK$</span>,
                where <span className='font-mono bg-muted px-1 py-0.5 rounded'>$</span> is the original rule number (e.g., <span className='font-mono bg-muted px-1 py-0.5 rounded'>MnK3</span> refers to Rule 3: C-C-C Scheme).
                You'll be able to mouse over these tags in the results for the full rule title.
            </p>
           <div>
               <a
                  href={mnkPaper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-sm text-primary hover:underline"
               >
                  <span>Read the full paper</span>
                  <ExternalLink className="h-4 w-4" />
               </a>
           </div>

        </div>
      )}
      {/* --- End Updated 'About' Section --- */}

    </div>
  )
}
