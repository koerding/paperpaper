// File Path: src/services/ProcessingService.client.js
// This version is safe to import in client components

import mammoth from 'mammoth';

// Client-only debug logger
const clientDebugLog = (prefix, content) => {
  console.log(`[ProcessingService Debug] ${prefix}:`, 
    typeof content === 'object' ? 
      JSON.stringify(content).substring(0, 100) + '...' : 
      content?.substring?.(0, 100) + '...');
};

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
      const options = { arrayBuffer: arrayBuffer };
      const result = await mammoth.extractRawText(options);
      console.log('[ProcessingService] DOCX text extracted successfully.');
      clientDebugLog('extracted-docx-text', result.value);
      return result.value;
    } else if (file.type === 'text/plain' || file.name?.endsWith('.txt')) {
      console.log('[ProcessingService] Extracting text from TXT...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      clientDebugLog('extracted-txt-text', text);
      return text;
    } else if (file.type === 'text/markdown' || file.name?.endsWith('.md')) {
      console.log('[ProcessingService] Extracting text from MD...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      clientDebugLog('extracted-md-text', text);
      return text;
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name?.endsWith('.tex')) {
      console.log('[ProcessingService] Extracting text from TeX (basic)...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      clientDebugLog('extracted-tex-text', text);
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

export function validateDocumentSize(text, maxChars) {
  const length = text ? text.length : 0;
  const isValid = length <= maxChars;
  console.log(`[ProcessingService] Validating document size: ${length} chars <= ${maxChars} chars = ${isValid}`);
  return isValid;
}

// Simple fallback parser that works on client-side
export const extractDocumentStructure = async (text) => {
  console.log('[ProcessingService] Client-side basic document structure parsing');
  
  const fallbackParse = () => {
    console.log('[ProcessingService] Using client-side fallback parsing.');
    if (!text) return { title: 'Untitled', abstract: { text: '' }, sections: [] };
    
    // Extract lines for better analysis
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return { title: 'Untitled (Empty)', abstract: { text: '' }, sections: [] };
    
    // Extract title - usually the first line - remove any markdown formatting
    const title = lines[0].replace(/\*\*/g, '').trim() || 'Untitled Document';
    
    // Find abstract
    let abstract = '';
    const abstractIndex = lines.findIndex(line => {
      const lowerLine = line.toLowerCase().trim();
      return lowerLine === 'abstract' || 
             lowerLine === 'abstract:' || 
             lowerLine.includes('abstract:');
    });
    
    if (abstractIndex !== -1) {
      // Get abstract content - simplified for client side
      const abstractLines = lines.slice(abstractIndex + 1, abstractIndex + 10);
      abstract = abstractLines.join(' ').trim();
    }

    // Simple structure - entire text as one section
    const contentParagraphs = text.split(/\n\s*\n/)
      .filter(p => p.trim().length > 0)
      .map(p => ({ text: p.trim() }));
    
    return {
      title,
      abstract: { text: abstract },
      sections: [{
        name: 'Content',
        paragraphs: contentParagraphs
      }]
    };
  };

  return fallbackParse();
};
