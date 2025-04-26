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
 * Extract text from various file formats (client-side version)
 * @param {File} file - The uploaded file object
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(file) {
  console.log('[ProcessingService.client] Attempting to extract text from file:', file?.name, 'Type:', file?.type);

  if (!file || typeof file.arrayBuffer !== 'function') {
    console.error('[ProcessingService.client] Invalid file object received.');
    throw new Error('Invalid file object provided for text extraction.');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name?.endsWith('.docx')) {
      console.log('[ProcessingService.client] Extracting text from DOCX using mammoth...');
      const options = { arrayBuffer: arrayBuffer };
      const result = await mammoth.extractRawText(options);
      console.log('[ProcessingService.client] DOCX text extracted successfully.');
      clientDebugLog('extracted-docx-text', result.value);
      return result.value;
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
