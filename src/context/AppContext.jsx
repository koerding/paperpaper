// File Path: src/context/AppContext.jsx
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
    console.log("[AppContext] Attempting to load submissions from localStorage.");
    let savedSubmissionsData = null;
    try {
        // Ensure localStorage is available (might not be in SSR initial render)
        if (typeof window !== 'undefined' && window.localStorage) {
            savedSubmissionsData = localStorage.getItem('paperCheckerSubmissions');
            if (savedSubmissionsData) {
                console.log("[AppContext] Found saved submissions in localStorage.");
                const parsedSubmissions = JSON.parse(savedSubmissionsData);
                // Basic validation: check if it's an array
                if (Array.isArray(parsedSubmissions)) {
                     setSubmissions(parsedSubmissions);
                     console.log("[AppContext] Successfully loaded and set submissions.");
                } else {
                     console.warn("[AppContext] Invalid data found in localStorage, expected an array. Resetting.");
                     localStorage.removeItem('paperCheckerSubmissions'); // Clear invalid data
                     setSubmissions([]);
                }
            } else {
                 console.log("[AppContext] No saved submissions found in localStorage.");
                 setSubmissions([]); // Initialize as empty array if nothing is saved
            }
        } else {
            console.log("[AppContext] localStorage not available, skipping load.");
             setSubmissions([]); // Initialize as empty array
        }
    } catch (err) {
      console.error('[AppContext] Error loading or parsing saved submissions:', err);
       // If parsing fails, clear the invalid item and reset state
       if (typeof window !== 'undefined' && window.localStorage) {
           localStorage.removeItem('paperCheckerSubmissions');
       }
      setSubmissions([]); // Reset to empty array on error
    }
  }, []) // Empty dependency array ensures this runs only once on mount

  // Save submissions to localStorage when they change
  useEffect(() => {
    console.log("[AppContext] Submissions state changed, attempting to save to localStorage.");
    // Ensure localStorage is available and submissions is an array
    if (typeof window !== 'undefined' && window.localStorage && Array.isArray(submissions)) {
        // Only save if there are submissions to prevent saving an empty array unnecessarily
        // or save empty array if user explicitly cleared history
         if (submissions.length >= 0) { // Save even if empty after clearHistory
             try {
                 localStorage.setItem('paperCheckerSubmissions', JSON.stringify(submissions));
                 console.log(`[AppContext] Successfully saved ${submissions.length} submissions to localStorage.`);
             } catch (err) {
                 console.error('[AppContext] Error saving submissions to localStorage:', err);
                 // Handle potential storage full errors, etc.
                 setError("Could not save submission history. Storage might be full.");
             }
         }
    } else {
         console.log("[AppContext] localStorage not available or submissions not an array, skipping save.");
    }
  }, [submissions]) // Run whenever the submissions array changes

  // Add a new submission
  const addSubmission = (submission) => {
    console.log("[AppContext] Adding new submission:", submission.fileName);
    const newSubmission = {
      ...submission,
      id: `submission-${Date.now()}`, // Use timestamp for unique ID
      date: new Date().toISOString(),
      // Ensure status is included, default to 'pending' or 'processing'
       status: submission.status || 'processing',
       results: null // Initialize results as null
    }

    // Prepend the new submission to the array
    setSubmissions((prevSubmissions) => {
        // Ensure prevSubmissions is always an array
        const currentSubmissions = Array.isArray(prevSubmissions) ? prevSubmissions : [];
        return [newSubmission, ...currentSubmissions];
    });
    setCurrentSubmission(newSubmission); // Set as the current one being processed
    console.log("[AppContext] New submission added with ID:", newSubmission.id);
    return newSubmission.id; // Return the generated ID
  }

  // Get a submission by ID
  const getSubmission = (id) => {
     console.log("[AppContext] Getting submission by ID:", id);
     // Ensure submissions is an array before searching
     if (!Array.isArray(submissions)) {
         console.error("[AppContext] Submissions is not an array, cannot get submission.");
         return null;
     }
    const found = submissions.find((sub) => sub && sub.id === id); // Add check for valid sub object
     console.log(found ? "[AppContext] Submission found." : "[AppContext] Submission not found.");
    return found || null;
  }

  // Clear submissions history
  const clearHistory = () => {
    console.log("[AppContext] Clearing submission history.");
    setSubmissions([]); // Set state to empty array
    setCurrentSubmission(null); // Clear current submission
    // localStorage removal is handled by the useEffect hook when submissions becomes []
    console.log("[AppContext] Submission history cleared.");
  }

  // Update the results and status of a specific submission
  const updateSubmissionResults = (id, resultsUpdate) => {
     console.log(`[AppContext] Updating submission ID ${id} with results/status:`, resultsUpdate);
     // Ensure resultsUpdate is an object
     const updateData = typeof resultsUpdate === 'object' && resultsUpdate !== null ? resultsUpdate : {};

    setSubmissions((prevSubmissions) => {
        // Ensure prevSubmissions is always an array
        const currentSubmissions = Array.isArray(prevSubmissions) ? prevSubmissions : [];
        return currentSubmissions.map((sub) => {
             if (sub && sub.id === id) {
                console.log(`[AppContext] Found submission ${id} to update.`);
                 // Merge existing submission data with new results/status
                 return { ...sub, ...updateData };
             }
             return sub;
         });
    });

    // Update currentSubmission if it matches the ID
    setCurrentSubmission((prevCurrent) => {
      if (prevCurrent && prevCurrent.id === id) {
        console.log(`[AppContext] Updating currentSubmission ${id}.`);
        return { ...prevCurrent, ...updateData };
      }
      return prevCurrent;
    });
  }

   // Function to set error state, clearing any previous error first
   const handleSetError = (errorMessage) => {
       console.log("[AppContext] Setting error state:", errorMessage);
       setError(errorMessage); // Directly set the new error message
   };


  // Context value includes all state and functions
  const value = {
    submissions,
    currentSubmission,
    isProcessing,
    error,
    setIsProcessing,
    setError: handleSetError, // Use the wrapped error setter
    addSubmission,
    getSubmission,
    clearHistory,
    updateSubmissionResults,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
