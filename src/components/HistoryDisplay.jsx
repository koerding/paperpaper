// File Path: src/components/HistoryDisplay.jsx
'use client'

import { useState } from 'react'
// Using relative path
import { useAppContext } from '../context/AppContext.jsx'
import { FileText, Clock, CheckCircle, RotateCw, XCircle, Trash2 } from 'lucide-react'
import Link from 'next/link'
import EmptyState from './EmptyState.jsx' // Keep relative path for sibling component

export default function HistoryDisplay() {
  const { submissions, clearHistory } = useAppContext()
  const [confirmClear, setConfirmClear] = useState(false)

  // Sort submissions by date (newest first)
  const sortedSubmissions = [...submissions].sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  )

  // Get status icon based on submission status
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'processing':
        return <RotateCw className="h-5 w-5 text-blue-500 animate-spin" />
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        // Added a default case for potentially undefined status
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  // Format timestamp
  const formatDate = (dateString) => {
    try {
        const date = new Date(dateString);
        // Check if date is valid before formatting
        if (isNaN(date.getTime())) {
            return "Invalid Date";
        }
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return "Invalid Date";
    }
  }

  // Handle clear history
  const handleClearHistory = () => {
    if (confirmClear) {
      clearHistory()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      // Auto-reset confirm state after 3 seconds
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  // If no submissions
  if (sortedSubmissions.length === 0) {
    return (
      <EmptyState
        title="No submission history"
        description="When you submit papers for analysis, they will appear here."
        icon={<Clock className="h-12 w-12 text-muted-foreground/50" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Submission History</h2>
        <button
          onClick={handleClearHistory}
          className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors ${
            confirmClear
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          aria-label={confirmClear ? 'Confirm clearing history' : 'Clear submission history'}
        >
          <Trash2 className="h-4 w-4" />
          <span>{confirmClear ? 'Confirm Clear' : 'Clear History'}</span>
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="divide-y">
          {sortedSubmissions.map((submission) => (
            <div key={submission.id} className="p-4 hover:bg-muted/10 transition-colors">
              {/* Ensure link is navigable and has accessible text */}
              <Link
                href={`/results?id=${submission.id}`}
                className="flex items-center justify-between group"
                aria-label={`View results for ${submission.fileName || 'submission'} from ${formatDate(submission.date)}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    {/* Use optional chaining and provide fallback text */}
                    <p className="font-medium">{submission.fileName || 'Unnamed Submission'}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(submission.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1 text-sm" title={`Status: ${submission.status || 'Pending'}`}>
                    {getStatusIcon(submission.status)}
                    <span className="hidden sm:inline capitalize">
                      {submission.status || 'Pending'}
                    </span>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground group-hover:text-primary transition-colors"
                      aria-hidden="true" // Decorative icon
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
