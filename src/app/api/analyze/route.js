export const maxDuration = 300; // 5 minutes timeout


// File Path: src/app/api/analyze/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path'; // Ensure 'path' is imported
// Using absolute paths with @ alias
import {
  extractTextFromFile,
  validateDocumentSize
} from '@/services/ProcessingService.js'; // Assuming this handles both client/server extraction or you adjust imports as needed
import { analyzeDocumentStructure } from '@/services/AIService.js';
import {
  saveFile, // Keep if needed for server-side extraction path
  saveResults,
  generateSummaryReport,
  scheduleCleanup
} from '@/services/StorageService.js';
import { MAX_CHAR_COUNT } from '@/lib/constants.js';

// Safe console logging that won't break the API
const safeLog = (prefix, message) => {
  try {
    // Ensure message is serializable before logging potentially large objects
    let loggableMessage = message;
    if (typeof message === 'object' && message !== null) {
        loggableMessage = JSON.stringify(message).substring(0, 300) + '...';
    } else if (typeof message === 'string') {
        loggableMessage = message.substring(0, 300) + (message.length > 300 ? '...' : '');
    }
    console.log(`[API /analyze] ${prefix}: ${loggableMessage}`);
  } catch (error) {
    console.log(`[API /analyze] Error logging ${prefix}: ${error.message}`);
  }
};

/**
 * Analyze document structure
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response with analysis results
 */
export async function POST(request) {
  console.log('[API /analyze] Received POST request.');
  let submissionId = `sub_${Date.now()}`; // Define submissionId early for logging
  console.log(`[API /analyze] Generated Submission ID: ${submissionId}`);
  let analysisStartTime; // Define here for use in logging duration


  try {
    // Check payload size
    const contentLength = request.headers.get('content-length');
    safeLog('content-length', contentLength);
    if (contentLength && parseInt(contentLength, 10) > 15 * 1024 * 1024) { // 15MB limit
      console.error('[API /analyze] Error: Payload too large.');
      return NextResponse.json({ error: 'Payload too large. Limit is 15MB.' }, { status: 413 });
    }

    console.log('[API /analyze] Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      console.error('[API /analyze] Error: No valid file provided in form data.');
      return NextResponse.json({ error: 'No valid file provided' }, { status: 400 });
    }
    safeLog('file-received', { Name: file.name, Size: file.size, Type: file.type });

    let fileText;
    let tempFilePath = null; // To store path if saved temporarily

    // Try to use client-extracted text if available, otherwise extract on server
    if (formData.has('fileText')) {
      fileText = formData.get('fileText');
      safeLog('text-source', 'Client-extracted text found.');
    } else {
      safeLog('text-source', 'No client-extracted text. Processing file on server...');
      const buffer = Buffer.from(await file.arrayBuffer());
      // Optionally save the original file (e.g., if needed for complex extraction later)
      // Note: Saving adds I/O time. Only do if necessary.
      try {
         tempFilePath = await saveFile(buffer, file.name, submissionId); // Use the imported saveFile
         if (tempFilePath) {
           safeLog('temp-file-saved', tempFilePath);
         } else {
           safeLog('temp-file-save-skipped', 'Could not save temporary file, continuing in-memory.');
         }
      } catch (saveError) {
         console.error('[API /analyze] Error saving temporary file:', saveError);
         // Continue anyway, process file in memory
      }

      safeLog('server-extraction', 'Attempting server-side text extraction...');
      try {
        // Pass the original File object OR buffer if needed by extractTextFromFile
        fileText = await extractTextFromFile(file); // Ensure this function can handle the File object
        safeLog('server-extraction-result', { Length: fileText?.length || 0 });
      } catch (extractError) {
        console.error('[API /analyze] Error extracting text from file:', extractError);
        return NextResponse.json({ error: `Could not extract text from the file: ${extractError.message}` }, { status: 400 });
      }
    }

    // Validate document size
    safeLog('validating-size', 'Validating document character count...');
    if (!validateDocumentSize(fileText, MAX_CHAR_COUNT)) {
      console.error(`[API /analyze] Error: Document text too large (${fileText?.length || 0} chars).`);
      return NextResponse.json({ error: `Document is too large. Max ${MAX_CHAR_COUNT} chars.` }, { status: 400 });
    }
    safeLog('size-validation', 'Document size validated.');

    // Call AI service with the extracted text
    safeLog('ai-call-start', `Calling analyzeDocumentStructure in AIService for ID: ${submissionId}...`);
    analysisStartTime = Date.now(); // Start timer just before AI call

    // Note: Timeout logic was previously here using Promise.race.
    // The Vercel maxDuration handles the overall function timeout.
    // If specific AI timeout is needed, re-implement Promise.race.
    let analysisResults;
    try {
       analysisResults = await analyzeDocumentStructure(null, fileText); // Pass null for 'document' if unused
    } catch (aiError){
         console.error(`[API /analyze] Error during AIService call for ID ${submissionId}:`, aiError);
         // Check if it was likely a timeout or another specific error
         const errorMessage = aiError.message?.includes('timed out')
             ? 'Analysis took too long to complete via AI service.'
             : `AI analysis failed: ${aiError.message}`;
        return NextResponse.json({ error: errorMessage }, { status: 504 }); // Gateway Timeout or appropriate error
    }

    const analysisEndTime = Date.now();
    safeLog('ai-call-end', `AIService analyzeDocumentStructure completed for ID: ${submissionId}. Duration: ${analysisEndTime - analysisStartTime}ms`);

    // Check if AI service returned an error structure itself
    if (analysisResults && analysisResults.analysisError) {
       console.error('[API /analyze] AI Service returned an analysis error:', analysisResults.analysisError);
       // Return a 500 error but include the specific error message from the AI service if available
       return NextResponse.json({ error: analysisResults.analysisError }, { status: 500 });
    }

    // Basic validation of the results structure
    if (typeof analysisResults !== 'object' || analysisResults === null || !analysisResults.sections) {
       console.error('[API /analyze] Error: AI analysis did not return a valid structure.');
       return NextResponse.json({ error: 'AI analysis failed to produce valid results.' }, { status: 500 });
    }

    safeLog('ai-result-snippet', analysisResults);

    // --- Save results and generate report (Run in background - NO await) ---
    let resultsPath = null;
    let reportPath = null;

    const backgroundTasks = []; // Collect promises

     // Save JSON Results Task
     const saveJsonTask = saveResults(analysisResults, submissionId).then(path => {
       if (path) {
         safeLog('save-results-bg', `Analysis results saved to: ${path}`);
         resultsPath = path; // Store path if needed later (though link uses assumed path)
       } else {
         console.error('[API /analyze] Background task failed to save results JSON.');
       }
     }).catch(saveErr => {
       console.error('[API /analyze] Error saving analysis results JSON (background):', saveErr);
     });
     backgroundTasks.push(saveJsonTask);

     // Generate Report Task (depends on valid results)
     if (typeof analysisResults === 'object' && analysisResults !== null && !analysisResults.analysisError) {
       const generateReportTask = generateSummaryReport(analysisResults, submissionId).then(rPath => {
         if (rPath) {
           safeLog('generate-report-bg', `Summary report generated at: ${rPath}`);
           reportPath = rPath; // Store path if needed later
         } else {
            console.error('[API /analyze] Background task failed to generate summary report.');
         }
       }).catch(reportErr => {
         console.error('[API /analyze] Error generating summary report (background):', reportErr);
       });
        backgroundTasks.push(generateReportTask);
     } else {
        safeLog('generate-report-bg', 'Skipping report generation due to invalid/error results.');
     }

    // Note: We don't await Promise.all(backgroundTasks) to avoid blocking the response.
    // These tasks continue after the response is sent.

    // Schedule cleanup of temporary files - also runs in background
    try {
      scheduleCleanup(submissionId); // Pass original file path if saved and needs cleanup too
      safeLog('cleanup-scheduled', `File cleanup scheduled for submission ID: ${submissionId}`);
    } catch (cleanupError) {
      console.error('[API /analyze] Error scheduling cleanup:', cleanupError);
    }

    // --- Generate download links (Always use /tmp/ prefix) ---
    const reportFilename = `report-${submissionId}.md`;
    const jsonFilename = `results-${submissionId}.json`;

    // Construct path strings assuming /tmp/ base, mimicking production
    const reportPathForLink = `/tmp/${reportFilename}`; // Use simple string concatenation
    const jsonPathForLink = `/tmp/${jsonFilename}`;   // Use simple string concatenation

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const reportLinks = {
      report: `${baseUrl}/api/download?path=${encodeURIComponent(reportPathForLink)}`,
      json: `${baseUrl}/api/download?path=${encodeURIComponent(jsonPathForLink)}`
    };
    safeLog('reportLinks-generated (using /tmp/ prefix)', reportLinks);


    safeLog('preparing-response', `Preparing successful response for ID: ${submissionId}`);

    // Create final response object - include reportLinks
    const finalResponse = {
      ...analysisResults, // Spread the results from AI Service
      submissionId,       // Add submissionId
      reportLinks         // Add the generated download links
    };

    // Return the response immediately
    return NextResponse.json(finalResponse);

  } catch (error) {
    // Catch errors from form parsing, validation, or unexpected issues
    console.error(`[API /analyze] Critical Error for ID ${submissionId || 'N/A'}:`, error);
    // Log duration even on error if possible
     if (analysisStartTime) {
        console.error(`[API /analyze] Error occurred after ${Date.now() - analysisStartTime}ms`);
     }
    return NextResponse.json(
      { error: `Error analyzing document: ${error.message}` },
      { status: 500 } // Internal Server Error
    );
  }
}

// --- OPTIONS Handler ---
export function OPTIONS() {
  console.log('[API /analyze] Received OPTIONS request.');
  // Basic CORS headers - adjust origin and methods as needed for security
  const headers = {
      'Access-Control-Allow-Origin': '*', // Be more restrictive in production
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add any other headers your client sends
      'Access-Control-Max-Age': '86400' // Cache preflight response for 1 day
  };
  return new Response(null, { status: 204, headers }); // No Content for OPTIONS preflight
}
