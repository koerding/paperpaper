import { NextResponse } from 'next/server'
import { validateFileType } from '@/lib/utils'
import { 
  SUPPORTED_MIME_TYPES, 
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE
} from '@/lib/constants'
import { saveFile } from '@/services/StorageService'

/**
 * Process file upload
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response
 */
export async function POST(request) {
  try {
    // Parse the form data
    const formData = await request.formData()
    
    // Get the file
    const file = formData.get('file')
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // Get file information
    const type = file.type
    const name = file.name
    const size = file.size
    
    // Validate file size
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }
    
    // Validate file type
    if (!validateFileType(type, name, SUPPORTED_MIME_TYPES, SUPPORTED_EXTENSIONS)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .docx, .txt, .md, or .tex files.' },
        { status: 400 }
      )
    }
    
    // Generate a submission ID
    const submissionId = `sub_${Date.now()}`
    
    // Get file data
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Save file to temporary storage
    const filePath = await saveFile(buffer, name, submissionId)
    
    // Return success response
    return NextResponse.json({
      success: true,
      submissionId,
      file: {
        name,
        type,
        size,
        path: filePath,
      }
    })
  } catch (error) {
    console.error('Error processing file upload:', error)
    
    return NextResponse.json(
      { error: 'Error processing file upload: ' + error.message },
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}
