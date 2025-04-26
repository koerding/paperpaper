// File Path: src/services/ProcessingService.js
import mammoth from 'mammoth';

// Debug logger
const debugLog = (prefix, content) => {
  console.log(`[ProcessingService Debug] ${prefix}:`, 
    typeof content === 'object' ? 
      JSON.stringify(content).substring(0, 100) + '...' : 
      content?.substring?.(0, 100) + '...');
};

/**
 * Extract text from various file formats
 * @param {File} file - The uploaded file object
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(file) {
  console.log('[ProcessingService] Attempting to extract text from file:', file?.name, 'Type:', file?.type);

  if (!file || typeof file.arrayBuffer !== 'function') {
    console.error('[ProcessingService] Invalid file object received.');
    throw new Error('Invalid file object provided for text extraction.');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name?.endsWith('.docx')) {
      console.log('[ProcessingService] Extracting text from DOCX using mammoth...');
      const options = { buffer: Buffer.from(arrayBuffer) };
      const result = await mammoth.extractRawText(options);
      console.log('[ProcessingService] DOCX text extracted successfully.');
      debugLog('extracted-docx-text', result.value);
      return result.value;
    } else if (file.type === 'text/plain' || file.name?.endsWith('.txt')) {
      console.log('[ProcessingService] Extracting text from TXT...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      debugLog('extracted-txt-text', text);
      return text;
    } else if (file.type === 'text/markdown' || file.name?.endsWith('.md')) {
      console.log('[ProcessingService] Extracting text from MD...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      debugLog('extracted-md-text', text);
      return text;
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name?.endsWith('.tex')) {
      console.log('[ProcessingService] Extracting text from TeX (basic)...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      debugLog('extracted-tex-text', text);
      return text;
    } else {
      console.warn('[ProcessingService] Unsupported file type for text extraction:', file.type, file.name);
      throw new Error(`Unsupported file type for direct text extraction: ${file.name} (${file.type})`);
    }
  } catch (error) {
    console.error('[ProcessingService] Error extracting text from file:', file?.name, error);
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
  console.log(`[ProcessingService] Validating document size: ${length} chars <= ${maxChars} chars = ${isValid}`);
  return isValid;
}

// Client-side version with the same simplified interface
export const ProcessingServiceClient = {
  extractTextFromFile,
  validateDocumentSize
};
