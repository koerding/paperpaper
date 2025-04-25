import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: false, // Only use server-side
})

/**
 * Analyze document structure using OpenAI GPT
 * @param {Object} document - Structured document object
 * @returns {Promise<Object>} - Analysis results
 */
export const analyzeDocumentStructure = async (document) => {
  try {
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

/**
 * Generate prompt for paragraph analysis
 * @param {Object} document - Structured document
 * @returns {string} - Formatted prompt
 */
const generateParagraphAnalysisPrompt = (document) => {
  // Format sections and paragraphs as text
  const sectionsText = document.sections.map(section => {
    const paragraphsText = section.paragraphs.map((paragraph, index) => 
      `Paragraph ${index + 1}: ${paragraph}`
    ).join('\n\n')
    
    return `Section: ${section.name}\n${paragraphsText}`
  }).join('\n\n')
  
  return `
    Analyze this scientific paper parsed into sections and paragraphs. For each paragraph:
    
    1. Evaluate if it follows Context-Content-Conclusion structure (first sentence provides context, middle sentences provide content, last sentence provides conclusion)
    2. Check if sentences are appropriate length (under 25 words on average)
    3. Assess topic continuity within the paragraph (single focused topic)
    4. Evaluate terminology consistency (same terms used for same concepts)
    5. Check for structural parallelism where appropriate
    6. Provide a 1-2 sentence summary capturing the main point
    
    For each issue found, provide a specific recommendation for improvement.
    
    Return your analysis as a valid JSON object with this structure:
    {
      "title": "extracted paper title",
      "abstract": {
        "text": "abstract text",
        "summary": "abstract summary",
        "issues": [
          {
            "issue": "description of issue",
            "severity": "critical|major|minor",
            "recommendation": "specific suggestion for improvement"
          }
        ]
      },
      "sections": [
        {
          "name": "section name",
          "paragraphs": [
            {
              "text": "first few words of paragraph for identification...",
              "summary": "1-2 sentence summary of paragraph content",
              "cccStructure": boolean,
              "sentenceQuality": boolean,
              "topicContinuity": boolean,
              "terminologyConsistency": boolean,
              "structuralParallelism": boolean,
              "issues": [
                {
                  "issue": "description of specific issue",
                  "severity": "critical|major|minor",
                  "recommendation": "specific suggestion"
                }
              ]
            }
          ]
        }
      ]
    }
    
    Paper structure:
    
    Title: ${document.title}
    
    Abstract: ${document.abstract}
    
    ${sectionsText}
  `
}

/**
 * Extract summaries from paragraph analysis
 * @param {Object} paragraphAnalysis - Analysis of paragraphs
 * @returns {Array} - Paragraph summaries organized by section
 */
const extractParagraphSummaries = (paragraphAnalysis) => {
  return paragraphAnalysis.sections.map(section => {
    const paragraphSummaries = section.paragraphs.map(paragraph => ({
      text: paragraph.text,
      summary: paragraph.summary,
      hasIssues: paragraph.issues.length > 0
    }))
    
    return {
      sectionName: section.name,
      paragraphs: paragraphSummaries
    }
  })
}

/**
 * Generate prompt for document-level analysis
 * @param {string} title - Document title
 * @param {string} abstract - Document abstract
 * @param {Array} paragraphSummaries - Summaries from paragraph analysis
 * @returns {string} - Formatted prompt
 */
const generateDocumentAnalysisPrompt = (title, abstract, paragraphSummaries) => {
  // Format section summaries
  const sectionSummariesText = paragraphSummaries.map(section => {
    const paragraphsText = section.paragraphs.map((paragraph, index) => 
      `Paragraph ${index + 1}: ${paragraph.summary}`
    ).join('\n')
    
    return `Section: ${section.sectionName}\n${paragraphsText}`
  }).join('\n\n')
  
  return `
    Based on the title, abstract, and section summaries of this scientific paper, analyze the overall document structure according to these criteria:
    
    1. Title assessment: Does the title clearly communicate the central contribution?
    2. Abstract completeness: Does the abstract tell a complete story (context, gap, approach, results, significance)?
    3. Introduction effectiveness: Does the introduction progress from broad field to specific gap and preview the solution?
    4. Results organization: Are results presented in logical sequence supporting the main claim?
    5. Discussion quality: Does the discussion connect results back to the gap and explain broader significance?
    6. Single message focus: Is there a consistent focus on a single main contribution?
    7. Topic organization: Are topics discussed in a consolidated way (avoiding zig-zag)?
    
    Return your analysis as a valid JSON object with this structure:
    {
      "documentAssessment": {
        "titleQuality": {
          "score": 1-10 rating,
          "assessment": "evaluation of how well title communicates contribution",
          "recommendation": "specific suggestion if improvement needed"
        },
        "abstractCompleteness": {
          "score": 1-10 rating,
          "assessment": "evaluation of abstract's storytelling",
          "recommendation": "specific suggestion if improvement needed"
        },
        "introductionStructure": {
          "score": 1-10 rating,
          "assessment": "evaluation of introduction's progression",
          "recommendation": "specific suggestion if improvement needed"
        },
        "resultsCoherence": {
          "score": 1-10 rating,
          "assessment": "evaluation of results presentation",
          "recommendation": "specific suggestion if improvement needed"
        },
        "discussionEffectiveness": {
          "score": 1-10 rating,
          "assessment": "evaluation of discussion quality",
          "recommendation": "specific suggestion if improvement needed"
        },
        "messageFocus": {
          "score": 1-10 rating,
          "assessment": "evaluation of single vs. multiple focus",
          "recommendation": "specific suggestion if improvement needed"
        },
        "topicOrganization": {
          "score": 1-10 rating,
          "assessment": "evaluation of topic consolidation",
          "recommendation": "specific suggestion if improvement needed"
        }
      },
      "majorIssues": [
        {
          "issue": "description of significant structural problem",
          "location": "section or area where issue appears",
          "severity": "critical|major",
          "recommendation": "specific suggestion for improvement"
        }
      ],
      "overallRecommendations": [
        "prioritized suggestion 1",
        "prioritized suggestion 2",
        "prioritized suggestion 3"
      ]
    }
    
    Title: ${title}
    
    Abstract: ${abstract}
    
    Section Summaries:
    ${sectionSummariesText}
  `
}

/**
 * Analyze paragraphs
 * @param {Object} document - Structured document
 * @returns {Promise<Object>} - Paragraph analysis
 */
const analyzeParagraphs = async (document) => {
  try {
    const prompt = generateParagraphAnalysisPrompt(document)
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a scientific writing expert who analyzes paper structure and provides specific, actionable recommendations for improvement.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
    
    // Parse and return the analysis
    return JSON.parse(response.choices[0].message.content)
  } catch (error) {
    console.error('Error in paragraph analysis:', error)
    throw new Error('Failed to analyze paragraphs: ' + error.message)
  }
}

/**
 * Analyze document at a high level
 * @param {string} title - Document title
 * @param {string} abstract - Document abstract
 * @param {Array} paragraphSummaries - Summaries from paragraph analysis
 * @returns {Promise<Object>} - Document-level analysis
 */
const analyzeDocumentLevel = async (title, abstract, paragraphSummaries) => {
  try {
    const prompt = generateDocumentAnalysisPrompt(title, abstract, paragraphSummaries)
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a scientific writing expert who analyzes paper structure and provides specific, actionable recommendations for improvement.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
    
    // Parse and return the analysis
    return JSON.parse(response.choices[0].message.content)
  } catch (error) {
    console.error('Error in document-level analysis:', error)
    throw new Error('Failed to analyze document structure: ' + error.message)
  }
}

/**
 * Merge paragraph and document analyses
 * @param {Object} paragraphAnalysis - Paragraph-level analysis
 * @param {Object} documentAnalysis - Document-level analysis
 * @returns {Object} - Merged analysis with prioritized feedback
 */
const mergeAnalyses = (paragraphAnalysis, documentAnalysis) => {
  // Count issues by severity
  const severityCounts = { critical: 0, major: 0, minor: 0 }
  
  // Track all issues
  const allIssues = []
  
  // Process abstract issues
  if (paragraphAnalysis.abstract && paragraphAnalysis.abstract.issues) {
    paragraphAnalysis.abstract.issues.forEach(issue => {
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1
      allIssues.push({
        location: 'Abstract',
        ...issue
      })
    })
  }
  
  // Process paragraph issues
  paragraphAnalysis.sections.forEach(section => {
    section.paragraphs.forEach((paragraph, index) => {
      paragraph.issues.forEach(issue => {
        severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1
        allIssues.push({
          location: `Section '${section.name}', paragraph starting with '${paragraph.text}'`,
          ...issue
        })
      })
    })
  })
  
  // Process major document issues
  documentAnalysis.majorIssues.forEach(issue => {
    severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1
    allIssues.push(issue)
  })
  
  // Prioritize issues by severity
  const prioritizedIssues = [
    ...allIssues.filter(issue => issue.severity === 'critical'),
    ...allIssues.filter(issue => issue.severity === 'major'),
    ...allIssues.filter(issue => issue.severity === 'minor')
  ].slice(0, 20) // Limit to top 20 issues
  
  // Merge and return
  return {
    title: paragraphAnalysis.title,
    abstract: paragraphAnalysis.abstract,
    sections: paragraphAnalysis.sections,
    documentAssessment: documentAnalysis.documentAssessment,
    majorIssues: documentAnalysis.majorIssues,
    overallRecommendations: documentAnalysis.overallRecommendations,
    statistics: severityCounts,
    prioritizedIssues
  }
}
