// File Path: src/services/StorageService.js
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisify fs functions for cleaner async/await usage
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);
const accessAsync = fs.promises ? fs.promises.access : promisify(fs.access); // Prefer fs.promises
const readdirAsync = fs.promises ? fs.promises.readdir : promisify(fs.readdir); // Prefer fs.promises

// Get temp directory - critically important to use /tmp in Vercel serverless environment
const TEMP_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp'
  : (process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));

// Safe console logging that won't break in production
const safeLog = (prefix, message) => {
  try {
    console.log(`[StorageService] ${prefix}: ${typeof message === 'object' ? JSON.stringify(message).substring(0, 200) + '...' : message}`);
  } catch (error) {
    console.log(`[StorageService] Error logging ${prefix}`);
  }
};

/**
 * Initialize storage - ensure temp directory exists
 * @returns {Promise<void>}
 */
export const initStorage = async () => {
  try {
     // Check existence using fs.promises.access
     try {
         await accessAsync(TEMP_DIR, fs.constants.F_OK);
         safeLog('initStorage', `Temp directory already exists: ${TEMP_DIR}`);
     } catch (err) {
          // If error code is ENOENT (Not Found), create the directory
          if (err.code === 'ENOENT') {
              safeLog('initStorage', `Temp directory not found, creating: ${TEMP_DIR}`);
              await mkdirAsync(TEMP_DIR, { recursive: true });
              safeLog('initStorage', `Temp directory created successfully.`);
          } else {
              // Rethrow other errors (e.g., permission issues)
              throw err;
          }
     }
  } catch (error) {
    console.error('[StorageService] Error initializing storage:', error);
    // Don't throw - allow the process to continue even if directory creation fails
    safeLog('initStorage', 'Continuing without storage directory');
  }
};

/**
 * Save a file to temporary storage
 * @param {Buffer|string} data - File data
 * @param {string} filename - Original filename
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string>} - Path to saved file
 */
export const saveFile = async (data, filename, submissionId) => {
  try {
    await initStorage(); // Ensure directory exists

    // Generate a safe filename to prevent path traversal and conflicts
    const safeFilename = `${submissionId}-${Date.now()}-${path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(TEMP_DIR, safeFilename);
    safeLog('saveFile', `Saving file to path: ${filePath}`);

    // Write file
    await writeFileAsync(filePath, data);
    safeLog('saveFile', `File saved successfully.`);

    return filePath;
  } catch (error) {
    console.error('[StorageService] Error saving file:', error);
    // Return null instead of throwing - let caller decide how to handle
    return null;
  }
};

/**
 * Save analysis results to a file
 * @param {Object} results - Analysis results
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string>} - Path to saved file
 */
export const saveResults = async (results, submissionId) => {
  try {
    await initStorage(); // Ensure directory exists

    const filename = `results-${submissionId}.json`;
    const filePath = path.join(TEMP_DIR, filename);
    safeLog('saveResults', `Saving results JSON to path: ${filePath}`);

    // Write results as JSON string
    await writeFileAsync(filePath, JSON.stringify(results, null, 2)); // Pretty print JSON
    safeLog('saveResults', `Results JSON saved successfully.`);

    return filePath;
  } catch (error) {
    console.error('[StorageService] Error saving results JSON:', error);
    // Return null instead of throwing - let caller decide how to handle
    return null;
  }
};

/**
 * Generate a summary report in Markdown format
 * @param {Object} results - Analysis results
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string>} - Path to saved report file
 */
export const generateSummaryReport = async (results, submissionId) => {
  try {
    await initStorage(); // Ensure directory exists

    const filename = `report-${submissionId}.md`;
    const filePath = path.join(TEMP_DIR, filename);
    safeLog('generateSummaryReport', `Generating summary report at path: ${filePath}`);

    // Basic check for results structure
    if (!results || typeof results !== 'object') {
        console.error('[StorageService] Cannot generate report: Invalid results object provided.');
        return null;
    }

    // --- Report Generation Logic ---
    let report = `# Scientific Paper Structure Assessment\n\n`;

    // Add title (handle potential missing title)
    report += `## Paper: ${results.title || 'Title Not Found'}\n\n`;

    // Add overall assessment (check if documentAssessment exists)
    report += `## Overall Assessment\n\n`;
    if (results.documentAssessment && typeof results.documentAssessment === 'object') {
        for (const [key, assessment] of Object.entries(results.documentAssessment)) {
             if (assessment && typeof assessment === 'object') { // Check if assessment object is valid
                 const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
                 report += `- **${formattedKey}**: ${assessment.score ?? 'N/A'}/10 - ${assessment.assessment || 'No assessment'}\n`;
                 if (assessment.recommendation) {
                     report += `  - *Recommendation*: ${assessment.recommendation}\n`;
                 }
             } else {
                  report += `- **${key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())}**: Assessment data missing\n`;
             }
        }
    } else {
         report += "Overall assessment data is missing.\n";
    }

    // Add issue summary (check if statistics exist)
    report += `\n## Issue Summary\n\n`;
     const stats = results.statistics || {};
     report += `- Critical Issues: ${stats.critical ?? 0}\n`;
     report += `- Major Issues: ${stats.major ?? 0}\n`;
     report += `- Minor Issues: ${stats.minor ?? 0}\n`;

    // Add top recommendations (check if overallRecommendations exists and is an array)
    report += `\n## Top Recommendations\n\n`;
     if (Array.isArray(results.overallRecommendations)) {
         results.overallRecommendations.forEach((rec, index) => {
             report += `${index + 1}. ${rec || 'N/A'}\n`;
         });
          if (results.overallRecommendations.length === 0) {
              report += "No specific overall recommendations provided.\n";
          }
     } else {
         report += "Overall recommendations data is missing or invalid.\n";
     }

    // Add prioritized issues (check if prioritizedIssues exists and is an array)
     report += `\n## Prioritized Issues List\n\n`;
     if (Array.isArray(results.prioritizedIssues) && results.prioritizedIssues.length > 0) {
          results.prioritizedIssues.forEach((issue, index) => {
              if (issue && typeof issue === 'object') { // Check if issue object is valid
                  report += `### ${index + 1}. ${issue.issue || 'Issue description missing'}\n`;
                  report += `- **Severity**: ${issue.severity || 'N/A'}\n`;
                  report += `- **Location**: ${issue.location || 'N/A'}\n`;
                  report += `- **Recommendation**: ${issue.recommendation || 'N/A'}\n\n`;
              }
          });
     } else {
         report += "No prioritized issues listed.\n";
     }

    // Add abstract analysis (check existence and structure)
    if (results.abstract && typeof results.abstract === 'object') {
      report += `\n## Abstract Analysis\n\n`;
      report += `> ${results.abstract.text || 'Abstract text missing.'}\n\n`; // Use blockquote for text
      report += `**Summary**: ${results.abstract.summary || 'No summary provided.'}\n\n`;

      if (Array.isArray(results.abstract.issues) && results.abstract.issues.length > 0) {
        report += `**Issues Found**:\n\n`;
        results.abstract.issues.forEach((issue, index) => {
           if (issue && typeof issue === 'object') {
             report += `${index + 1}. **${(issue.severity || 'N/A').toUpperCase()}**: ${issue.issue || 'Issue description missing.'}\n`;
             report += `   - *Recommendation*: ${issue.recommendation || 'N/A'}\n\n`;
           }
        });
      } else {
         report += "**Issues Found**: None\n\n";
      }
    } else {
        report += "\n## Abstract Analysis\n\nAbstract data missing or invalid.\n";
    }

    // Add section analysis summaries (check existence and structure)
    report += `\n## Section Analysis\n\n`;
     if (Array.isArray(results.sections) && results.sections.length > 0) {
         results.sections.forEach((section, sIndex) => {
             if (section && typeof section === 'object') { // Check section validity
                 report += `### ${section.name || `Unnamed Section ${sIndex + 1}`}\n\n`;
                 if (Array.isArray(section.paragraphs) && section.paragraphs.length > 0) {
                      section.paragraphs.forEach((paragraph, pIndex) => {
                          if (paragraph && typeof paragraph === 'object') { // Check paragraph validity
                              report += `#### Paragraph ${pIndex + 1}\n\n`;
                              
                              // Include full paragraph text instead of just a preview
                              report += `${paragraph.text || 'Paragraph text missing'}\n\n`;
                              
                              report += `**Summary**: ${paragraph.summary || 'No summary.'}\n\n`;

                              // Structure assessment (check evaluations object)
                              report += `**Structure Assessment**:\n`;
                              // Use the actual boolean values from paragraph.evaluations
                              const evaluations = paragraph.evaluations || {};
                              report += `- Context-Content-Conclusion: ${evaluations.cccStructure ? '✓ Yes' : '✗ No'}\n`;
                              report += `- Sentence Quality: ${evaluations.sentenceQuality ? '✓ Good' : '✗ Needs Work'}\n`;
                              report += `- Topic Continuity: ${evaluations.topicContinuity ? '✓ Good' : '✗ Fragmented'}\n`;
                              report += `- Terminology Consistency: ${evaluations.terminologyConsistency ? '✓ Yes' : '✗ No'}\n`;
                              report += `- Structural Parallelism: ${evaluations.structuralParallelism ? '✓ Yes' : '✗ No'}\n\n`;

                              // Issues
                              if (Array.isArray(paragraph.issues) && paragraph.issues.length > 0) {
                                  report += `**Issues Found**:\n\n`;
                                  paragraph.issues.forEach((issue, iIndex) => {
                                       if (issue && typeof issue === 'object') {
                                           report += `${iIndex + 1}. **${(issue.severity || 'N/A').toUpperCase()}**: ${issue.issue || 'Issue description missing.'}\n`;
                                           report += `   - *Recommendation*: ${issue.recommendation || 'N/A'}\n\n`;
                                       }
                                  });
                              } else {
                                   report += "**Issues Found**: None\n\n";
                              }
                          } else {
                               report += `#### Paragraph ${pIndex + 1}\n\nInvalid paragraph data.\n\n`;
                          }
                      });
                 } else {
                      report += "No paragraphs found or paragraph data is invalid for this section.\n\n";
                 }
             } else {
                  report += `### Unnamed Section ${sIndex + 1}\n\nInvalid section data.\n\n`;
             }
         });
     } else {
         report += "No sections found or section data is invalid.\n";
     }

    // Write report to file
    await writeFileAsync(filePath, report);
    safeLog('generateSummaryReport', `Summary report generated successfully.`);

    return filePath;
  } catch (error) {
    console.error('[StorageService] Error generating summary report:', error);
    // Return null instead of throwing - let caller decide how to handle
    return null;
  }
};


/**
 * Read a file from storage
 * @param {string} filePath - Path to file
 * @returns {Promise<Buffer>} - File contents
 */
export const readFile = async (filePath) => {
  try {
     safeLog('readFile', `Reading file from path: ${filePath}`);
    // Basic check to ensure path seems plausible before reading
     if (!filePath || typeof filePath !== 'string') {
         throw new Error('Invalid file path provided for reading.');
     }
    const data = await readFileAsync(filePath);
     safeLog('readFile', `File read successfully. Size: ${data.length}`);
    return data;
  } catch (error) {
    console.error('[StorageService] Error reading file:', filePath, error);
    // Throw a new error to avoid exposing raw fs errors potentially
    throw new Error(`Failed to read file at path: ${path.basename(filePath)}`);
  }
};

/**
 * Delete a file from storage
 * @param {string} filePath - Path to file
 * @returns {Promise<void>}
 */
export const deleteFile = async (filePath) => {
  try {
     safeLog('deleteFile', `Attempting to delete file: ${filePath}`);
     // Use fs.promises.access to check existence first
      try {
          await accessAsync(filePath, fs.constants.F_OK);
          // File exists, proceed with deletion
          await unlinkAsync(filePath);
          safeLog('deleteFile', `Successfully deleted file: ${filePath}`);
      } catch (err) {
           // If file doesn't exist (ENOENT), log it but don't throw an error
           if (err.code === 'ENOENT') {
               safeLog('deleteFile', `File not found, skipping deletion: ${filePath}`);
           } else {
               // For other errors (like permissions), re-throw
               throw err;
           }
      }
  } catch (error) {
    // Log deletion errors but don't throw to prevent breaking cleanup process
    console.error(`[StorageService] Error deleting file: ${filePath}`, error);
  }
};

/**
 * Clean up files associated with a submission ID after a TTL.
 * @param {string} submissionId - ID of submission to clean up
 * @returns {void} - Schedules cleanup, doesn't return Promise
 */
export const scheduleCleanup = (submissionId) => {
    const CLEANUP_DELAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    safeLog('scheduleCleanup', `Scheduling cleanup for submission ID: ${submissionId} in ${CLEANUP_DELAY / 1000 / 3600} hours.`);

  // Schedule deletion
  setTimeout(async () => {
    safeLog('scheduleCleanup', `Starting cleanup for submission ID: ${submissionId}`);
    try {
       await initStorage(); // Ensure temp dir exists before reading it
      const files = await readdirAsync(TEMP_DIR);

      // Find all files matching this submission ID prefix
      const matchingFiles = files.filter(file => file.startsWith(submissionId));
       safeLog('scheduleCleanup', `Found ${matchingFiles.length} files matching ${submissionId} for cleanup.`);

      // Delete each matching file
      const deletePromises = matchingFiles.map(file =>
          deleteFile(path.join(TEMP_DIR, file))
      );

      await Promise.all(deletePromises); // Wait for all deletions

      safeLog('scheduleCleanup', `Completed cleanup for submission ${submissionId}`);
    } catch (error) {
      // Log errors during the cleanup process itself
      console.error(`[StorageService] Error during scheduled cleanup for ${submissionId}:`, error);
    }
  }, CLEANUP_DELAY);
};
