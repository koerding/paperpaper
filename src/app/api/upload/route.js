// File Path: src/app/api/upload/route.js
import { NextResponse } from 'next/server';
// Using relative paths
import { validateFileType } from '../../../lib/utils.js';
import {
  SUPPORTED_MIME_TYPES,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE
} from '../../../lib/constants.js';
import { saveFile } from '../../../services/StorageService.js';

/**
 * Process file upload (Note: This seems redundant if /api/analyze handles upload directly)
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response
 */
export async function POST(request) {
    console.log('[API /upload] Received POST request.');
  try {
    // Parse the form data
    console.log('[API /upload] Parsing form data...');
    const formData = await request.formData();

    // Get the file
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) { // Check if it's a File/Blob
       console.error('[API /upload] Error: No file provided or invalid file.');
      return NextResponse.json(
        { error: 'No valid file provided' },
        { status: 400 }
      );
    }
     console.log(`[API /upload] File received: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    // Get file information
    const type = file.type;
    const name = file.name;
    const size = file.size;

    // Validate file size
     console.log('[API /upload] Validating file size...');
    if (size > MAX_FILE_SIZE) {
       console.error(`[API /upload] Error: File too large (${size} bytes).`);
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }
     console.log('[API /upload] File size validated.');

    // Validate file type
     console.log('[API /upload] Validating file type...');
    if (!validateFileType(type, name, SUPPORTED_MIME_TYPES, SUPPORTED_EXTENSIONS)) {
       console.error(`[API /upload] Error: Unsupported file type: ${type} / ${name}`);
      return NextResponse.json(
        { error: `Unsupported file type. Please upload ${SUPPORTED_EXTENSIONS.join(', ')} files.` },
        { status: 400 }
      );
    }
     console.log('[API /upload] File type validated.');

    // Generate a submission ID (might be different from analysis ID?)
    const submissionId = `upload_${Date.now()}`;
     console.log(`[API /upload] Generated upload ID: ${submissionId}`);

    // Get file data
    const buffer = Buffer.from(await file.arrayBuffer());
     console.log(`[API /upload] File buffer created. Length: ${buffer.length}`);

    // Save file to temporary storage
     console.log('[API /upload] Saving file temporarily...');
    const filePath = await saveFile(buffer, name, submissionId);
     console.log(`[API /upload] File saved temporarily to: ${filePath}`);

    // Return success response
     console.log('[API /upload] Preparing successful response...');
    return NextResponse.json({
      success: true,
      submissionId,
      file: {
        name,
        type,
        size,
        path: filePath, // Return the path where it was saved
      }
    });
  } catch (error) {
    console.error('[API /upload] Critical Error processing file upload:', error);
    return NextResponse.json(
      { error: 'Error processing file upload: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
    console.log('[API /upload] Received OPTIONS request.');
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Restrict in production
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
