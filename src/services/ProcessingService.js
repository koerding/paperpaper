// Import mammoth for docx processing
import mammoth from 'mammoth';
import { default as OpenAI } from 'openai'; // Keep existing OpenAI import for extractDocumentStructure

/**
 * Extracts raw text content from various file types.
 * Works with both browser File objects and server-side buffers/File objects.
 * @param {File|{arrayBuffer: () => Promise<ArrayBuffer>, type: string, name: string}} file - File object or compatible structure
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(file) {
  console.log('[ProcessingService] Attempting to extract text from file:', file.name, 'Type:', file.type);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer); // Ensure we have a buffer

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
      console.log('[ProcessingService] Extracting text from DOCX using mammoth...');
      const result = await mammoth.extractRawText({ buffer });
      console.log('[ProcessingService] DOCX text extracted successfully.');
      return result.value;
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      console.log('[ProcessingService] Extracting text from TXT...');
      return buffer.toString('utf8');
    } else if (file.type === 'text/markdown' || file.name.endsWith('.md')) {
      console.log('[ProcessingService] Extracting text from MD...');
      return buffer.toString('utf8');
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name.endsWith('.tex')) {
      console.log('[ProcessingService] Extracting text from TeX (basic)...');
      // Basic extraction, might need more robust LaTeX parsing later
      return buffer.toString('utf8');
    } else {
      console.warn('[ProcessingService] Unsupported file type for text extraction:', file.type, file.name);
      throw new Error(`Unsupported file type for direct text extraction: ${file.name} (${file.type})`);
    }
  } catch (error) {
    console.error('[ProcessingService] Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}


/**
 * Validate document size based on character count.
 * @param {string} text - The document text.
 * @param {number} maxChars - Maximum allowed characters.
 * @returns {boolean} - True if the document size is valid.
 */
export function validateDocumentSize(text, maxChars) {
    const isValid = text && text.length <= maxChars;
    console.log(`[ProcessingService] Validating document size: ${text?.length} chars <= ${maxChars} chars = ${isValid}`);
    return isValid;
}


// --- Keep the existing extractDocumentStructure function ---
// --- It seems intended for AI-based structure parsing, ---
// --- which might be needed later or by the AI service. ---

/**
 * Extract document structure from text using AI (or fallback)
 * @param {string} text - The document text
 * @returns {Promise<Object>} - Structured document data
 */
export const extractDocumentStructure = async (text) => {
  console.log('[ProcessingService] Attempting to extract document structure (AI/Fallback)...');
  // This is a fallback implementation if AI parsing fails
  const fallbackParse = () => {
    console.log('[ProcessingService] Using fallback parsing for document structure.');
    const lines = text.split('\n').filter(line => line.trim().length > 0);
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

  try {
    // Prefer server-side AI parsing if possible
    if (typeof window !== 'undefined') {
      console.log('[ProcessingService] Running in browser, cannot use AI for structure parsing here. Falling back.');
      return fallbackParse();
    }

    console.log('[ProcessingService] Running on server, attempting AI structure parsing...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const textSample = text.substring(0, 8000); // Sample for prompt efficiency

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o', // Ensure model is set
      messages: [
        {
          role: 'system',
          content: 'You parse scientific papers into structured JSON (title, abstract, sections with paragraphs).'
        },
        {
          role: 'user',
          content: `Parse the structure (title, abstract, sections, paragraphs) from this text sample into JSON format:\n\n${textSample}`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    console.log('[ProcessingService] AI structure parsing successful.');
    const parsedStructure = JSON.parse(response.choices[0].message.content);
    // Optionally map AI structure to full text if needed (implementation omitted for brevity)
    // const fullStructure = mapSectionsToFullText(parsedStructure, text);
    // For now, return the AI-parsed structure based on the sample
    return parsedStructure;
  } catch (error) {
    console.error('[ProcessingService] Error in AI document structure parsing:', error);
    console.log('[ProcessingService] Falling back to basic parsing due to AI error.');
    return fallbackParse();
  }
};

// Helper function (only if needed for mapping AI structure to full text)
/*
const mapSectionsToFullText = (parsedStructure, fullText) => {
  // Implementation needed if you want to map AI section names to full text paragraphs
  console.log('[ProcessingService] Mapping AI structure to full text (if implemented).');
  // For now, just returning the AI parsed structure
  return parsedStructure;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
*/
