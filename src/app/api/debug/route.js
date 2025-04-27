// File: src/app/api/debug/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    // Don't include sensitive env vars!
    envCheck: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasModel: !!process.env.OPENAI_MODEL,
      hasBaseUrl: !!process.env.NEXT_PUBLIC_BASE_URL
    }
  });
}
