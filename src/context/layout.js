'use client'

import { createContext, useContext, useState, useEffect } from 'react'

// Create context
const AppContext = createContext(undefined)

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

// Provider component
export function AppProvider({ children }) {
  const [submissions, setSubmissions] = useState([])
  const [currentSubmission, setCurrentSubmission] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  // Load submissions from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSubmissions = localStorage.getItem('paperCheckerSubmissions')
        if (savedSubmissions) {
          setSubmissions(JSON.parse(savedSubmissions))
        }
      } catch (err) {
        console.error('Error loading saved submissions:', err)
      }
    }
  }, [])

  // Save submissions to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && submissions.length > 0) {
      try {
        localStorage.setItem('paperCheckerSubmissions', JSON.stringify(submissions))
      } catch (err) {
        console.error('Error saving submissions:', err)
      }
    }
  }, [submissions])

  // Add a new submission
  const addSubmission = (submission) => {
    const newSubmission = {
      ...submission,
      id: `submission-${Date.now()}`,
      date: new Date().toISOString(),
    }
    
    setSubmissions((prev) => [newSubmission, ...prev])
    setCurrentSubmission(newSubmission)
    return newSubmission.id
  }

  // Get a submission by ID
  const getSubmission = (id) => {
    return submissions.find((sub) => sub.id === id) || null
  }

  // Clear submissions history
  const clearHistory = () => {
    setSubmissions([])
    localStorage.removeItem('paperCheckerSubmissions')
  }

  // Update the current submission with analysis results
  const updateSubmissionResults = (id, results) => {
    setSubmissions((prev) => 
      prev.map((sub) => 
        sub.id === id ? { ...sub, results, status: 'completed' } : sub
      )
    )
    
    if (currentSubmission?.id === id) {
      setCurrentSubmission((prev) => ({ ...prev, results, status: 'completed' }))
    }
  }

  // Context value
  const value = {
    submissions,
    currentSubmission,
    isProcessing,
    error,
    setIsProcessing,
    setError,
    addSubmission,
    getSubmission,
    clearHistory,
    updateSubmissionResults,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
