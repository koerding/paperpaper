'use client'

import { useState } from 'react'

export default function DebugHelper() {
  const [debugData, setDebugData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runApiTest = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/debug')
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      setDebugData(data)
    } catch (err) {
      console.error('Debug test failed:', err)
      setError(err.message || 'Failed to run API test')
    } finally {
      setLoading(false)
    }
  }

  const runTestEndpoint = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/test')
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      setDebugData(data)
    } catch (err) {
      console.error('Test endpoint failed:', err)
      setError(err.message || 'Failed to access test endpoint')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border p-4 rounded-md bg-gray-50 mt-8">
      <h3 className="text-lg font-medium mb-4">API Debugging Tools</h3>
      
      <div className="flex space-x-2 mb-4">
        <button
          onClick={runApiTest}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Debug API'}
        </button>
        
        <button
          onClick={runTestEndpoint}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test API Endpoint'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-md mb-4">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {debugData && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Debug Results:</h4>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-80">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
