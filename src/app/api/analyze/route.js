import { NextResponse } from 'next/server'
import { 
  extractTextFromFile, 
  extractDocumentStructure,
  validateDocumentSize,
  prepareForAnalysis 
} from '@/services/ProcessingService'
import { analyzeDocumentStructure } from '@/services/AIService'
import { 
  saveFile, 
  saveResults,
  generateSummaryReport,
  scheduleCleanup
} from '@/services/StorageService'
import { MAX_CHAR_COUNT } from '@/lib/constants'

/**
 * Analyze document structure
 * @param {Request} request - The request object
 * @returns {Promise<NextResponse>} - JSON response with analysis results
 */
export async function POST(request) {
  try {
    // Set max payload size
    if (request.headers.get('content-length') > 15 * 1024 * 1024) { // 15MB limit
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      )
    }
    
    // Parse form data
    const formData = await request.formData()
    
    // Get the file
    const file = formData.get('file')
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // Generate a submission ID
    const submissionId = `sub_${Date.now()}`
    
    let fileText
    
    // Check if text was already extracted client-side
    if (formData.has('fileText')) {
      fileText = formData.get('fileText')
    } else {
      // Extract text from file
      const buffer = Buffer.from(await file.arrayBuffer())
      
      // Save file to storage
      const filePath = await saveFile(buffer, file.name, submissionId)
      
      // Convert file to object for processing
      const fileObj = new File(
        [buffer], 
        file.name, 
        { type: file.type }
      )
      
      // Extract text
      fileText = await extractTextFromFile(fileObj)
    }
    
    // Validate document size
    if (!validateDocumentSize(fileText, MAX_CHAR_COUNT)) {
      return NextResponse.json(
        { error: `Document is too large. Maximum ${MAX_CHAR_COUNT} characters allowed.` },
        { status: 400 }
      )
    }
    
    // Extract document structure
    const documentStructure = extractDocumentStructure(fileText)
    
    // Prepare for analysis
    const preparedDocument = prepareForAnalysis(documentStructure)
    
    // Analyze document structure
    const analysisResults = await analyzeDocumentStructure(preparedDocument)
    
    // Save results to file
    const resultsPath = await saveResults(analysisResults, submissionId)
    
    // Generate summary report
    const reportPath = await generateSummaryReport(analysisResults, submissionId)
    
    // Schedule cleanup of files after 24 hours
    scheduleCleanup(submissionId)
    
    // Convert file paths to URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`
    
    const reportLinks = {
      report: `${baseUrl}/api/download?path=${encodeURIComponent(reportPath)}`,
      json: `${baseUrl}/api/download?path=${encodeURIComponent(resultsPath)}`,
    }
    
    // Return results with report links
    return NextResponse.json({
      ...analysisResults,
      submissionId,
      reportLinks
    })
  } catch (error) {
    console.error('Error analyzing document:', error)
    
    return NextResponse.json(
      { error: 'Error analyzing document: ' + error.message },
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
