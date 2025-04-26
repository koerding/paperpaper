// File Path: src/services/ProcessingService.js
import mammoth from 'mammoth';
import { default as OpenAI } from 'openai';

// Function to detect if running in browser
const isBrowser = typeof window !== 'undefined';

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
      // *** Pass arrayBuffer directly when in browser, buffer otherwise ***
      const options = isBrowser ? { arrayBuffer: arrayBuffer } : { buffer: Buffer.from(arrayBuffer) };
      const result = await mammoth.extractRawText(options);
      console.log('[ProcessingService] DOCX text extracted successfully.');
      return result.value;
    } else if (file.type === 'text/plain' || file.name?.endsWith('.txt')) {
      console.log('[ProcessingService] Extracting text from TXT...');
      // Buffer conversion works reliably on both client and server for text
      return Buffer.from(arrayBuffer).toString('utf8');
    } else if (file.type === 'text/markdown' || file.name?.endsWith('.md')) {
      console.log('[ProcessingService] Extracting text from MD...');
      return Buffer.from(arrayBuffer).toString('utf8');
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name?.endsWith('.tex')) {
      console.log('[ProcessingService] Extracting text from TeX (basic)...');
      return Buffer.from(arrayBuffer).toString('utf8');
    } else {
      console.warn('[ProcessingService] Unsupported file type for text extraction:', file.type, file.name);
      throw new Error(`Unsupported file type for direct text extraction: ${file.name} (${file.type})`);
    }
  } catch (error) {
    console.error('[ProcessingService] Error extracting text from file:', file?.name, error);
    throw new Error(`Failed to extract text from file "${file?.name}": ${error.message}`);
  }
}

export function validateDocumentSize(text, maxChars) {
    const length = text ? text.length : 0;
    const isValid = length <= maxChars;
    console.log(`[ProcessingService] Validating document size: ${length} chars <= ${maxChars} chars = ${isValid}`);
    return isValid;
}

export const extractDocumentStructure = async (text) => {
  console.log('[ProcessingService] Attempting to extract document structure (AI/Fallback)...');
  const fallbackParse = () => {
    console.log('[ProcessingService] Using fallback parsing for document structure.');
     if (!text) return { title: 'Untitled', abstract: '', sections: [] };
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
           paragraphs: paragraphs.slice(2).map(p => ({ text: p }))
         }]
       };
    }

    console.log('[ProcessingService] Fallback: Longer document, basic section detection.');
    const sections = [];
    let currentSection = { name: 'Introduction', paragraphs: [] };
    text.split(/\n\s*\n/).forEach(p => {
       const trimmedP = p.trim();
       if (trimmedP.length > 0) {
           if (trimmedP.length < 100 && (trimmedP.toUpperCase() === trimmedP || /^[0-9]+\./.test(trimmedP))) {
               if (currentSection.paragraphs.length > 0) sections.push(currentSection);
               currentSection = { name: trimmedP, paragraphs: [] };
           } else {
               currentSection.paragraphs.push({ text: trimmedP });
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
    if (isBrowser) {
      console.log('[ProcessingService] Running in browser, cannot use AI for structure parsing here. Falling back.');
      return fallbackParse();
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error("[ProcessingService] OpenAI API Key is missing on the server.");
        throw new Error("OpenAI API Key not configured.");
    }

    console.log('[ProcessingService] Running on server, attempting AI structure parsing...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const textSample = text ? text.substring(0, 8000) : "";

    if (!textSample) {
       console.warn("[ProcessingService] Cannot perform AI structure parsing on empty text. Falling back.");
       return fallbackParse();
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
    if (!response.choices[0]?.message?.content) {
        console.error("[ProcessingService] AI response content is missing.");
        throw new Error("Invalid response received from AI service.");
    }
    const parsedStructure = JSON.parse(response.choices[0].message.content);
    return parsedStructure;

  } catch (error) {
    console.error('[ProcessingService] Error in AI document structure parsing:', error);
    console.log('[ProcessingService] Falling back to basic parsing due to AI error.');
    return fallbackParse();
  }
};
