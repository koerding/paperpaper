// File Path: src/services/ProcessingService.client.js
import mammoth from 'mammoth';

// Client-only debug logger
const clientDebugLog = (prefix, content) => {
  console.log(`[ProcessingService Client Debug] ${prefix}:`, 
    typeof content === 'object' ? 
      JSON.stringify(content).substring(0, 100) + '...' : 
      content?.substring?.(0, 100) + '...');
};

/**
 * Extract text from a PDF file using PDF.js from CDN
 * @param {ArrayBuffer} arrayBuffer - The PDF file as an array buffer
 * @param {Function} onProgress - Optional callback for progress updates (page, totalPages)
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromPDF(arrayBuffer, onProgress) {
  console.log('[ProcessingService.client] Extracting text from PDF...');
  try {
    // Dynamically load PDF.js from CDN
    if (typeof window.pdfjsLib === 'undefined') {
      console.log('[ProcessingService.client] Loading PDF.js from CDN...');
      
      // Create script element for the main library
      const scriptElement = document.createElement('script');
      scriptElement.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      
      // Wait for the script to load
      await new Promise((resolve, reject) => {
        scriptElement.onload = resolve;
        scriptElement.onerror = reject;
        document.head.appendChild(scriptElement);
      });
      
      // Set worker source path after library is loaded
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      console.log('[ProcessingService.client] PDF.js loaded from CDN successfully');
    }
    
    // Use the globally available pdfjsLib from the CDN
    const { pdfjsLib } = window;
    
    // Load the PDF file
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    console.log(`[ProcessingService.client] PDF loaded with ${numPages} pages`);
    
    // Call progress callback with initial state
    if (typeof onProgress === 'function') {
      onProgress(0, numPages);
    }
    
    // Extract text from each page
    let textContent = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      textContent.push(pageText);
      
      // Call progress callback with current page
      if (typeof onProgress === 'function') {
        onProgress(i, numPages);
      }
      
      if (i % 10 === 0 || i === numPages) {
        console.log(`[ProcessingService.client] Extracted text from page ${i}/${numPages}`);
      }
    }
    
    // Join all pages with double newlines between pages
    const fullText = textContent.join('\n\n');
    clientDebugLog('extracted-pdf-text', fullText);
    
    // Call progress callback with completion
    if (typeof onProgress === 'function') {
      onProgress(numPages, numPages, true);
    }
    
    return fullText;
  } catch (error) {
    console.error('[ProcessingService.client] Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from various file formats (client-side version)
 * @param {File} file - The uploaded file object
 * @param {Object} options - Additional options
 * @param {Function} options.onProgress - Optional callback for progress updates
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(file, options = {}) {
  console.log('[ProcessingService.client] Attempting to extract text from file:', file?.name, 'Type:', file?.type);

  if (!file || typeof file.arrayBuffer !== 'function') {
    console.error('[ProcessingService.client] Invalid file object received.');
    throw new Error('Invalid file object provided for text extraction.');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name?.endsWith('.docx')) {
      console.log('[ProcessingService.client] Extracting text from DOCX using mammoth...');
      const mammothOptions = { arrayBuffer: arrayBuffer };
      const result = await mammoth.extractRawText(mammothOptions);
      console.log('[ProcessingService.client] DOCX text extracted successfully.');
      clientDebugLog('extracted-docx-text', result.value);
      return result.value;
    } else if (file.type === 'application/pdf' || file.name?.endsWith('.pdf')) {
      // Handle PDF extraction with progress tracking
      return await extractTextFromPDF(arrayBuffer, options.onProgress);
    } else if (file.type === 'text/plain' || file.name?.endsWith('.txt')) {
      console.log('[ProcessingService.client] Extracting text from TXT...');
      const text = new TextDecoder().decode(arrayBuffer);
      clientDebugLog('extracted-txt-text', text);
      return text;
    } else if (file.type === 'text/markdown' || file.name?.endsWith('.md')) {
      console.log('[ProcessingService.client] Extracting text from MD...');
      const text = new TextDecoder().decode(arrayBuffer);
      clientDebugLog('extracted-md-text', text);
      return text;
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name?.endsWith('.tex')) {
      console.log('[ProcessingService.client] Extracting text from TeX (basic)...');
      const text = new TextDecoder().decode(arrayBuffer);
      clientDebugLog('extracted-tex-text', text);
      return text;
    } else {
      console.warn('[ProcessingService.client] Unsupported file type for text extraction:', file.type, file.name);
      throw new Error(`Unsupported file type for direct text extraction: ${file.name} (${file.type})`);
    }
  } catch (error) {
    console.error('[ProcessingService.client] Error extracting text from file:', file?.name, error);
    throw new Error(`Failed to extract text from file "${file?.name}": ${error.message}`);
  }
}

/**
 * Validate document size against maximum character limit
 * @param {string} text - Document text content
 * @param {number} maxChars - Maximum allowed characters
 * @returns {boolean} - Whether document size is valid
 */
export function validateDocumentSize(text, maxChars) {
  const length = text ? text.length : 0;
  const isValid = length <= maxChars;
  console.log(`[ProcessingService.client] Validating document size: ${length} chars <= ${maxChars} chars = ${isValid}`);
  return isValid;
}
