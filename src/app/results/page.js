'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppContext } from '@/context/AppContext'
import ResultsDisplay from '@/components/ResultsDisplay'
import Link from 'next/link'

export default function ResultsPage() {
  const searchParams = useSearchParams()
  const submissionId = searchParams.get('id')
  const { getSubmission } = useAppContext()
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (submissionId) {
      const sub = getSubmission(submissionId)
      if (sub) {
        setSubmission(sub)
      } else {
        setError('Submission not found')
      }
      setLoading(false)
    }
  }, [submissionId, getSubmission])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !submission) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-lg font-medium text-destructive">
          {error || 'Submission not found'}
        </div>
        <Link 
          href="/"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analysis Results</h2>
        <Link 
          href="/"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          New Analysis
        </Link>
      </div>
      
      <div className="border rounded-md p-4 bg-muted/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">File Name</p>
            <p className="font-medium">{submission.fileName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date Submitted</p>
            <p className="font-medium">
              {new Date(submission.date).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      
      {submission.status === 'processing' ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-lg">Analyzing your paper...</p>
          </div>
        </div>
      ) : (
        <ResultsDisplay results={submission.results} />
      )}
    </div>
  )
}
