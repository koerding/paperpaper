// File Path: src/app/api/download/route.js
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
// Using absolute path with @ alias
import { readFile } from '@/services/StorageService.js';

// Safe console logging that won't break the API
const safeLog = (prefix, message) => {
  try {
    console.log(`[API /download] ${prefix}: ${typeof message === 'object' ? JSON.stringify(message).substring(0, 200) + '...' : message}`);
  } catch (error) {
    console.log(`[API /download] Error logging ${prefix}`);
  }
};

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
    safeLog('requested-file-path', filePath);

    if (!filePath) {
      console.error('[API /download] Error: No file path provided.');
      return NextResponse.json(
        { error: 'No file path provided' },
        { status: 400 }
      );
    }

    // Prevent path traversal attacks
    const normalizedPath = path.normalize(filePath);
    // Use /tmp in production environment for Vercel
    const tempDir = process.env.NODE_ENV === 'production'
      ? '/tmp'
      : (process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));
    
    safeLog('normalized-path', normalizedPath);
    safeLog('temp-directory', tempDir);

    // Security Check: Ensure the normalized path is within the temp directory
    // Special handling for Vercel environment
    const isPathSafe = normalizedPath.startsWith(tempDir) || 
                      (process.env.NODE_ENV === 'production' && normalizedPath.startsWith('/tmp'));
                      
    if (!isPathSafe) {
       console.error(`[API /download] Forbidden: Invalid file path outside temp directory`);
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    safeLog('path-validation', 'Passed security check');

    // Check if file exists using try/catch
    try {
        // Try to directly access file to see if it exists
        await fs.promises.access(normalizedPath, fs.constants.F_OK);
        safeLog('file-exists', 'File exists, proceeding with download');
    } catch (err) {
        // If not found in specified location, try with /tmp as fallback in production
        if (process.env.NODE_ENV === 'production' && !normalizedPath.startsWith('/tmp')) {
          const tmpFallbackPath = path.join('/tmp', path.basename(normalizedPath));
          safeLog('file-not-found-trying-fallback', tmpFallbackPath);
          
          try {
            await fs.promises.access(tmpFallbackPath, fs.constants.F_OK);
            // If found in fallback location, use that path
            safeLog('fallback-file-exists', 'Using fallback path');
            normalizedPath = tmpFallbackPath;
          } catch (fallbackErr) {
            // Neither original nor fallback exists
            console.error(`[API /download] Error: File not found in any location`);
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
          }
        } else {
          // No fallback to try, file doesn't exist
          console.error(`[API /download] Error: File not found at path: ${normalizedPath}`);
          return NextResponse.json(
              { error: 'File not found' },
              { status: 404 }
          );
        }
    }

    // Get file data using StorageService's readFile
    safeLog('reading-file', 'Starting file read operation');
    
    let fileData;
    try {
      fileData = await readFile(normalizedPath);
      safeLog('file-read-success', `File read: ${fileData.length} bytes`);
    } catch (readError) {
      // Try direct filesystem read as fallback if the service fails
      safeLog('service-read-failed', 'Falling back to direct filesystem read');
      fileData = await fs.promises.readFile(normalizedPath);
    }

    // Determine content type
    const extension = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default

    // Common MIME types
    const mimeTypes = {
        '.json': 'application/json',
        '.md': 'text/markdown; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    contentType = mimeTypes[extension] || contentType;
    safeLog('content-type', contentType);

    // Get filename from path for Content-Disposition
    const filename = path.basename(normalizedPath);
    safeLog('download-filename', filename);

    // Create and return the response
    safeLog('sending-response', 'Returning file download response');
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
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
