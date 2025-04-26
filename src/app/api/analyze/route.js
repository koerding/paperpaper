// File Path: src/app/api/analyze/route.js
import { NextResponse } from 'next/server';
// Using relative paths
import {
  extractTextFromFile,
  validateDocumentSize
} from '../../../services/ProcessingService.js';
import { analyzeDocumentStructure } from '../../../services/AIService.js';
import {
  saveFile,
  saveResults,
  generateSummaryReport,
  scheduleCleanup
} from '../../../services/StorageService.js';
import { MAX_CHAR_COUNT } from '../../../lib/constants.js';

/**
 * Analyze document structure
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response with analysis results
 */
export async function POST(request) {
  console.log('[API /analyze] Received POST request.');
  try {
    const contentLength = request.headers.get('content-length');
    console.log(`[API /analyze] Content-Length: ${contentLength}`);
    // Set max payload size (adjust as needed, e.g., 15MB)
    if (contentLength && parseInt(contentLength, 10) > 15 * 1024 * 1024) {
      console.error('[API /analyze] Error: Payload too large.');
      return NextResponse.json(
        { error: 'Payload too large. Limit is 15MB.' },
        { status: 413 }
      );
    }

    // Parse form data
    console.log('[API /analyze] Parsing form data...');
    const formData = await request.formData();
    const formKeys = Array.from(formData.keys());
    console.log('[API /analyze] Form data keys received:', formKeys);


    // Get the file
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) { // Check if it's a File/Blob
      console.error('[API /analyze] Error: No file provided or invalid file in form data.');
      return NextResponse.json(
        { error: 'No valid file provided' },
        { status: 400 }
      );
    }
    console.log(`[API /analyze] File received: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);


    // Generate a submission ID
    const submissionId = `sub_${Date.now()}`;
    console.log(`[API /analyze] Generated Submission ID: ${submissionId}`);

    let fileText;
    let filePath = null; // Keep track of saved file path

    // Check if text was already extracted client-side
    if (formData.has('fileText')) {
      fileText = formData.get('fileText');
      console.log('[API /analyze] Client-extracted text found in form data.');
    } else {
      console.log('[API /analyze] No client-extracted text found. Processing file on server...');
      // Extract text from file server-side
      const buffer = Buffer.from(await file.arrayBuffer());
      console.log(`[API /analyze] File buffer created. Length: ${buffer.length}`);


      // Save file to temporary storage BEFORE text extraction attempt
      try {
         filePath = await saveFile(buffer, file.name, submissionId);
         console.log(`[API /analyze] File saved temporarily to: ${filePath}`);
      } catch (saveError) {
         console.error('[API /analyze] Error saving temporary file:', saveError);
         // Decide if you want to stop or continue without saving
         // return NextResponse.json({ error: 'Failed to save uploaded file.' }, { status: 500 });
         // Continuing without filePath, analysis might still work if text extraction succeeds
      }

      // Pass the original File object directly to the extractor
      // (assuming extractTextFromFile can handle it)
      console.log('[API /analyze] Attempting server-side text extraction...');
      fileText = await extractTextFromFile(file); // Pass the File object
      console.log(`[API /analyze] Server-side text extraction successful. Length: ${fileText.length}`);
    }

    // Validate document size (character count)
    console.log('[API /analyze] Validating document character count...');
    if (!validateDocumentSize(fileText, MAX_CHAR_COUNT)) {
      console.error(`[API /analyze] Error: Document text too large (${fileText?.length || 0} chars).`);
      return NextResponse.json(
        { error: `Document is too large. Maximum ${MAX_CHAR_COUNT} characters allowed.` },
        { status: 400 }
      );
    }
    console.log('[API /analyze] Document size validated.');


    // Analyze document structure using AI
    console.log('[API /analyze] Calling AI service (analyzeDocumentStructure)...');
    const analysisResults = await analyzeDocumentStructure(null, fileText); // Pass null for document, focus on rawText
    console.log('[API /analyze] AI analysis completed.');

    // Ensure analysisResults is an object
     if (typeof analysisResults !== 'object' || analysisResults === null) {
         console.error('[API /analyze] Error: AI analysis did not return a valid object.');
         throw new Error('AI analysis failed to produce valid results.');
     }


    // Save results JSON to file
     let resultsPath = null;
     try {
         resultsPath = await saveResults(analysisResults, submissionId);
         console.log(`[API /analyze] Analysis results saved to: ${resultsPath}`);
     } catch(saveErr) {
         console.error('[API /analyze] Error saving analysis results JSON:', saveErr);
         // Continue without results file, but log error
     }


    // Generate summary report
     let reportPath = null;
     try {
         // Ensure analysisResults is valid before generating report
         if (typeof analysisResults === 'object' && analysisResults !== null) {
             reportPath = await generateSummaryReport(analysisResults, submissionId);
             console.log(`[API /analyze] Summary report generated at: ${reportPath}`);
         } else {
              console.warn('[API /analyze] Skipping report generation due to invalid analysis results.');
         }
     } catch (reportErr) {
         console.error('[API /analyze] Error generating summary report:', reportErr);
         // Continue without report file, but log error
     }


    // Schedule cleanup (filePath might be null if initial save failed)
    if (filePath || resultsPath || reportPath) {
        scheduleCleanup(submissionId);
        console.log(`[API /analyze] File cleanup scheduled for submission ID: ${submissionId}`);
    } else {
        console.log(`[API /analyze] No files to schedule cleanup for submission ID: ${submissionId}`);
    }


    // Convert file paths to URLs for download links
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    console.log(`[API /analyze] Base URL for downloads: ${baseUrl}`);

    const reportLinks = {};
    if (reportPath) {
      reportLinks.report = `${baseUrl}/api/download?path=${encodeURIComponent(reportPath)}`;
    }
     if (resultsPath) {
       reportLinks.json = `${baseUrl}/api/download?path=${encodeURIComponent(resultsPath)}`;
     }

    console.log('[API /analyze] Preparing successful response...');
    // Return results with report links
    return NextResponse.json({
      ...analysisResults, // Spread the analysis results
      submissionId, // Include submission ID
      reportLinks // Include download links
    });

  } catch (error) {
    // Log the detailed error on the server
    console.error('[API /analyze] Critical Error during analysis process:', error);
    // Return a generic error message to the client
    return NextResponse.json(
      // Send back the specific error message string
      { error: `Error analyzing document: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
  console.log('[API /analyze] Received OPTIONS request.');
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Consider restricting this in production
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
