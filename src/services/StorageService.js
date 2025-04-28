// File Path: src/services/StorageService.js
// Complete file with full generateSummaryReport logic

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisify fs functions
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);
const accessAsync = fs.promises ? fs.promises.access : promisify(fs.access);
const readdirAsync = fs.promises ? fs.promises.readdir : promisify(fs.readdir);

// Get temp directory
const TEMP_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp'
  : (process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));

// Safe console logging
const safeLog = (prefix, message) => {
  try {
    // Ensure message is serializable before logging potentially large objects
    let loggableMessage = message;
    if (typeof message === 'object' && message !== null) {
        loggableMessage = JSON.stringify(message).substring(0, 300) + '...';
    } else if (typeof message === 'string') {
        loggableMessage = message.substring(0, 300) + (message.length > 300 ? '...' : '');
    }
    console.log(`[StorageService] ${prefix}: ${loggableMessage}`);
  } catch (error) {
    console.log(`[StorageService] Error logging ${prefix}: ${error.message}`);
  }
};


// initStorage function
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
              try {
                  await mkdirAsync(TEMP_DIR, { recursive: true });
                  safeLog('initStorage', `Temp directory created successfully.`);
              } catch (mkdirErr) {
                   console.error(`[StorageService] Error creating temp directory ${TEMP_DIR}:`, mkdirErr);
                   // Allow process to potentially continue, but log critical error
              }
          } else {
              // Rethrow other errors (e.g., permission issues)
              console.error('[StorageService] Error checking temp directory existence:', err);
              // Potentially throw err;
          }
     }
  } catch (error) {
    console.error('[StorageService] Error initializing storage:', error);
    // Don't throw - allow the process to continue if possible
    safeLog('initStorage', 'Continuing after storage initialization error');
  }
};

// saveFile function
export const saveFile = async (data, filename, submissionId) => {
  try {
    await initStorage(); // Ensure directory exists or attempt creation

    // Generate a safe filename
    const safeFilename = `${submissionId}-${Date.now()}-${path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(TEMP_DIR, safeFilename);
    safeLog('saveFile', `Saving file to path: ${filePath}`);

    // Write file
    await writeFileAsync(filePath, data);
    safeLog('saveFile', `File saved successfully.`);

    return filePath; // Return the actual path where it was saved
  } catch (error) {
    console.error('[StorageService] Error saving file:', error);
    return null; // Return null on failure
  }
};

// saveResults function
export const saveResults = async (results, submissionId) => {
  try {
    await initStorage(); // Ensure directory exists

    const filename = `results-${submissionId}.json`;
    const filePath = path.join(TEMP_DIR, filename);
    safeLog('saveResults', `Saving results JSON to path: ${filePath}`);

    // Write results as JSON string
    await writeFileAsync(filePath, JSON.stringify(results, null, 2)); // Pretty print JSON
    safeLog('saveResults', `Results JSON saved successfully.`);

    return filePath; // Return the actual path
  } catch (error) {
    console.error('[StorageService] Error saving results JSON:', error);
    return null;
  }
};


/**
 * Generate a summary report in Markdown format
 * @param {Object} results - Analysis results from AI Service
 * @param {string} submissionId - Unique submission ID
 * @returns {Promise<string|null>} - Path to saved report file or null on error
 */
export const generateSummaryReport = async (results, submissionId) => {
  try {
    await initStorage(); // Ensure directory exists

    const filename = `report-${submissionId}.md`;
    const filePath = path.join(TEMP_DIR, filename);
    safeLog('generateSummaryReport', `Generating summary report at path: ${filePath}`);

    // --- Basic Checks ---
    if (!results || typeof results !== 'object') {
        console.error('[StorageService] Cannot generate report: Invalid results object provided.');
        return null;
    }
     if (results.analysisError) {
         console.warn('[StorageService] Generating error report due to AI analysis failure.');
          let errorReport = `# Scientific Paper Structure Assessment\n\n## Analysis Error\n\n`;
          errorReport += `The analysis could not be completed successfully.\n`;
          errorReport += `Error reported: ${results.analysisError}\n`;
          await writeFileAsync(filePath, errorReport);
          return filePath; // Return path to the error report
     }

    // --- Report Generation Logic ---
    let report = `# Scientific Paper Structure Assessment\n\n`;
    report += `## Paper: ${results.title || 'Title Not Provided'}\n\n`;

    // --- Overall Assessment ---
    report += `## Overall Assessment\n\n`;
    if (results.documentAssessment && typeof results.documentAssessment === 'object') {
        const assessmentOrder = ['titleQuality', 'abstractCompleteness', 'introductionStructure', 'resultsOrganization', 'discussionQuality', 'messageFocus', 'topicOrganization'];
        assessmentOrder.forEach(key => {
            const assessment = results.documentAssessment[key];
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
            if (assessment && typeof assessment === 'object') {
                 // Use nullish coalescing for safer access to potentially missing scores/text
                 report += `- **${formattedKey}**: ${assessment.score ?? 'N/A'}/10 - ${assessment.assessment || 'No assessment text.'}\n`;
                 if (assessment.recommendation) {
                     report += `  - *Recommendation*: ${assessment.recommendation}\n`;
                 }
            } else {
                 report += `- **${formattedKey}**: Assessment data missing\n`; // Indicate if specific key is missing
            }
        });
    } else {
         report += "Overall assessment data is missing or invalid.\n";
    }

    // --- Issue Summary ---
    report += `\n## Issue Summary\n\n`;
     const stats = results.statistics || {};
     report += `- Critical Issues: ${stats.critical ?? 0}\n`;
     report += `- Major Issues: ${stats.major ?? 0}\n`;
     report += `- Minor Issues: ${stats.minor ?? 0}\n`;

    // --- Top Recommendations ---
    report += `\n## Top Recommendations\n\n`;
     if (Array.isArray(results.overallRecommendations) && results.overallRecommendations.length > 0) {
         results.overallRecommendations.forEach((rec, index) => {
             report += `${index + 1}. ${rec || 'N/A'}\n`; // Handle potentially null/empty recommendations
         });
     } else {
         report += "No specific overall recommendations provided.\n";
     }

     // --- Major Issues List ---
     report += `\n## Major Issues List\n\n`;
     if (Array.isArray(results.majorIssues) && results.majorIssues.length > 0) {
          results.majorIssues.forEach((issue, index) => {
              if (issue && typeof issue === 'object') {
                  report += `### ${index + 1}. ${issue.issue || 'Issue description missing'}\n`;
                  report += `- **Severity**: ${issue.severity || 'N/A'}\n`;
                  report += `- **Location**: ${issue.location || 'N/A'}\n`;
                  report += `- **Recommendation**: ${issue.recommendation || 'N/A'}\n\n`;
              }
          });
     } else {
         report += "No major issues listed.\n";
     }

    // --- Abstract Analysis ---
    report += `\n## Abstract Analysis\n\n`;
    if (results.abstract && typeof results.abstract === 'object') {
      report += `> ${results.abstract.text || 'Abstract text not found.'}\n\n`; // Use blockquote for text
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
        report += "Abstract data missing or invalid.\n";
    }

    // --- Section Analysis ---
    report += `\n## Section Analysis\n\n`;
     if (Array.isArray(results.sections) && results.sections.length > 0) {
         results.sections.forEach((section, sIndex) => {
             // Check section validity
             if (section && typeof section === 'object' && section.name && Array.isArray(section.paragraphs)) {
                 report += `### ${section.name}\n\n`;
                 section.paragraphs.forEach((paragraph, pIndex) => {
                     // Check paragraph validity
                     if (paragraph && typeof paragraph === 'object') {
                         report += `#### Paragraph ${pIndex + 1}\n\n`;
                         report += `${paragraph.text || 'Paragraph text missing.'}\n\n`;
                         report += `**Summary**: ${paragraph.summary || 'No summary provided.'}\n\n`;

                         // --- Structure Assessment (Using Correct Keys) ---
                         report += `**Structure Assessment**:\n`;
                         const evals = paragraph.evaluations || {}; // Default to empty object for safety
                         // Check for the specific keys expected by UI/Rules
                         report += `- Context-Content-Conclusion: ${evals.cccStructure === true ? '✓ Yes' : '✗ No'}\n`;
                         report += `- Sentence Quality: ${evals.sentenceQuality === true ? '✓ Good' : '✗ Needs Work'}\n`;
                         report += `- Topic Continuity: ${evals.topicContinuity === true ? '✓ Good' : '✗ Fragmented'}\n`;
                         report += `- Terminology Consistency: ${evals.terminologyConsistency === true ? '✓ Consistent' : '✗ Inconsistent'}\n`;
                         report += `- Structural Parallelism: ${evals.structuralParallelism === true ? '✓ Good' : '✗ Needs Work'}\n\n`;
                         // --- End Structure Assessment ---

                         // Paragraph Issues
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
                  report += `### Section ${sIndex + 1}\n\nInvalid section data or missing paragraphs.\n\n`;
             }
         });
     } else {
         report += "No sections found or section data is invalid.\n";
     }

    // --- Write Report File ---
    await writeFileAsync(filePath, report);
    safeLog('generateSummaryReport', `Summary report generated successfully.`);

    return filePath; // Return the path

  } catch (error) {
    console.error('[StorageService] Error generating summary report:', error);
    return null; // Return null on error
  }
};


// readFile function
export const readFile = async (filePath) => {
  try {
     safeLog('readFile', `Reading file from path: ${filePath}`);
     if (!filePath || typeof filePath !== 'string') {
         throw new Error('Invalid file path provided for reading.');
     }
     // Basic check to prevent reading outside intended directory (redundant with download route check but safer)
     const intendedDir = path.resolve(TEMP_DIR);
     const resolvedPath = path.resolve(filePath);
     if (!resolvedPath.startsWith(intendedDir)) {
          console.error(`[StorageService] Attempt to read file outside TEMP_DIR: ${resolvedPath}`);
          throw new Error('Access denied to file path.');
     }

     const data = await readFileAsync(resolvedPath); // Use resolved path
     safeLog('readFile', `File read successfully. Size: ${data.length}`);
     return data;
  } catch (error) {
     console.error('[StorageService] Error reading file:', filePath, error);
     // Throw a more generic error to the caller
     throw new Error(`Failed to read file: ${path.basename(filePath)}`);
  }
};

// deleteFile function
export const deleteFile = async (filePath) => {
  // Add basic path check before attempting deletion
  if (!filePath || typeof filePath !== 'string') {
     console.warn(`[StorageService] Invalid filePath provided for deletion: ${filePath}`);
     return;
  }
  try {
     safeLog('deleteFile', `Attempting to delete file: ${filePath}`);
      try {
          // Check if path exists before unlinking
          await accessAsync(filePath, fs.constants.F_OK);
          await unlinkAsync(filePath);
          safeLog('deleteFile', `Successfully deleted file: ${filePath}`);
      } catch (err) {
           // If file doesn't exist (ENOENT), it's already gone or never existed, which is fine.
           if (err.code === 'ENOENT') {
               safeLog('deleteFile', `File not found (already deleted?), skipping: ${filePath}`);
           } else {
               // Log other errors (like permissions) but don't necessarily crash the cleanup
               console.error(`[StorageService] Error during file deletion attempt for ${filePath}:`, err);
           }
      }
  } catch (error) {
     // Catch unexpected errors in the outer try logic
     console.error(`[StorageService] Unexpected error in deleteFile for ${filePath}:`, error);
  }
};

// scheduleCleanup function
export const scheduleCleanup = (submissionId) => {
    // Validate submissionId format briefly
    if (!submissionId || typeof submissionId !== 'string' || !submissionId.startsWith('sub_')) {
        console.warn(`[StorageService] Invalid submissionId format for cleanup scheduling: ${submissionId}`);
        return;
    }

    const CLEANUP_DELAY = 24 * 60 * 60 * 1000; // 24 hours
    safeLog('scheduleCleanup', `Scheduling cleanup for submission ID: ${submissionId} in ${CLEANUP_DELAY / 1000 / 3600} hours.`);

  setTimeout(async () => {
    safeLog('scheduleCleanup', `Starting cleanup task for submission ID: ${submissionId}`);
    try {
       await initStorage(); // Ensure temp dir logic has run
       const files = await readdirAsync(TEMP_DIR);

       // Filter more carefully based on the ID prefix within the filename
       const matchingFiles = files.filter(file => {
          // Example filenames: results-sub_123.json, report-sub_123.md, sub_123-timestamp-original.docx
          return file.includes(`-${submissionId}.`) || file.startsWith(`${submissionId}-`);
        });

       safeLog('scheduleCleanup', `Found ${matchingFiles.length} files matching pattern for ${submissionId}.`);

       if (matchingFiles.length > 0) {
          const deletePromises = matchingFiles.map(file => {
              const fullPath = path.join(TEMP_DIR, file);
              return deleteFile(fullPath); // Call deleteFile for each found file
          });
          await Promise.all(deletePromises);
       }

       safeLog('scheduleCleanup', `Completed cleanup task for submission ${submissionId}`);
    } catch (error) {
      // Log errors during the cleanup process itself
      console.error(`[StorageService] Error during scheduled cleanup task for ${submissionId}:`, error);
    }
  }, CLEANUP_DELAY);
};
