import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readFile } from '@/services/StorageService'

/**
 * Download a file from storage
 * @param {Request} request - The request object
 * @returns {Promise<Response>} - File download response
 */
export async function GET(request) {
  try {
    // Get file path from query parameters
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'No file path provided' },
        { status: 400 }
      )
    }
    
    // Prevent path traversal attacks
    const normalizedPath = path.normalize(filePath)
    const tempDir = path.normalize(process.env.TEMP_FILE_PATH || './tmp')
    
    if (!normalizedPath.startsWith(tempDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      )
    }
    
    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    // Get file data
    const fileData = await readFile(normalizedPath)
    
    // Determine content type
    const extension = path.extname(normalizedPath).toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (extension) {
      case '.json':
        contentType = 'application/json'
        break
      case '.md':
        contentType = 'text/markdown'
        break
      case '.txt':
        contentType = 'text/plain'
        break
      case '.pdf':
        contentType = 'application/pdf'
        break
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        break
    }
    
    // Get filename from path
    const filename = path.basename(normalizedPath)
    
    // Create and return the response
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error downloading file:', error)
    
    return NextResponse.json(
      { error: 'Error downloading file: ' + error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle OPTIONS request for CORS
 * @returns {NextResponse} - Response with CORS headers
 */
export function OPTIONS() {
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
  )
}
