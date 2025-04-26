// File Path: src/app/api/analyze/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// Using relative paths
import {
  extractTextFromFile,
  validateDocumentSize
} from '../../../services/ProcessingService.js';
import { analyzeDocumentStructure } from '../../../services/AIService.js'; // Corrected: This is where the AI call happens
import {
  saveFile,
  saveResults,
  generateSummaryReport,
  scheduleCleanup
} from '../../../services/StorageService.js';
import { MAX_CHAR_COUNT } from '../../../lib/constants.js';

// DEBUG HELPER: Write content to debug file
const writeDebugFile = async (prefix, content, submissionId) => {
    try {
        // Create debug directory if it doesn't exist
        const debugDir = path.join(process.cwd(), 'debug_logs');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        
        // Write to timestamped debug file with submission ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(debugDir, `route-${prefix}-${submissionId}-${timestamp}.json`);
        
        // Format content based on type
        let formattedContent = content;
        if (typeof content === 'object') {
            formattedContent = JSON.stringify(content, null, 2);
        }
        
        fs.writeFileSync(filename, formattedContent);
        console.log(`[API Debug] Wrote ${prefix} to ${filename}`);
        return filename;
    } catch (err) {
        console.error(`[API Debug] Failed to write debug file for ${prefix}:`, err);
        return null;
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
    // ... (Payload size check, form parsing, file retrieval - keep existing logs) ...
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

    if (formData.has('fileText')) {
      fileText = formData.get('fileText');
      console.log('[API /analyze] Client-extracted text found.');
      // DEBUG - Save client-extracted text
      await writeDebugFile('client-extracted-text', fileText, submissionId);
    } else {
      console.log('[API /analyze] No client-extracted text. Processing file on server...');
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
         filePath = await saveFile(buffer, file.name, submissionId);
         console.log(`[API /analyze] File saved temporarily to: ${filePath}`);
      } catch (saveError) {
         console.error('[API /analyze] Error saving temporary file:', saveError);
      }
      console.log('[API /analyze] Attempting server-side text extraction...');
      fileText = await extractTextFromFile(file);
      console.log(`[API /analyze] Server-side text extraction successful. Length: ${fileText?.length || 0}`);
      // DEBUG - Save server-extracted text
      await writeDebugFile('server-extracted-text', fileText, submissionId);
    }

    console.log('[API /analyze] Validating document character count...');
    if (!validateDocumentSize(fileText, MAX_CHAR_COUNT)) {
      console.error(`[API /analyze] Error: Document text too large (${fileText?.length || 0} chars).`);
      return NextResponse.json({ error: `Document is too large. Max ${MAX_CHAR_COUNT} chars.` }, { status: 400 });
    }
    console.log('[API /analyze] Document size validated.');

    // --- Logging around the AI Service Call ---
    console.log(`[API /analyze] >>>>>>>>>> Calling analyzeDocumentStructure in AIService for ID: ${submissionId}...`);
    const analysisStartTime = Date.now();
    // Ensure fileText is passed correctly
    const analysisResults = await analyzeDocumentStructure(null, fileText);
    const analysisEndTime = Date.now();
    console.log(`[API /analyze] <<<<<<<<<< AIService analyzeDocumentStructure completed for ID: ${submissionId}. Duration: ${analysisEndTime - analysisStartTime}ms`);
    // --- End Logging ---

    if (typeof analysisResults !== 'object' || analysisResults === null) {
         console.error('[API /analyze] Error: AI analysis did not return a valid object.');
         throw new Error('AI analysis failed to produce valid results.');
     }
    console.log('[API /analyze] AI analysis raw results:', JSON.stringify(analysisResults).substring(0, 200) + '...'); // Log snippet of results
    
    // DEBUG - Save analysis results
    await writeDebugFile('analysis-results', analysisResults, submissionId);


    // ... (Saving results, generating report, scheduling cleanup - keep existing logs) ...
    let resultsPath = null;
    try {
        resultsPath = await saveResults(analysisResults, submissionId);
        console.log(`[API /analyze] Analysis results saved to: ${resultsPath}`);
    } catch(saveErr) {
        console.error('[API /analyze] Error saving analysis results JSON:', saveErr);
    }
    let reportPath = null;
    try {
        if (typeof analysisResults === 'object' && analysisResults !== null) {
            reportPath = await generateSummaryReport(analysisResults, submissionId);
            console.log(`[API /analyze] Summary report generated at: ${reportPath}`);
        } else {
             console.warn('[API /analyze] Skipping report generation due to invalid analysis results.');
        }
    } catch (reportErr) {
        console.error('[API /analyze] Error generating summary report:', reportErr);
    }
    if (filePath || resultsPath || reportPath) {
        scheduleCleanup(submissionId);
        console.log(`[API /analyze] File cleanup scheduled for submission ID: ${submissionId}`);
    } else {
        console.log(`[API /analyze] No files to schedule cleanup for submission ID: ${submissionId}`);
    }


    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const reportLinks = {};
    if (reportPath) reportLinks.report = `${baseUrl}/api/download?path=${encodeURIComponent(reportPath)}`;
    if (resultsPath) reportLinks.json = `${baseUrl}/api/download?path=${encodeURIComponent(resultsPath)}`;

    console.log(`[API /analyze] Preparing successful response for ID: ${submissionId}`);
    
    // Create final response
    const finalResponse = {
      ...analysisResults,
      submissionId,
      reportLinks
    };
    
    // DEBUG - Save final response
    await writeDebugFile('final-response', finalResponse, submissionId);
    
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
  return NextResponse.json({}, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
