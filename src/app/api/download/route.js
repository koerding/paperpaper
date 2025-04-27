// File Path: src/app/api/download/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    console.log(`[API /download] ${prefix}: ${loggableMessage}`);
  } catch (error) {
    console.log(`[API /download] Error logging ${prefix}: ${error.message}`);
  }
};

/**
 * Download a file from storage (Environment-Aware)
 * @param {Request} request - The request object
 * @returns {Promise<Response>} - File download response
 */
export async function GET(request) {
    console.log('[API /download] Received GET request.');
  try {
    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path'); // Path from URL (e.g., /tmp/report-XYZ.md)
    safeLog('requested-path-from-url', requestedPath);

    if (!requestedPath || typeof requestedPath !== 'string') {
      console.error('[API /download] Error: No valid file path provided.');
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    // --- Determine Correct File System Path ---
    let finalFileSystemPath;
    const isProduction = process.env.NODE_ENV === 'production';
    const filename = path.basename(requestedPath); // Extract filename (safer than using the whole path)

    // Basic security check: prevent path traversal in filename
    // Disallow paths starting with '.' or containing '..' or '/' or '\'
    if (filename.startsWith('.') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
         console.error(`[API /download] Error: Invalid or potentially unsafe characters found in filename: ${filename}`);
         return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    if (isProduction) {
        // In production, expect path to start with /tmp/
        safeLog('environment', 'Production');
        const normalizedRequestedPath = path.normalize(requestedPath); // Normalize before checking prefix

        // Ensure the path is within /tmp and doesn't try to escape it
        if (!normalizedRequestedPath.startsWith('/tmp/') || normalizedRequestedPath.includes('..')) {
            console.error(`[API /download] Error: Production path is invalid or outside /tmp/: ${normalizedRequestedPath}`);
            return NextResponse.json({ error: 'Invalid file path for production environment' }, { status: 400 });
        }
        // Use the normalized requested path directly
        finalFileSystemPath = normalizedRequestedPath;
    } else {
        // In local development, the link *says* /tmp/ but the file is actually in ./tmp (relative to CWD)
        safeLog('environment', 'Development/Local');
        // Calculate the absolute path to the local temp directory
        const localTempDir = path.resolve(process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));
        safeLog('local-temp-dir', localTempDir);

        // Construct the actual local path using the local temp dir and the extracted filename
        finalFileSystemPath = path.join(localTempDir, filename);
        // Optional: Add an extra check to ensure the resolved local path is still within the intended base directory
        if (!finalFileSystemPath.startsWith(localTempDir)) {
             console.error(`[API /download] Error: Resolved local path "${finalFileSystemPath}" is outside base temp directory "${localTempDir}".`);
             return NextResponse.json({ error: 'Invalid derived file path' }, { status: 400 });
        }
    }

    safeLog('final-filesystem-path-to-check', finalFileSystemPath);


    // --- File Existence and Reading ---
    let fileData;
    try {
        safeLog('checking-file-access', finalFileSystemPath);
        await fs.promises.access(finalFileSystemPath, fs.constants.F_OK | fs.constants.R_OK); // Check existence and read permission
        safeLog('file-access-check', 'File exists and is readable');

        safeLog('reading-file-content', finalFileSystemPath);
        fileData = await fs.promises.readFile(finalFileSystemPath);
        safeLog('file-read-success', `Read ${fileData.length} bytes`);

    } catch (err) {
        // Handle specific errors
        if (err.code === 'ENOENT') {
            console.error(`[API /download] Error: File not found at path: ${finalFileSystemPath}`);
            // Add a small delay and retry ONCE in case of timing issue (write not finished)
            console.log('[API /download] Retrying file access after short delay...');
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
            try {
                await fs.promises.access(finalFileSystemPath, fs.constants.F_OK | fs.constants.R_OK);
                fileData = await fs.promises.readFile(finalFileSystemPath);
                safeLog('file-read-success-on-retry', `Read ${fileData.length} bytes`);
            } catch (retryErr) {
                 if (retryErr.code === 'ENOENT') {
                     console.error(`[API /download] Error: File still not found after retry: ${finalFileSystemPath}`);
                     return NextResponse.json({ error: 'File not found' }, { status: 404 });
                 } else {
                      console.error(`[API /download] Error during file access retry: ${finalFileSystemPath}`, retryErr);
                      throw retryErr; // Throw other retry errors
                 }
            }
        } else if (err.code === 'EACCES') {
             console.error(`[API /download] Error: Permission denied for file: ${finalFileSystemPath}`);
             return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        } else {
            // Log other unexpected errors
            console.error(`[API /download] Error accessing/reading file: ${finalFileSystemPath}`, err);
            throw err; // Re-throw unexpected errors
        }
    }


    // --- Determine Content Type and Send Response ---
    const extension = path.extname(filename).toLowerCase(); // Use extname on filename
    let contentType = 'application/octet-stream'; // Default
    const mimeTypes = {
        '.json': 'application/json; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    contentType = mimeTypes[extension] || contentType;
    safeLog('content-type', contentType);
    safeLog('download-filename', filename);

    safeLog('sending-response', 'Returning file download response');
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching
        'Pragma': 'no-cache',
        'Expires': '0',
       },
    });

  } catch (error) {
    // Catch errors from URL parsing, path construction, or unexpected file issues
    console.error('[API /download] Critical Error downloading file:', error);
    // Avoid leaking detailed error messages to the client
    const message = (error.message?.includes('File not found') || error.message?.includes('ENOENT')) ? 'File not found' : 'Error downloading file';
    return NextResponse.json(
      { error: message },
      { status: 500 } // Internal Server Error
    );
  }
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
    console.log('[API /download] Received OPTIONS request.');
   // Basic CORS headers - adjust origin and methods as needed for security
   const headers = {
       'Access-Control-Allow-Origin': '*', // Be more restrictive in production
       'Access-Control-Allow-Methods': 'GET, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add any other headers client might send
       'Access-Control-Max-Age': '86400' // Cache preflight response for 1 day
   };
   return new Response(null, { status: 204, headers }); // No Content for OPTIONS preflight
}
