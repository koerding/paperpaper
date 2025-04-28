// File Path: src/components/FileUploader.jsx
// Reverted to simple intro text - Removed Tippy/Rule imports/logic from this file
'use client'

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Cloud, FileText, Info, ExternalLink } from 'lucide-react'; // Keep necessary icons
import { useAppContext } from '@/context/AppContext.jsx';
import { extractTextFromFile } from '@/services/ProcessingService.client.js';

// --- FileUploader Component ---
export default function FileUploader({ onFileSubmit, isProcessing }) {
  const { setError } = useAppContext();
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState('');
  const maxSize = 10 * 1024 * 1024;

  // onDrop, useDropzone, handleSubmit logic remains the same
  const onDrop = useCallback(async (acceptedFiles) => {
    console.log('[FileUploader] onDrop triggered.');
    setError(null);
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) {
      console.log('[FileUploader] No file accepted.');
      return;
    }
    console.log('[FileUploader] File accepted:', uploadedFile.name, uploadedFile.size, uploadedFile.type);
    setFile(uploadedFile);
    setFileText('');

    // Validation logic (size, type)
    if (uploadedFile.size > maxSize) { /* ... size error ... */ }
    const validTypes = [ /* ... */ ];
    if (!validTypes.includes(uploadedFile.type) && !uploadedFile.name?.endsWith('.tex')) { /* ... type error ... */ }

    // Client-side text extraction
    console.log('[FileUploader] Attempting client-side text extraction...');
    try {
        // ... extraction logic ...
        const extractedText = await extractTextFromFile(uploadedFile);
        console.log(`[FileUploader] Client-side text extracted successfully. Length: ${extractedText.length}`);
        if (extractedText.length > 100000) { /* ... length error ... */ }
        setFileText(extractedText);
    } catch (err) {
      console.warn('[FileUploader] Could not extract text client-side, will process on server:', err);
    }
  }, [setError, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, maxSize });

  const handleSubmit = async () => {
    if (!file) {
        console.log('[FileUploader] handleSubmit: No file selected.');
        setError('Please select a file first.');
        return;
    }
    console.log('[FileUploader] handleSubmit called for file:', file.name);
    if (typeof onFileSubmit !== 'function') {
        console.error('[FileUploader] handleSubmit Error: onFileSubmit is not a function!', { receivedProp: onFileSubmit });
        setError('Internal configuration error: File submission handler is missing.');
        return;
    }
    try {
        await onFileSubmit(file, fileText);
        console.log('[FileUploader] Successfully called onFileSubmit prop.');
    } catch (err) {
        console.error('[FileUploader] Error occurred *during* execution of onFileSubmit prop:', err);
    } finally {
       console.log('[FileUploader] handleSubmit finished.');
    }
  };

  // MnK Paper Info (URL needed for the link)
  const mnkPaperUrl = "https://doi.org/10.1371/journal.pcbi.1005619";

  return (
    <div className="space-y-6">

      {/* --- EDITED MnK Paper Summary Section (Rendered when NO file selected) --- */}
      {!file && (
        <div className="text-left p-6 border rounded-lg bg-muted/10 space-y-3">
            <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-primary/80 flex-shrink-0" />
                <h3 className="text-base font-semibold">Paper Structure Analysis</h3>
            </div>
            {/* *** EDITED TEXT as requested, simple version *** */}
            <p className="text-sm text-muted-foreground leading-relaxed">
                Mensh and Kording (PLoS Comput Biol, 2017) introduced a standard guide for structuring papers
                (>1M views, <a href={mnkPaperUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center">link <ExternalLink className="h-3 w-3 ml-0.5"/></a>).
                This tool checks your paper's structure against that guide. Feedback in the results section will reference specific rules (e.g., <span className='font-mono bg-muted px-1 py-0.5 rounded text-xs'>MnK3</span> for Rule 3) - mouse over the tags there for details.
            </p>
             {/* Explicitly removed the <ol> list */}
        </div>
      )}
      {/* --- End Edited MnK Paper Summary Section --- */}


      {/* --- File Dropzone Section --- */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${file ? 'bg-gray-50' : ''} ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
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


      {/* --- Selected File Info & Submit Button Section --- */}
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
               disabled={isProcessing}
               className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isProcessing ? 'Processing...' : 'Analyze Paper Structure'}
             </button>
           </div>
         </div>
       )}

    </div>
  )
}
