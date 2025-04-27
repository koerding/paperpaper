export const maxDuration = 300; // 5 minutes timeout


// File Path: src/app/api/analyze/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// Using absolute paths with @ alias
import {
  extractTextFromFile,
  validateDocumentSize
} from '@/services/ProcessingService.js';
import { analyzeDocumentStructure } from '@/services/AIService.js';
import {
  saveFile,
  saveResults,
  generateSummaryReport,
  scheduleCleanup
} from '@/services/StorageService.js';
import { MAX_CHAR_COUNT } from '@/lib/constants.js';

// Safe console logging that won't break the API
const safeLog = (prefix, message) => {
  try {
    console.log(`[API /analyze] ${prefix}: ${typeof message === 'object' ? JSON.stringify(message).substring(0, 200) + '...' : message}`);
  } catch (error) {
    console.log(`[API /analyze] Error logging ${prefix}`);
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

  try {
    // Check payload size
    const contentLength = request.headers.get('content-length');
    console.log(`[API /analyze] Content-Length: ${contentLength}`);
    if (contentLength && parseInt(contentLength, 10) > 15 * 1024 * 1024) {
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
    console.log(`[API /analyze] File received: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    let fileText;
    let filePath = null;

    // Try to use client-extracted text if available, otherwise extract on server
    if (formData.has('fileText')) {
      fileText = formData.get('fileText');
      console.log('[API /analyze] Client-extracted text found.');
      // No debug file writing in production
    } else {
      console.log('[API /analyze] No client-extracted text. Processing file on server...');
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
         filePath = await saveFile(buffer, file.name, submissionId);
         if (filePath) {
           console.log(`[API /analyze] File saved temporarily to: ${filePath}`);
         } else {
           console.log(`[API /analyze] File could not be saved, but continuing with in-memory processing`);
         }
      } catch (saveError) {
         console.error('[API /analyze] Error saving temporary file:', saveError);
         // Continue anyway, we'll process the file in memory
      }
      
      console.log('[API /analyze] Attempting server-side text extraction...');
      try {
        fileText = await extractTextFromFile(file);
        console.log(`[API /analyze] Server-side text extraction successful. Length: ${fileText?.length || 0}`);
      } catch (extractError) {
        console.error('[API /analyze] Error extracting text from file:', extractError);
        return NextResponse.json({ error: `Could not extract text from the file: ${extractError.message}` }, { status: 400 });
      }
    }

    // Validate document size
    console.log('[API /analyze] Validating document character count...');
    if (!validateDocumentSize(fileText, MAX_CHAR_COUNT)) {
      console.error(`[API /analyze] Error: Document text too large (${fileText?.length || 0} chars).`);
      return NextResponse.json({ error: `Document is too large. Max ${MAX_CHAR_COUNT} chars.` }, { status: 400 });
    }
    console.log('[API /analyze] Document size validated.');

    // Call AI service with the extracted text
    console.log(`[API /analyze] >>>>>>>>>> Calling analyzeDocumentStructure in AIService for ID: ${submissionId}...`);
    const analysisStartTime = Date.now();
    
    // Implement timeout for the AI analysis
    const timeoutDuration = 180000; // 3 minutes in milliseconds
    const analysisPromise = analyzeDocumentStructure(null, fileText);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timed out after 3 minutes')), timeoutDuration);
    });
    
    // Race the analysis against a timeout
    let analysisResults;
    try {
      analysisResults = await Promise.race([analysisPromise, timeoutPromise]);
    } catch (timeoutError) {
      console.error(`[API /analyze] Analysis timed out for ID: ${submissionId}`);
      return NextResponse.json({ 
        error: 'Analysis took too long to complete. Please try again with a shorter document.' 
      }, { status: 504 });
    }
    
    const analysisEndTime = Date.now();
    console.log(`[API /analyze] <<<<<<<<<< AIService analyzeDocumentStructure completed for ID: ${submissionId}. Duration: ${analysisEndTime - analysisStartTime}ms`);

    if (typeof analysisResults !== 'object' || analysisResults === null) {
       console.error('[API /analyze] Error: AI analysis did not return a valid object.');
       return NextResponse.json({ 
         error: 'AI analysis failed to produce valid results.' 
       }, { status: 500 });
    }
    
    safeLog('AI analysis result snippet', analysisResults);

    // Save results and generate report - don't block on these operations
    let resultsPath = null;
    let reportPath = null;
    
    // Wrap in try/catch but don't await - let these run in background
    try {
        // Fire and forget - these operations will continue in background
        saveResults(analysisResults, submissionId).then(path => {
          if (path) {
            console.log(`[API /analyze] Analysis results saved to: ${path}`);
            resultsPath = path;
            
            // Generate report after results are saved
            if (typeof analysisResults === 'object' && analysisResults !== null) {
              generateSummaryReport(analysisResults, submissionId).then(rPath => {
                if (rPath) {
                  console.log(`[API /analyze] Summary report generated at: ${rPath}`);
                  reportPath = rPath;
                }
              }).catch(reportErr => {
                console.error('[API /analyze] Error generating summary report:', reportErr);
              });
            }
          }
        }).catch(saveErr => {
          console.error('[API /analyze] Error saving analysis results JSON:', saveErr);
        });
    } catch (error) {
        console.error('[API /analyze] Error initiating background save operations:', error);
    }

    // Schedule cleanup of temporary files - don't block on this
    try {
      scheduleCleanup(submissionId);
      console.log(`[API /analyze] File cleanup scheduled for submission ID: ${submissionId}`);
    } catch (cleanupError) {
      console.error('[API /analyze] Error scheduling cleanup:', cleanupError);
    }

    // Generate download links
    // Determine the correct base path for download links based on environment
    // This logic MUST mirror the TEMP_DIR logic in StorageService.js and download/route.js
    const TEMP_DIR_FOR_LINKS = process.env.NODE_ENV === 'production'
      ? '/tmp'
      : (process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));

    const reportFilename = `report-${submissionId}.md`;
    const jsonFilename = `results-${submissionId}.json`;

    // Construct the full path used in the download link's 'path' query parameter
    const reportPathForLink = path.join(TEMP_DIR_FOR_LINKS, reportFilename);
    const jsonPathForLink = path.join(TEMP_DIR_FOR_LINKS, jsonFilename);


    // Generate download links using the correctly determined paths
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const reportLinks = {
      report: `${baseUrl}/api/download?path=${encodeURIComponent(reportPathForLink)}`,
      json: `${baseUrl}/api/download?path=${encodeURIComponent(jsonPathForLink)}`
    };
    safeLog('reportLinks-generated', reportLinks); // Add logging for generated links

    console.log(`[API /analyze] Preparing successful response for ID: ${submissionId}`);
    
    // Create final response
    const finalResponse = {
      ...analysisResults,
      submissionId,
      reportLinks
    };
    
    // Return the response immediately
    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error(`[API /analyze] Critical Error for ID ${submissionId}:`, error);
    return NextResponse.json(
      { error: `Error analyzing document: ${error.message}` },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  console.log('[API /analyze] Received OPTIONS request.');
  return NextResponse.json({}, { 
    status: 200, 
    headers: { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 
      'Access-Control-Allow-Headers': 'Content-Type, Authorization' 
    } 
  });
}
