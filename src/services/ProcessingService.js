// Import mammoth for docx processing
import mammoth from 'mammoth';
import { default as OpenAI } from 'openai'; // Keep existing OpenAI import for extractDocumentStructure

/**
 * Extracts raw text content from various file types.
 * Works with both browser File objects and server-side buffers/File objects.
 * @param {File|{arrayBuffer: () => Promise<ArrayBuffer>, type: string, name: string}} file - File object or compatible structure
 * @returns {Promise<string>} - Extracted text content
 */
// ****** ENSURE 'export' KEYWORD IS PRESENT HERE ******
export async function extractTextFromFile(file) {
  console.log('[ProcessingService] Attempting to extract text from file:', file?.name, 'Type:', file?.type);

  // Add a check for the file object itself
  if (!file || typeof file.arrayBuffer !== 'function') {
     console.error('[ProcessingService] Invalid file object received.');
     throw new Error('Invalid file object provided for text extraction.');
  }


  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer); // Ensure we have a buffer

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name?.endsWith('.docx')) {
      console.log('[ProcessingService] Extracting text from DOCX using mammoth...');
      const result = await mammoth.extractRawText({ buffer });
      console.log('[ProcessingService] DOCX text extracted successfully.');
      return result.value;
    } else if (file.type === 'text/plain' || file.name?.endsWith('.txt')) {
      console.log('[ProcessingService] Extracting text from TXT...');
      return buffer.toString('utf8');
    } else if (file.type === 'text/markdown' || file.name?.endsWith('.md')) {
      console.log('[ProcessingService] Extracting text from MD...');
      return buffer.toString('utf8');
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name?.endsWith('.tex')) {
      console.log('[ProcessingService] Extracting text from TeX (basic)...');
      // Basic extraction, might need more robust LaTeX parsing later
      return buffer.toString('utf8');
    } else {
      console.warn('[ProcessingService] Unsupported file type for text extraction:', file.type, file.name);
      // Return empty string or throw error, depending on desired behavior
      // Throwing error is likely better to signal failure upstream
      throw new Error(`Unsupported file type for direct text extraction: <span class="math-inline">\{file\.name\} \(</span>{file.type})`);
    }
  } catch (error) {
    console.error('[ProcessingService] Error extracting text from file:', file?.name, error);
    // Re-throw a more specific error
    throw new Error(`Failed to extract text from file "${file?.name}": ${error.message}`);
  }
}


/**
 * Validate document size based on character count.
 * @param {string} text - The document text.
 * @param {number} maxChars - Maximum allowed characters.
 * @returns {boolean} - True if the document size is valid.
 */
// ****** ENSURE 'export' KEYWORD IS PRESENT HERE ******
export function validateDocumentSize(text, maxChars) {
    const length = text ? text.length : 0;
    const isValid = length <= maxChars;
    console.log(`[ProcessingService] Validating document size: ${length} chars <= ${maxChars} chars = ${isValid}`);
    return isValid;
}


// --- Keep the existing extractDocumentStructure function ---
// --- Ensure it is also exported if used elsewhere, like AIservice ---

/**
 * Extract document structure from text using AI (or fallback)
 * @param {string} text - The document text
 * @returns {Promise<Object>} - Structured document data
 */
// ****** ENSURE 'export' KEYWORD IS PRESENT HERE ******
export const extractDocumentStructure = async (text) => {
  console.log('[ProcessingService] Attempting to extract document structure (AI/Fallback)...');
  // This is a fallback implementation if AI parsing fails
  const fallbackParse = () => {
    console.log('[ProcessingService] Using fallback parsing for document structure.');
     if (!text) return { title: 'Untitled', abstract: '', sections: [] }; // Handle null/empty text
    const lines = text.split('\n').filter(line => line.trim().length > 0);
     if (lines.length === 0) return { title: 'Untitled (Empty)', abstract: '', sections: [] };
    const title = lines[0] || 'Untitled Document';
    let abstract = '';
    const abstractIndex = lines.findIndex(line =>
      line.toLowerCase().includes('abstract'));
    if (abstractIndex !== -1 && lines[abstractIndex + 1]) {
      abstract = lines[abstractIndex + 1];
    }

    if (text.length < 5000) {
       console.log('[ProcessingService] Fallback: Short document, simple structure.');
       const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
       return {
         title: paragraphs[0] || 'Untitled Document',
         abstract: paragraphs[1] || '',
         sections: [{
           name: 'Content',
           paragraphs: paragraphs.slice(2).map(p => ({ text: p })) // Wrap in object if needed later
         }]
       };
    }

    console.log('[ProcessingService] Fallback: Longer document, basic section detection.');
    // Basic section/paragraph splitting for longer docs
    const sections = [];
    let currentSection = { name: 'Introduction', paragraphs: [] };
    text.split(/\n\s*\n/).forEach(p => {
       const trimmedP = p.trim();
       if (trimmedP.length > 0) {
           // Very basic header detection (improve if needed)
           if (trimmedP.length < 100 && (trimmedP.toUpperCase() === trimmedP || /^[0-9]+\./.test(trimmedP))) {
               if (currentSection.paragraphs.length > 0) sections.push(currentSection);
               currentSection = { name: trimmedP, paragraphs: [] };
           } else {
               currentSection.paragraphs.push({ text: trimmedP }); // Wrap in object
           }
       }
    });
     if (currentSection.paragraphs.length > 0) sections.push(currentSection);

    return {
      title,
      abstract,
      sections: sections.length > 0 ? sections : [{ name: 'Content', paragraphs: [{ text: text }] }]
    };
  }

  // --- Rest of the extractDocumentStructure function (AI part) remains the same ---
  try {
    if (typeof window !== 'undefined') {
      console.log('[ProcessingService] Running in browser, cannot use AI for structure parsing here. Falling back.');
      return fallbackParse();
