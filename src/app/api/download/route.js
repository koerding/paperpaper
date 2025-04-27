// File Path: src/app/api/download/route.js
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
// Using absolute path with @ alias
import { readFile } from '@/services/StorageService.js';

/**
 * Download a file from storage
 * @param {Request} request - The request object
 * @returns {Promise<Response>} - File download response
 */
export async function GET(request) {
    console.log('[API /download] Received GET request.');
  try {
    // Get file path from query parameters
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    console.log(`[API /download] Requested file path: ${filePath}`);

    if (!filePath) {
      console.error('[API /download] Error: No file path provided.');
      return NextResponse.json(
        { error: 'No file path provided' },
        { status: 400 }
      );
    }

    // Prevent path traversal attacks
    const normalizedPath = path.normalize(filePath);
    // Ensure TEMP_DIR is defined consistently (consider using constants.js or env)
    const tempDir = path.normalize(process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));
    console.log(`[API /download] Normalized path: ${normalizedPath}`);
    console.log(`[API /download] Temp directory: ${tempDir}`);


    // Security Check: Ensure the normalized path starts with the temp directory
    // Use path.resolve to get absolute paths for comparison
    const resolvedPath = path.resolve(normalizedPath);
    const resolvedTempDir = path.resolve(tempDir);
    if (!resolvedPath.startsWith(resolvedTempDir)) {
       console.error(`[API /download] Forbidden: Invalid file path. Path ${resolvedPath} is outside of ${resolvedTempDir}`);
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
     console.log(`[API /download] Path validation passed.`);

    // Check if file exists using fs.promises for async
    try {
        await fs.promises.access(normalizedPath, fs.constants.F_OK);
         console.log(`[API /download] File exists at path: ${normalizedPath}`);
    } catch (err) {
         console.error(`[API /download] Error: File not found at path: ${normalizedPath}`);
         return NextResponse.json(
             { error: 'File not found' },
             { status: 404 }
         );
    }


    // Get file data using StorageService's readFile
    console.log(`[API /download] Reading file data...`);
    const fileData = await readFile(normalizedPath); // Use the imported readFile
    console.log(`[API /download] File data read successfully. Size: ${fileData.length}`);

    // Determine content type
    const extension = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default

    // Common MIME types (add more if needed)
    const mimeTypes = {
        '.json': 'application/json',
        '.md': 'text/markdown; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Add other types your app might generate/store
    };

    contentType = mimeTypes[extension] || contentType;
    console.log(`[API /download] Determined Content-Type: ${contentType}`);

    // Get filename from path for Content-Disposition
    const filename = path.basename(normalizedPath);
    console.log(`[API /download] Setting filename for download: ${filename}`);

    // Create and return the response
     console.log(`[API /download] Sending file response.`);
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Use attachment to force download, inline might try to display
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Prevent caching of the download
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[API /download] Critical Error downloading file:', error);
    return NextResponse.json(
      { error: 'Error downloading file: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
    console.log('[API /download] Received OPTIONS request.');
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Restrict in production
        'Access-Control-Allow-Methods': 'GET, OPTIONS', // Only GET is needed
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
