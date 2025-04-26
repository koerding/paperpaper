// File Path: src/services/ProcessingService.js
// This file acts as a re-export to provide compatibility with existing imports

// Import from client version, safe for browser use
import { 
  extractTextFromFile as clientExtractTextFromFile,
  validateDocumentSize as clientValidateDocumentSize,
  extractDocumentStructure as clientExtractDocumentStructure
} from './ProcessingService.client.js';

// Export client-safe methods
export const extractTextFromFile = clientExtractTextFromFile;
export const validateDocumentSize = clientValidateDocumentSize;
export const extractDocumentStructure = clientExtractDocumentStructure;

// Note: For server-side components and API routes,
// import directly from ProcessingService.server.js:
// import { extractDocumentStructure } from './ProcessingService.server.js';
