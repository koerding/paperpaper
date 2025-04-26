// File Path: src/context/AppContext.jsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(undefined)

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

export function AppProvider({ children }) {
  // Initialize state with empty array or function returning empty array
  const [submissions, setSubmissions] = useState(() => {
      console.log("[AppContext] Initializing submissions state.");
      return []; // Initialize empty, load from storage in useEffect
  });
  const [currentSubmission, setCurrentSubmission] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  // Load submissions from localStorage *only after component mounts*
  useEffect(() => {
    console.log("[AppContext] useEffect Mount: Attempting to load submissions from localStorage.");
    let savedSubmissionsData = null;
    try {
      // Ensure localStorage is available (redundant check with useEffect, but safe)
      if (typeof window !== 'undefined' && window.localStorage) {
        savedSubmissionsData = localStorage.getItem('paperCheckerSubmissions');
        if (savedSubmissionsData) {
          console.log("[AppContext] Found saved submissions in localStorage.");
          const parsedSubmissions = JSON.parse(savedSubmissionsData);
          if (Array.isArray(parsedSubmissions)) {
            setSubmissions(parsedSubmissions); // Update state with loaded data
            console.log("[AppContext] Successfully loaded and set submissions from storage.");
          } else {
            console.warn("[AppContext] Invalid data found in localStorage, expected array. Resetting.");
            localStorage.removeItem('paperCheckerSubmissions');
            setSubmissions([]); // Ensure state is array
          }
        } else {
          console.log("[AppContext] No saved submissions found in localStorage.");
          setSubmissions([]); // Ensure state is array
        }
      }
    } catch (err) {
      console.error('[AppContext] Error loading/parsing saved submissions in useEffect:', err);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('paperCheckerSubmissions');
      }
      setSubmissions([]); // Reset to empty array on error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Save submissions to localStorage when they change
  useEffect(() => {
    // Only save if submissions is actually an array (it should be now)
    if (typeof window !== 'undefined' && window.localStorage && Array.isArray(submissions)) {
        console.log("[AppContext] useEffect Update: Submissions changed, saving to localStorage.");
      try {
        localStorage.setItem('paperCheckerSubmissions', JSON.stringify(submissions));
        console.log(`[AppContext] Successfully saved ${submissions.length} submissions.`);
      } catch (err) {
        console.error('[AppContext] Error saving submissions to localStorage:', err);
        setError("Could not save submission history. Storage might be full.");
      }
    }
  }, [submissions]) // Run whenever the submissions array changes

  // --- Rest of the functions (addSubmission, getSubmission, etc.) remain the same ---
   const addSubmission = (submission) => {
     console.log("[AppContext] Adding new submission:", submission.fileName);
     const newSubmission = { ...submission, id: `submission-${Date.now()}`, date: new Date().toISOString(), status: submission.status || 'processing', results: null };
     setSubmissions((prevSubmissions) => [newSubmission, ...(Array.isArray(prevSubmissions) ? prevSubmissions : [])]);
     setCurrentSubmission(newSubmission);
     console.log("[AppContext] New submission added with ID:", newSubmission.id);
     return newSubmission.id;
   }
   const getSubmission = (id) => {
     console.log("[AppContext] Getting submission by ID:", id);
     if (!Array.isArray(submissions)) return null;
     const found = submissions.find((sub) => sub && sub.id === id);
     console.log(found ? "[AppContext] Submission found." : "[AppContext] Submission not found.");
     return found || null;
   }
   const clearHistory = () => {
     console.log("[AppContext] Clearing submission history.");
     setSubmissions([]);
     setCurrentSubmission(null);
     // localStorage removal handled by useEffect on submissions change
   }
    const updateSubmissionResults = (id, resultsUpdate) => {
      console.log(`[AppContext] Updating submission ID ${id} with:`, resultsUpdate);
      const updateData = typeof resultsUpdate === 'object' && resultsUpdate !== null ? resultsUpdate : {};
      setSubmissions((prevSubmissions) => (Array.isArray(prevSubmissions) ? prevSubmissions : []).map((sub) => (sub && sub.id === id ? { ...sub, ...updateData } : sub)));
      setCurrentSubmission((prevCurrent) => (prevCurrent && prevCurrent.id === id ? { ...prevCurrent, ...updateData } : prevCurrent));
    }
    const handleSetError = (errorMessage) => {
        console.log("[AppContext] Setting error state:", errorMessage);
        setError(errorMessage);
    };

  const value = { submissions, currentSubmission, isProcessing, error, setIsProcessing, setError: handleSetError, addSubmission, getSubmission, clearHistory, updateSubmissionResults, }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
