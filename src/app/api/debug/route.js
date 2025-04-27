// File Path: src/app/api/debug/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Debug endpoint to check API configuration
 * @returns {NextResponse} - JSON response with environment info
 */
export async function GET() {
  console.log('[API /debug] Received GET request.');
  
  // Collect debugging information
  const debug = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    api_working: true,
    vercel_region: process.env.VERCEL_REGION || 'unknown',
    vercel_env: process.env.VERCEL_ENV || 'unknown',
    // Check if OpenAI key is configured (without revealing it)
    openai_key_configured: !!process.env.OPENAI_API_KEY,
    openai_model: process.env.OPENAI_MODEL || 'gpt-4o',
    base_url: process.env.NEXT_PUBLIC_BASE_URL || 'not set',
    // Check if we can access the file system
    fs_access: true,
    // Check the current working directory
    cwd: process.cwd(),
  };
  
  try {
    // Check if temp dir exists or is accessible
    const tempDir = process.env.TEMP_FILE_PATH || path.join(process.cwd(), 'tmp');
    debug.temp_dir = tempDir;
    
    try {
      await fs.promises.access(tempDir, fs.constants.F_OK);
      debug.temp_dir_exists = true;
    } catch (err) {
      debug.temp_dir_exists = false;
      debug.temp_dir_error = err.code;
    }
    
    // Try to list files in the temp dir
    try {
      const files = await fs.promises.readdir(tempDir);
      debug.temp_dir_files_count = files.length;
    } catch (err) {
      debug.temp_dir_listing_error = err.code;
    }
    
    // Test importing a service
    try {
      const constants = await import('@/lib/constants.js');
      debug.imports_working = true;
      debug.max_file_size = constants.MAX_FILE_SIZE;
    } catch (error) {
      debug.imports_working = false;
      debug.import_error = error.message;
      
      // Try alternative path format
      try {
        const constants = await import('../../../lib/constants.js');
        debug.relative_imports_working = true;
      } catch (relError) {
        debug.relative_imports_working = false;
        debug.relative_import_error = relError.message;
      }
    }
  } catch (error) {
    debug.diagnostic_error = error.message;
  }
  
  return NextResponse.json(debug);
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
  console.log('[API /debug] Received OPTIONS request.');
  
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
