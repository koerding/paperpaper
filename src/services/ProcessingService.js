/**
 * Extract document structure from text using AI
 * @param {string} text - The document text
 * @returns {Promise<Object>} - Structured document data
 */
export const extractDocumentStructure = async (text) => {
  // This is a fallback implementation if AI parsing fails
  const fallbackParse = () => {
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    
    // Extract potential title (first non-empty line)
    const title = lines[0] || 'Untitled Document'
    
    // Extract abstract (paragraph containing the word "abstract")
    let abstract = ''
    const abstractIndex = lines.findIndex(line => 
      line.toLowerCase().includes('abstract'))
    
    if (abstractIndex !== -1) {
      // Take the paragraph following "abstract"
      abstract = lines[abstractIndex + 1] || ''
    }
    
    // Simple section detection
    const sections = []
    let currentSection = { name: 'Introduction', paragraphs: [] }
    let currentParagraph = ''
    
    // Add all text to single section if it's short
    if (text.length < 5000) {
      // Split by double newlines to get paragraphs
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
      return {
        title: paragraphs[0] || 'Untitled Document',
        abstract: paragraphs[1] || '',
        sections: [{
          name: 'Content',
          paragraphs: paragraphs.slice(2)
        }]
      }
    }
    
    // Process line by line for longer documents
    for (let i = 1; i < lines.length; i++) {
      // Basic processing similar to before but simplified
      const line = lines[i].trim()
      
      if (line.length > 0 && line.length < 100 && 
          (line.toUpperCase() === line || /^[0-9]+\./.test(line))) {
        // Looks like a header
        if (currentParagraph) {
          currentSection.paragraphs.push(currentParagraph)
          currentParagraph = ''
        }
        
        if (currentSection.name && currentSection.paragraphs.length > 0) {
          sections.push(currentSection)
        }
        
        currentSection = { name: line, paragraphs: [] }
      } else if (line === '') {
        if (currentParagraph) {
          currentSection.paragraphs.push(currentParagraph)
          currentParagraph = ''
        }
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + line
      }
    }
    
    // Add final content
    if (currentParagraph) {
      currentSection.paragraphs.push(currentParagraph)
    }
    
    if (currentSection.name && currentSection.paragraphs.length > 0) {
      sections.push(currentSection)
    }
    
    return {
      title,
      abstract,
      sections: sections.length > 0 ? sections : [{ name: 'Content', paragraphs: [text] }]
    }
  }
  
  try {
    // If we're in a browser environment, we can't directly call OpenAI
    // We'll return a simplified structure and let the server do AI parsing
    if (typeof window !== 'undefined') {
      return fallbackParse()
    }
    
    // On the server, use OpenAI to parse the document structure
    // Import OpenAI dynamically to avoid issues with browser usage
    const { default: OpenAI } = await import('openai')
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    // Prepare a sample of the text for analysis
    // We'll use the first ~8000 characters to avoid token limits
    const textSample = text.substring(0, 8000)
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert at parsing scientific papers. Your task is to identify the structure of a paper, including its title, abstract, and sections with their paragraphs.' 
        },
        { 
          role: 'user', 
          content: `Parse the following scientific paper text into a structured format. Identify:
          1. The paper title
          2. The abstract
          3. The main sections and their paragraphs
          
          Return your analysis as a valid JSON object with this structure:
          {
            "title": "paper title",
            "abstract": "the abstract text",
            "sections": [
              {
                "name": "section name (e.g., Introduction, Methods, Results)",
                "paragraphs": [
                  "paragraph 1 text",
                  "paragraph 2 text"
                ]
              }
            ]
          }
          
          Paper text:
          ${textSample}
          
          Note: This is only the first part of the paper. Focus on identifying the structure correctly rather than including all content.`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
    
    // Parse the AI response
    const parsedStructure = JSON.parse(response.choices[0].message.content)
    
    // Now we need to map the identified sections to the full text
    // This approach preserves the AI's section identification but uses the full text
    const fullStructure = mapSectionsToFullText(parsedStructure, text)
    
    return fullStructure
  } catch (error) {
    console.error('Error in AI document parsing:', error)
    console.log('Falling back to basic parsing')
    // Fall back to basic parsing if AI fails
    return fallbackParse()
  }
}

/**
 * Maps the AI-identified sections to the full text of the document
 * @param {Object} parsedStructure - The structure identified by AI
 * @param {string} fullText - The complete document text
 * @returns {Object} - Complete document structure
 */
const mapSectionsToFullText = (parsedStructure, fullText) => {
  // Start with the AI-identified structure
  const result = {
    title: parsedStructure.title,
    abstract: parsedStructure.abstract,
    sections: []
  }
  
  // If the AI couldn't identify sections, fall back to a basic approach
  if (!parsedStructure.sections || parsedStructure.sections.length === 0) {
    // Split the text into paragraphs
    const paragraphs = fullText.split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
    
    // Remove title and abstract if they're in the paragraphs
    let startIndex = 0
    if (paragraphs[0]?.includes(result.title)) startIndex++
    if (paragraphs[startIndex]?.includes(result.abstract)) startIndex++
    
    // Add remaining content as a single section
    result.sections = [{
      name: 'Content',
      paragraphs: paragraphs.slice(startIndex)
    }]
    
    return result
  }
  
  // For each section identified by the AI
  for (const section of parsedStructure.sections) {
    // Try to find this section in the full text
    const sectionRegex = new RegExp(
      `(^|\\n)\\s*${escapeRegExp(section.name)}\\s*(\\n|$)`, 'i'
    )
    
    const match = fullText.match(sectionRegex)
    
    if (match) {
      // Found the section header
      const sectionStart = match.index
      
      // Find the next section or end of text
      let nextSectionStart = fullText.length
      const nextSectionIndex = parsedStructure.sections.indexOf(section) + 1
      
      if (nextSectionIndex < parsedStructure.sections.length) {
        const nextSection = parsedStructure.sections[nextSectionIndex]
        const nextSectionRegex = new RegExp(
          `(^|\\n)\\s*${escapeRegExp(nextSection.name)}\\s*(\\n|$)`, 'i'
        )
        const nextMatch = fullText.substr(sectionStart).match(nextSectionRegex)
        
        if (nextMatch) {
          nextSectionStart = sectionStart + nextMatch.index
        }
      }
      
      // Extract section text
      const sectionText = fullText.substring(sectionStart, nextSectionStart)
      
      // Split into paragraphs
      const paragraphs = sectionText
        .replace(new RegExp(`^\\s*${escapeRegExp(section.name)}\\s*\\n`, 'i'), '') // Remove header
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
      
      // Add to result
      result.sections.push({
        name: section.name,
        paragraphs
      })
    } else {
      // Section header not found, use AI-provided paragraphs
      result.sections.push(section)
    }
  }
  
  // Ensure we have at least one section
  if (result.sections.length === 0) {
    result.sections = [{
      name: 'Content',
      paragraphs: [fullText]
    }]
  }
  
  return result
}

/**
 * Escape special characters for use in a RegExp
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
