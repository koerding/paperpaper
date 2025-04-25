import mammoth from 'mammoth'

/**
 * Extract text from various file formats
 * @param {File} file - The file object to extract text from
 * @returns {Promise<string>} - The extracted text
 */
export const extractTextFromFile = async (file) => {
  // For basic text files
  if (file.type === 'text/plain' || file.type === 'text/markdown') {
    return readTextFile(file)
  }
  
  // For docx files
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractFromDocx(file)
  }
  
  // For LaTeX files - they might come with various MIME types or none
  if (file.type === 'text/x-tex' || 
      file.type === 'application/x-tex' || 
      file.name.endsWith('.tex')) {
    return extractFromLatex(file)
  }
  
  throw new Error(`Unsupported file type: ${file.type}`)
}

/**
 * Read a text file
 * @param {File} file - The text file to read
 * @returns {Promise<string>} - The text content
 */
const readTextFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target.result)
    reader.onerror = (error) => reject(error)
    reader.readAsText(file)
  })
}

/**
 * Extract text from a DOCX file
 * @param {File} file - The DOCX file to extract text from
 * @returns {Promise<string>} - The extracted text
 */
const extractFromDocx = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  } catch (error) {
    console.error('Error extracting text from DOCX:', error)
    throw new Error('Failed to extract text from DOCX file')
  }
}

/**
 * Extract text from a LaTeX file
 * @param {File} file - The LaTeX file to extract text from
 * @returns {Promise<string>} - The extracted text
 */
const extractFromLatex = async (file) => {
  try {
    const content = await readTextFile(file)
    return stripLatexCommands(content)
  } catch (error) {
    console.error('Error extracting text from LaTeX:', error)
    throw new Error('Failed to extract text from LaTeX file')
  }
}

/**
 * Strip LaTeX commands from a string
 * @param {string} latex - The LaTeX content
 * @returns {string} - The stripped text
 */
const stripLatexCommands = (latex) => {
  // Basic LaTeX parsing - this is simplified and won't handle all LaTeX constructs
  
  // Remove comments
  let text = latex.replace(/%.*$/gm, '')
  
  // Remove commands with braces like \command{content}
  // but preserve the content inside the braces
  text = text.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, '$1')
  
  // Remove standalone commands like \command
  text = text.replace(/\\[a-zA-Z]+/g, '')
  
  // Remove environment blocks we don't want to include
  text = text.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, '')
  text = text.replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, '')
  
  // Replace math environments with placeholder
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '[MATH]')
  text = text.replace(/\$[\s\S]*?\$/g, '[MATH]')
  
  // Remove remaining LaTeX artifacts
  text = text.replace(/[\{\}\\]/g, '')
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}

/**
 * Extract document structure from text
 * @param {string} text - The document text
 * @returns {Object} - Structured document data
 */
export const extractDocumentStructure = (text) => {
  // This is a simplified implementation that tries to identify:
  // 1. Title (first few lines)
  // 2. Abstract (paragraph containing "abstract")
  // 3. Sections (lines that look like headers)
  // 4. Paragraphs within sections
  
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
  
  // Extract sections and paragraphs
  const sections = []
  let currentSection = { name: 'Introduction', paragraphs: [] }
  let currentParagraph = ''
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip if already processed as abstract
    if (i === abstractIndex || i === abstractIndex + 1) continue
    
    // Check if line is a potential section header
    const isSectionHeader = (
      line.length < 100 &&
      (line.toUpperCase() === line || // ALL CAPS
       /^[0-9]+\.\s+[A-Z]/.test(line) || // Numbered section
       /^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,4}$/.test(line)) // Title Case, 1-5 words
    )
    
    if (isSectionHeader) {
      // Save current paragraph if not empty
      if (currentParagraph) {
        currentSection.paragraphs.push(currentParagraph)
        currentParagraph = ''
      }
      
      // Save current section if not empty
      if (currentSection.name && currentSection.paragraphs.length > 0) {
        sections.push(currentSection)
      }
      
      // Start a new section
      currentSection = { name: line, paragraphs: [] }
    } else {
      // Handle paragraph breaks
      if (line === '' && currentParagraph !== '') {
        currentSection.paragraphs.push(currentParagraph)
        currentParagraph = ''
      } else if (line !== '') {
        // Append to current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + line
      }
    }
  }
  
  // Add final paragraph and section
  if (currentParagraph) {
    currentSection.paragraphs.push(currentParagraph)
  }
  
  if (currentSection.name && currentSection.paragraphs.length > 0) {
    sections.push(currentSection)
  }
  
  return {
    title,
    abstract,
    sections
  }
}

/**
 * Validate document size
 * @param {string} text - Document text
 * @param {number} maxCharCount - Maximum allowed character count
 * @returns {boolean} - Whether document is valid
 */
export const validateDocumentSize = (text, maxCharCount = 100000) => {
  return text.length <= maxCharCount
}

/**
 * Prepare document for AI analysis
 * @param {Object} document - Structured document data
 * @returns {Object} - Document prepared for analysis
 */
export const prepareForAnalysis = (document) => {
  // Format document for AI prompt
  const formattedSections = document.sections.map(section => {
    const formattedParagraphs = section.paragraphs.map(paragraph => {
      // Trim long paragraphs to reduce token usage
      return paragraph.length > 500 
        ? paragraph.substring(0, 500) + '...' 
        : paragraph
    })
    
    return {
      name: section.name,
      paragraphs: formattedParagraphs
    }
  })
  
  return {
    title: document.title,
    abstract: document.abstract,
    sections: formattedSections
  }
}
