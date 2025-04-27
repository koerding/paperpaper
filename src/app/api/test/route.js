// File Path: src/app/api/test/route.js
import { NextResponse } from 'next/server';

/**
 * Simple test endpoint to verify API route functionality
 * @returns {NextResponse} - JSON response
 */
export async function GET() {
  console.log('[API /test] Received GET request');
  
  return NextResponse.json({
    status: 'success',
    message: 'API route is functioning correctly',
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
  console.log('[API /test] Received OPTIONS request');
  
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
