/**
 * Analyze document structure using OpenAI GPT
 * @param {Object} document - Structured document object
 * @param {string} rawText - Optional raw document text (for parsing)
 * @returns {Promise<Object>} - Analysis results
 */
export const analyzeDocumentStructure = async (document, rawText = null) => {
  try {
    // If raw text is provided and document structure is incomplete
    // we'll use AI to parse the document first
    if (rawText && (!document.sections || document.sections.length === 0)) {
      // Import ProcessingService dynamically to avoid circular imports
      const { extractDocumentStructure } = await import('./ProcessingService')
      document = await extractDocumentStructure(rawText)
    }
    
    // First analyze paragraphs
    const paragraphAnalysis = await analyzeParagraphs(document)
    
    // Then analyze document as a whole
    const documentAnalysis = await analyzeDocumentLevel(
      document.title,
      document.abstract,
      extractParagraphSummaries(paragraphAnalysis)
    )
    
    // Merge and process results
    return mergeAnalyses(paragraphAnalysis, documentAnalysis)
  } catch (error) {
    console.error('Error in document analysis:', error)
    throw new Error('Failed to analyze document: ' + error.message)
  }
}
