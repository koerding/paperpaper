// File Path: src/components/FileUploader.jsx
'use client'
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
// Only import icons we know exist
import { Cloud, FileText, Info, ExternalLink } from 'lucide-react';
import { useAppContext } from '@/context/AppContext.jsx';
import { extractTextFromFile } from '@/services/ProcessingService.client.js';
// Import rules data for tooltips
import allRulesData from '@/rules.json'; // Adjust path if needed
// Import Tippy for tooltips
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; // Default Tippy CSS

// --- Build Rule Title Map Dynamically ---
const buildRuleMap = () => {
    const map = new Map();
    if (allRulesData?.rules && Array.isArray(allRulesData.rules)) {
        allRulesData.rules.forEach(rule => {
            if (rule.originalRuleNumber && rule.title) {
                map.set(String(rule.originalRuleNumber), rule.title);
            }
        });
        console.log('[FileUploader] Built rule title map dynamically:', map.size, 'entries');
    } else {
        console.error('[FileUploader] Failed to load or parse rules.json for tooltips.');
    }
    return map;
};
const ruleTitleMap = buildRuleMap(); // Build map once
const getRuleTitle = (ruleNum) => {
    const key = String(ruleNum);
    const title = ruleTitleMap.get(key);
    if (!title) { console.warn(`[FileUploader:getRuleTitle] No title found for rule number: "${key}"`); }
    return title || 'Unknown Rule';
};

// --- MnK Tag Component (Inline version for this file) ---
const MnkTag = ({ ruleNum }) => {
    const title = getRuleTitle(ruleNum);
    return (
        <Tippy content={title} placement="top" arrow={true} appendTo={() => document.body}>
            <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm text-xs mx-0.5 cursor-help whitespace-nowrap">
                MnK{ruleNum}
            </span>
        </Tippy>
    );
};

// --- FileUploader Component ---
export default function FileUploader({ onFileSubmit, isProcessing }) {
  const { setError } = useAppContext();
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPdfFile, setIsPdfFile] = useState(false);
  const maxSize = 20 * 1024 * 1024;
  
  // onDrop handler with PDF support
  const onDrop = useCallback(async (acceptedFiles, fileRejections) => {
        console.log('[FileUploader] onDrop triggered. Accepted files:', acceptedFiles?.length || 0);
        
        // Log any rejections for debugging
        if (fileRejections && fileRejections.length > 0) {
          console.error('[FileUploader] Files rejected:', fileRejections);
          const rejectReasons = fileRejections.map(reject => 
            `${reject.file.name}: ${reject.errors.map(e => e.message).join(', ')}`
          ).join('; ');
          setError(`File rejected: ${rejectReasons}`);
          return;
        }
        
        setError(null);
        const uploadedFile = acceptedFiles[0];
        if (!uploadedFile) { 
            console.log('[FileUploader] No file accepted.');
            return; 
        }
        
        console.log('[FileUploader] File details:', {
            name: uploadedFile.name,
            type: uploadedFile.type,
            size: uploadedFile.size,
            lastModified: new Date(uploadedFile.lastModified).toISOString()
        });
        
        // Reset states
        setFile(uploadedFile);
        setFileText('');
        
        // Check if it's a PDF file
        const isPdf = uploadedFile.type === 'application/pdf' || uploadedFile.name?.endsWith('.pdf');
        console.log(`[FileUploader] Is PDF file? ${isPdf}`);
        setIsPdfFile(isPdf);
        
        // Validation logic
        if (uploadedFile.size > maxSize) { 
            setError('File is too large. Maximum size is 10MB.'); 
            setFile(null); 
            return; 
        }
        
        // Client-side text extraction
        try {
            setIsExtracting(true);
            console.log(`[FileUploader] Starting text extraction for ${uploadedFile.name}`);
            
            const extractedText = await extractTextFromFile(uploadedFile);
            console.log(`[FileUploader] Client-side text extracted successfully. Length: ${extractedText.length}`);
            
            if (extractedText.length > 100000) { 
                setError('Document is too long (client-side check). Maximum 100,000 characters allowed.'); 
                setFile(null); 
                return; 
            }
            
            setFileText(extractedText);
        } catch (err) { 
            console.warn('[FileUploader] Could not extract text client-side:', err);
            // Set specific error for PDF extraction failures
            if (isPdf) {
                setError(`Could not extract text from PDF: ${err.message}. Try a different PDF or file format.`);
            } else {
                setError(`Error extracting text: ${err.message}`);
            }
        } finally {
            setIsExtracting(false);
        }
   }, [setError, maxSize]);
   
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ 
    onDrop, 
    multiple: false, 
    maxSize,
    // Simplified accept config - this can sometimes cause issues in some browsers
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/x-tex': ['.tex'],
      'application/x-tex': ['.tex']
    },
    noClick: false, // Make sure click is enabled
    noKeyboard: false, // Make sure keyboard is enabled
  });
  
  const handleSubmit = async () => {
      if (!file) { setError('Please select a file first.'); return; }
      console.log('[FileUploader] handleSubmit called for file:', file.name);
      if (typeof onFileSubmit !== 'function') { 
          setError('Internal configuration error: Cannot submit file.'); 
          console.error('[FileUploader] onFileSubmit is not a function!'); 
          return; 
      }
      try { 
          await onFileSubmit(file, fileText); 
          console.log('[FileUploader] Successfully called onFileSubmit prop.'); 
      }
      catch (err) { 
          console.error('[FileUploader] Error calling onFileSubmit prop:', err); 
          setError(`Error submitting file: ${err.message}`);
      }
      finally { 
          console.log('[FileUploader] handleSubmit finished.'); 
      }
   };
   
  // Get appropriate file icon based on file type - only using FileText for everything
  const getFileIcon = () => {
    // Use FileText for all types, but with different colors
    if (file && (file.type === 'application/pdf' || file.name?.endsWith('.pdf'))) {
      return <FileText className="h-6 w-6 text-red-500" />;
    }
    
    return <FileText className="h-6 w-6 text-primary" />;
  };
  
  // MnK Paper Info
  const mnkPaperUrl = "https://doi.org/10.1371/journal.pcbi.1005619";
  
  return (
    <div className="space-y-6">
      {/* MnK Paper Summary Section */}
      {!file && (
        <div className="text-left p-6 border rounded-lg bg-muted/10 space-y-3">
            <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-primary/80 flex-shrink-0" />
                <h3 className="text-base font-semibold">Paper Structure Analysis</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
                Mensh and Kording (PLoS Comput Biol, 2017) introduced a standard guide for structuring papers
                (&gt;1M views, <a href={mnkPaperUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center">link <ExternalLink className="h-3 w-3 ml-0.5"/></a>).
                This tool checks your paper's structure against that guide (e.g., <MnkTag ruleNum="1" />, <MnkTag ruleNum="2" />, <MnkTag ruleNum="3" />...).
                Mouse over the <span className='font-mono bg-muted px-1 py-0.5 rounded text-xs'>MnK$</span> tags in the results for rule details.
            </p>
        </div>
      )}
      
      {/* File Dropzone Section */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors 
          ${file ? 'bg-gray-50' : ''} 
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
      >
         <input {...getInputProps()} />
         <div className="flex flex-col items-center justify-center space-y-4">
           <Cloud className="h-12 w-12 text-muted-foreground/50" />
           <div className="space-y-2">
             <p className="text-lg font-medium">{isDragActive ? 'Drop the file here' : 'Drag and drop your paper file'}</p>
             <p className="text-sm text-muted-foreground">or click to browse files</p>
           </div>
           <div className="text-xs text-muted-foreground max-w-md">
             Supported formats: <strong>.pdf</strong>, .docx, .txt, .md, .tex<br />
             Maximum file size: 10MB
           </div>
         </div>
       </div>
       
      {/* Alternative manual file input button */}
      {!file && (
        <div className="text-center">
          <button 
            type="button"
            onClick={open}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
          >
            Or click here to select a file
          </button>
        </div>
      )}
       
      {/* Selected File Info & Submit Button Section */}
      {file && (
        <div className="border rounded-lg p-4 space-y-4">
           <div className="flex items-center space-x-3">
             {getFileIcon()}
             <div className="flex-grow">
               <p className="font-medium">{file.name}</p>
               <p className="text-sm text-muted-foreground">
                 {(file.size / 1024).toFixed(1)} KB 
                 {isExtracting && " (Extracting text...)"}
                 {fileText && ` (~${fileText.length} chars extracted)`} 
                 {!fileText && !isExtracting && ' (Server Extraction)'}
               </p>
             </div>
           </div>
           
           <div className="flex justify-end">
             <button 
               onClick={handleSubmit} 
               disabled={isProcessing || isExtracting} 
               className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isProcessing ? 'Processing...' : isExtracting ? 'Extracting Text...' : 'Analyze Paper Structure'}
             </button>
           </div>
         </div>
       )}
    </div>
  )
}
