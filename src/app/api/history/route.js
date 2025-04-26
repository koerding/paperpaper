// File Path: src/app/api/history/route.js
import { NextResponse } from 'next/server'

/**
 * API route for history (placeholder for future implementation with database)
 * Currently, history is managed client-side using localStorage
 * This will be expanded when authentication is added
 *
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response
 */
export async function GET(request) {
    console.log('[API /history] Received GET request (placeholder).');
  // This is a placeholder for future server-side history implementation
  // Currently, history is managed client-side using localStorage

  return NextResponse.json({
    message: 'History API is not yet implemented server-side. Currently using client-side storage.',
    timestamp: new Date().toISOString()
  });
}

/**
 * Placeholder for future implementation to clear history
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response
 */
export async function DELETE(request) {
    console.log('[API /history] Received DELETE request (placeholder).');
  // This is a placeholder for future server-side history implementation

  return NextResponse.json({
    message: 'Clear history API is not yet implemented server-side.',
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
    console.log('[API /history] Received OPTIONS request.');
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Restrict in production
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
