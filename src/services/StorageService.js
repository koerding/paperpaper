import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

// Promisify fs functions
const writeFileAsync = promisify(fs.writeFile)
const readFileAsync = promisify(fs.readFile)
const mkdirAsync = promisify(fs.mkdir)
const unlinkAsync = promisify(fs.unlink)
const existsAsync = promisify(fs.exists)

// Get temp directory from environment or use default
const TEMP_DIR = process.env.TEMP_FILE_PATH || './tmp'

/**
 * Initialize storage - ensure temp directory exists
 * @returns {Promise<void>}
 */
export const initStorage = async () => {
  try {
    if (!(await existsAsync(TEMP_DIR))) {
      await mkdirAsync(TEMP_DIR, { recursive: true })
    }
  } catch (error) {
    console.error('Error initializing storage:', error)
    throw new Error('Failed to initialize storage')
  }
}

/**
 * Save a file to temporary storage
 * @param {Buffer|string} data - File data
 * @param {string} filename - Original filename
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string>} - Path to saved file
 */
export const saveFile = async (data, filename, submissionId) => {
  try {
    await initStorage()
    
    // Generate a safe filename
    const safeFilename = `${submissionId}-${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = path.join(TEMP_DIR, safeFilename)
    
    // Write file
    await writeFileAsync(filePath, data)
    
    return filePath
  } catch (error) {
    console.error('Error saving file:', error)
    throw new Error('Failed to save file')
  }
}

/**
 * Save analysis results to a file
 * @param {Object} results - Analysis results
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string>} - Path to saved file
 */
export const saveResults = async (results, submissionId) => {
  try {
    await initStorage()
    
    const filename = `results-${submissionId}.json`
    const filePath = path.join(TEMP_DIR, filename)
    
    // Write results as JSON
    await writeFileAsync(filePath, JSON.stringify(results, null, 2))
    
    return filePath
  } catch (error) {
    console.error('Error saving results:', error)
    throw new Error('Failed to save results')
  }
}

/**
 * Generate a summary report in Markdown format
 * @param {Object} results - Analysis results
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string>} - Path to saved report file
 */
export const generateSummaryReport = async (results, submissionId) => {
  try {
    await initStorage()
    
    const filename = `report-${submissionId}.md`
    const filePath = path.join(TEMP_DIR, filename)
    
    // Format report header
    let report = `# Scientific Paper Structure Assessment\n\n`
    
    // Add title
    report += `## Paper: ${results.title}\n\n`
    
    // Add overall assessment
    report += `## Overall Assessment\n\n`
    
    for (const [key, assessment] of Object.entries(results.documentAssessment)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())
      report += `- **${formattedKey}**: ${assessment.score}/10 - ${assessment.assessment}\n`
      if (assessment.recommendation) {
        report += `  - *Recommendation*: ${assessment.recommendation}\n`
      }
    }
    
    // Add issue summary
    report += `\n## Issue Summary\n\n`
    report += `- Critical Issues: ${results.statistics.critical || 0}\n`
    report += `- Major Issues: ${results.statistics.major || 0}\n`
    report += `- Minor Issues: ${results.statistics.minor || 0}\n`
    
    // Add top recommendations
    report += `\n## Top Recommendations\n\n`
    results.overallRecommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`
    })
    
    // Add major issues section
    report += `\n## Critical Issues to Address\n\n`
    results.prioritizedIssues
      .filter(issue => issue.severity === 'critical')
      .forEach((issue, index) => {
        report += `### Issue ${index + 1}: ${issue.issue}\n`
        report += `- **Location**: ${issue.location}\n`
        report += `- **Recommendation**: ${issue.recommendation}\n\n`
      })
    
    // Add abstract analysis
    if (results.abstract) {
      report += `\n## Abstract Analysis\n\n`
      report += `"${results.abstract.text}"\n\n`
      report += `**Summary**: ${results.abstract.summary}\n\n`
      
      if (results.abstract.issues && results.abstract.issues.length > 0) {
        report += `**Issues**:\n\n`
        results.abstract.issues.forEach((issue, index) => {
          report += `${index + 1}. **${issue.severity.toUpperCase()}**: ${issue.issue}\n`
          report += `   - *Recommendation*: ${issue.recommendation}\n\n`
        })
      }
    }
    
    // Add section analysis summaries
    report += `\n## Section Analysis\n\n`
    results.sections.forEach((section, sIndex) => {
      report += `### ${section.name}\n\n`
      
      section.paragraphs.forEach((paragraph, pIndex) => {
        report += `#### Paragraph ${pIndex + 1}\n\n`
        report += `"${paragraph.text}..."\n\n`
        report += `**Summary**: ${paragraph.summary}\n\n`
        
        // Structure assessment
        report += `**Structure Assessment**:\n`
        report += `- Context-Content-Conclusion: ${paragraph.cccStructure ? '✓' : '✗'}\n`
        report += `- Sentence Quality: ${paragraph.sentenceQuality ? '✓' : '✗'}\n`
        report += `- Topic Continuity: ${paragraph.topicContinuity ? '✓' : '✗'}\n`
        report += `- Terminology Consistency: ${paragraph.terminologyConsistency ? '✓' : '✗'}\n`
        report += `- Structural Parallelism: ${paragraph.structuralParallelism ? '✓' : '✗'}\n\n`
        
        // Issues
        if (paragraph.issues && paragraph.issues.length > 0) {
          report += `**Issues**:\n\n`
          paragraph.issues.forEach((issue, iIndex) => {
            report += `${iIndex + 1}. **${issue.severity.toUpperCase()}**: ${issue.issue}\n`
            report += `   - *Recommendation*: ${issue.recommendation}\n\n`
          })
        }
      })
    })
    
    // Write report to file
    await writeFileAsync(filePath, report)
    
    return filePath
  } catch (error) {
    console.error('Error generating report:', error)
    throw new Error('Failed to generate summary report')
  }
}

/**
 * Read a file from storage
 * @param {string} filePath - Path to file
 * @returns {Promise<Buffer>} - File contents
 */
export const readFile = async (filePath) => {
  try {
    return await readFileAsync(filePath)
  } catch (error) {
    console.error('Error reading file:', error)
    throw new Error('Failed to read file')
  }
}

/**
 * Delete a file from storage
 * @param {string} filePath - Path to file
 * @returns {Promise<void>}
 */
export const deleteFile = async (filePath) => {
  try {
    if (await existsAsync(filePath)) {
      await unlinkAsync(filePath)
    }
  } catch (error) {
    console.error('Error deleting file:', error)
    // Don't throw - deleting is not critical
  }
}

/**
 * Clean up files after a certain time
 * @param {string} submissionId - ID of submission to clean up
 * @returns {Promise<void>}
 */
export const scheduleCleanup = (submissionId) => {
  // Schedule deletion after 24 hours
  setTimeout(async () => {
    try {
      const files = fs.readdirSync(TEMP_DIR)
      
      // Find all files matching this submission ID
      const matchingFiles = files.filter(file => file.includes(submissionId))
      
      // Delete each matching file
      for (const file of matchingFiles) {
        await deleteFile(path.join(TEMP_DIR, file))
      }
      
      console.log(`Cleaned up files for submission ${submissionId}`)
    } catch (error) {
      console.error(`Error cleaning up files for ${submissionId}:`, error)
    }
  }, 24 * 60 * 60 * 1000) // 24 hours
}
