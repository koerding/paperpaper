// File Path: src/app/api/download/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// No readFile import needed from StorageService here, we'll use fs.promises directly

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
 * Download a file from storage
 * @param {Request} request - The request object
 * @returns {Promise<Response>} - File download response
 */
export async function GET(request) {
    console.log('[API /download] Received GET request.');
  try {
    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path'); // Get the raw path from query
    safeLog('requested-file-path', requestedPath);

    if (!requestedPath) {
      console.error('[API /download] Error: No file path provided.');
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    // --- Path Validation Logic ---
    // Normalize the requested path first
    const normalizedPath = path.normalize(requestedPath);
    safeLog('normalized-path', normalizedPath);

    // Determine the expected base temporary directory based on environment
    const tempDir = process.env.NODE_ENV === 'production'
      ? '/tmp'
      // Ensure local path uses path.resolve for a consistent absolute path
      : path.resolve(process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp'));
    safeLog('temp-directory-base', tempDir);

    // **Explicit Logging for Path Comparison**
    safeLog('checking-if-path-starts-with', { path: normalizedPath, dir: tempDir });

    // Security Check: Ensure the normalized path is within the expected temp directory
    // This check needs to be robust for both local (absolute paths) and production (/tmp)
    const isPathSafe = normalizedPath.startsWith(tempDir);

    // **Log the outcome of the safety check**
    safeLog('path-safety-check-result', { isPathSafe });

    if (!isPathSafe) {
       // Provide more context in the error log
       console.error(`[API /download] Forbidden: Path "${normalizedPath}" is outside the allowed directory "${tempDir}".`);
       return NextResponse.json(
         { error: 'Invalid file path' },
         { status: 403 } // Forbidden
       );
    }
    safeLog('path-validation', 'Passed security check');


    // --- File Existence and Reading ---
    let fileData;
    try {
        // **Crucial Check**: Verify file exists and is accessible *after* path validation
        safeLog('checking-file-access', normalizedPath);
        await fs.promises.access(normalizedPath, fs.constants.F_OK | fs.constants.R_OK); // Check for existence (F_OK) and read permission (R_OK)
        safeLog('file-access-check', 'File exists and is readable');

        // Read the file content *after* confirming existence
        safeLog('reading-file-content', normalizedPath);
        fileData = await fs.promises.readFile(normalizedPath);
        safeLog('file-read-success', `Read ${fileData.length} bytes`);

    } catch (err) {
        // Handle specific errors, especially file not found (ENOENT)
        if (err.code === 'ENOENT') {
            console.error(`[API /download] Error: File not found at path: ${normalizedPath}`);
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        } else if (err.code === 'EACCES') {
             console.error(`[API /download] Error: Permission denied for file: ${normalizedPath}`);
             return NextResponse.json(
                 { error: 'Permission denied' },
                 { status: 403 }
             );
        } else {
            // Log other unexpected errors during file access/read
            console.error(`[API /download] Error accessing/reading file: ${normalizedPath}`, err);
            throw err; // Re-throw unexpected errors to be caught by the outer try/catch
        }
    }


    // --- Determine Content Type and Send Response ---
    const extension = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default

    const mimeTypes = {
        '.json': 'application/json; charset=utf-8', // Specify charset for json
        '.md': 'text/markdown; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    contentType = mimeTypes[extension] || contentType;
    safeLog('content-type', contentType);

    const filename = path.basename(normalizedPath);
    safeLog('download-filename', filename);

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
    // Catch errors from URL parsing, path validation, or unexpected file read issues
    console.error('[API /download] Critical Error downloading file:', error);
    // Avoid leaking potentially sensitive error details
    const message = error.message?.includes('File not found') ? 'File not found' : 'Error downloading file';
    return NextResponse.json(
      { error: message },
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
        'Access-Control-Allow-Origin': '*', // Restrict in production if needed
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
