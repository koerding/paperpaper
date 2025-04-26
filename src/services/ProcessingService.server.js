// File Path: src/services/ProcessingService.server.js
import mammoth from 'mammoth';
import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Server-side debug helper
const writeDebugFile = async (prefix, content) => {
  try {
    // Create debug directory if it doesn't exist
    const debugDir = path.join(process.cwd(), 'debug_logs');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Write to timestamped debug file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(debugDir, `${prefix}-${timestamp}.json`);
    
    // Format content based on type
    let formattedContent = content;
    if (typeof content === 'object') {
      formattedContent = JSON.stringify(content, null, 2);
    }
    
    fs.writeFileSync(filename, formattedContent);
    console.log(`[ProcessingService Debug] Wrote ${prefix} to ${filename}`);
    return filename;
  } catch (err) {
    console.error(`[ProcessingService Debug] Failed to write debug file for ${prefix}:`, err);
    return null;
  }
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
      const options = { buffer: Buffer.from(arrayBuffer) };
      const result = await mammoth.extractRawText(options);
      console.log('[ProcessingService] DOCX text extracted successfully.');
      // DEBUG - Save extracted text
      await writeDebugFile('extracted-docx-text', result.value);
      return result.value;
    } else if (file.type === 'text/plain' || file.name?.endsWith('.txt')) {
      console.log('[ProcessingService] Extracting text from TXT...');
      // Buffer conversion works reliably on both client and server for text
      const text = Buffer.from(arrayBuffer).toString('utf8');
      // DEBUG - Save extracted text
      await writeDebugFile('extracted-txt-text', text);
      return text;
    } else if (file.type === 'text/markdown' || file.name?.endsWith('.md')) {
      console.log('[ProcessingService] Extracting text from MD...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      // DEBUG - Save extracted text
      await writeDebugFile('extracted-md-text', text);
      return text;
    } else if (file.type === 'text/x-tex' || file.type === 'application/x-tex' || file.name?.endsWith('.tex')) {
      console.log('[ProcessingService] Extracting text from TeX (basic)...');
      const text = Buffer.from(arrayBuffer).toString('utf8');
      // DEBUG - Save extracted text
      await writeDebugFile('extracted-tex-text', text);
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

export const extractDocumentStructure = async (text) => {
  console.log('[ProcessingService] Attempting to extract document structure (AI/Fallback)...');
  
  // DEBUG - Save input text
  await writeDebugFile('parsing-input-text', text);
  
  const fallbackParse = () => {
    console.log('[ProcessingService] Using fallback parsing for document structure.');
    if (!text) return { title: 'Untitled', abstract: { text: '' }, sections: [] };
    
    // DEBUG - Provide detailed logging
    console.log(`[ProcessingService] Text length: ${text.length} chars`);
    
    // Extract lines for better analysis
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    console.log(`[ProcessingService] Found ${lines.length} non-empty lines`);
    if (lines.length > 0) {
      console.log(`[ProcessingService] First line: ${lines[0].substring(0, 50)}${lines[0].length > 50 ? '...' : ''}`);
    }
    
    if (lines.length === 0) return { title: 'Untitled (Empty)', abstract: { text: '' }, sections: [] };
    
    // Extract title - usually the first line - remove any markdown formatting
    const title = lines[0].replace(/\*\*/g, '').trim() || 'Untitled Document';
    console.log(`[ProcessingService] Extracted title: ${title}`);
    
    // Find abstract
    let abstract = '';
    const abstractIndex = lines.findIndex(line => {
      const lowerLine = line.toLowerCase().trim();
      return lowerLine === 'abstract' || 
             lowerLine === 'abstract:' || 
             lowerLine.includes('abstract:');
    });
    
    console.log(`[ProcessingService] Abstract line index: ${abstractIndex}`);
    
    if (abstractIndex !== -1) {
      // Find the end of the abstract (next section heading or keywords)
      let abstractEnd = lines.findIndex((line, i) => 
        i > abstractIndex && 
        (line.toLowerCase().includes('introduction') || 
         line.toLowerCase().includes('keywords') ||
         /^[0-9]\./.test(line) || // Numbered section
         /^[I|V|X]+\./.test(line)) // Roman numeral section
      );
      
      if (abstractEnd === -1) abstractEnd = lines.length; // Default to end if no clear end
      
      // Get all lines between abstract marker and end
      const abstractLines = lines.slice(abstractIndex + 1, abstractEnd);
      abstract = abstractLines.join(' ').trim();
      
      console.log(`[ProcessingService] Extracted abstract (${abstract.length} chars): ${abstract.substring(0, 100)}${abstract.length > 100 ? '...' : ''}`);
    }

    // Look for sections - include Keywords as a section
    let sections = [];
    let sectionMarkers = [];
    
    // Find potential section headers
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      // Check for common section header patterns
      if (
        (trimmedLine.toLowerCase() === 'introduction') ||
        (trimmedLine.toLowerCase() === 'methods') ||
        (trimmedLine.toLowerCase() === 'results') ||
        (trimmedLine.toLowerCase() === 'discussion') ||
        (trimmedLine.toLowerCase() === 'conclusion') ||
        (trimmedLine.toLowerCase().includes('keywords')) ||
        (/^[0-9]+\.\s/.test(trimmedLine)) || // Numbered sections (e.g., "1. Introduction")
        (/^[I|V|X]+\.\s/.test(trimmedLine)) || // Roman numerals (e.g., "I. Introduction")
        (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length < 50) // ALL CAPS HEADERS
      ) {
        sectionMarkers.push({ index, name: trimmedLine });
        console.log(`[ProcessingService] Potential section header at line ${index}: "${trimmedLine}"`);
      }
    });
    
    // If we found sections, extract content between them
    if (sectionMarkers.length > 0) {
      console.log(`[ProcessingService] Found ${sectionMarkers.length} potential section headers`);
      
      // Process each section
      sectionMarkers.forEach((marker, idx) => {
        const startLine = marker.index + 1; // Start after the header
        const endLine = idx < sectionMarkers.length - 1 ? sectionMarkers[idx + 1].index : lines.length;
        
        // Get content and split into paragraphs
        const sectionLines = lines.slice(startLine, endLine);
        const sectionText = sectionLines.join('\n');
        
        // Split into paragraphs based on line breaks
        const paragraphs = sectionText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        sections.push({
          name: marker.name,
          paragraphs: paragraphs.map(p => ({ text: p.trim() }))
        });
        
        console.log(`[ProcessingService] Added section "${marker.name}" with ${paragraphs.length} paragraphs`);
      });
    } else {
      // If no sections detected, split by paragraphs
      console.log('[ProcessingService] No clear section markers found, using paragraph-based splitting');
      
      // Split into paragraphs and skip title and abstract
      const paragraphs = text.split(/\n\s*\n/)
        .filter(p => p.trim().length > 0)
        .filter((p, idx) => {
          // Skip paragraphs that are already part of title or abstract
          const isTitle = idx === 0 && p.trim() === title;
          const isAbstract = abstract && p.includes(abstract);
          return !isTitle && !isAbstract;
        });
      
      // If we have paragraphs, create a Content section
      if (paragraphs.length > 0) {
        sections = [{
          name: 'Content',
          paragraphs: paragraphs.map(p => ({ text: p.trim() }))
        }];
        
        console.log(`[ProcessingService] Created single content section with ${paragraphs.length} paragraphs`);
      } else {
        // As a fallback, create at least one section with the content after title and abstract
        const contentAfterAbstract = lines.slice(abstractIndex + 1).join('\n');
        sections = [{
          name: 'Content',
          paragraphs: [{ text: contentAfterAbstract }]
        }];
        
        console.log('[ProcessingService] Created fallback content section');
      }
    }
    
    // Construct the document structure
    const result = {
      title,
      abstract: { text: abstract },
      sections: sections
    };
    
    // DEBUG - Save fallback parsed structure
    writeDebugFile('fallback-parsed-structure', result);
    
    return result;
  };

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[ProcessingService] OpenAI API Key is missing on the server.");
      throw new Error("OpenAI API Key not configured.");
    }

    console.log('[ProcessingService] Running on server, attempting AI structure parsing...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Take up to 12000 chars for structure parsing to handle longer papers
    const textSample = text ? text.substring(0, 12000) : "";

    if (!textSample) {
      console.warn("[ProcessingService] Cannot perform AI structure parsing on empty text. Falling back.");
      return fallbackParse();
    }
    
    // Create a detailed prompt for better structure recognition
    const prompt = `
You are a scientific paper structure extractor. Parse this paper text into a clear document structure with title, abstract, and sections with paragraphs.

INSTRUCTIONS:
1. Identify the paper title (usually at the beginning) - remove any ** or formatting markers
2. Find the abstract section (usually marked with "Abstract:" or appears early)
3. Identify distinct sections (like Introduction, Methods, Results, Discussion)
4. For each section, extract paragraphs

Sample paper text:
---
${textSample}
---

Return ONLY a JSON object with this structure:
{
  "title": "The full paper title",
  "abstract": {
    "text": "The complete abstract text"
  },
  "sections": [
    {
      "name": "Section name (e.g., Introduction, Methods, etc.)",
      "paragraphs": [
        { "text": "Full text of paragraph 1" },
        { "text": "Full text of paragraph 2" }
      ]
    }
  ]
}
`;

    // DEBUG - Save AI prompt
    await writeDebugFile('ai-parsing-prompt', prompt);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You parse scientific papers into structured JSON with accurate identification of title, abstract, sections and paragraphs. Be precise in extracting the exact content.'
        },
        {
          role: 'user',
          content: prompt
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
    
    // DEBUG - Save AI response
    await writeDebugFile('ai-parsing-response', response.choices[0].message.content);
    
    const parsedStructure = JSON.parse(response.choices[0].message.content);
    
    // DEBUG - Log structure stats
    console.log(`[ProcessingService] Parsed structure: title length=${parsedStructure.title?.length || 0}, abstract length=${parsedStructure.abstract?.text?.length || 0}, sections=${parsedStructure.sections?.length || 0}`);
    if (parsedStructure.sections) {
      parsedStructure.sections.forEach((section, i) => {
        console.log(`[ProcessingService] Section ${i}: "${section.name}" with ${section.paragraphs?.length || 0} paragraphs`);
      });
    }
    
    return parsedStructure;
  } catch (error) {
    console.error('[ProcessingService] Error in document structure parsing:', error);
    console.log('[ProcessingService] Falling back to basic parsing due to error.');
    return fallbackParse();
  }
};

// Export other server-side methods if needed
export const serverOnlyMethod = () => {
  console.log('This method is only available on the server');
  return true;
};
