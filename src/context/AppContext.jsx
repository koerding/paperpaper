// Only the updateSubmissionResults function is changed in this file
const updateSubmissionResults = (id, updateData) => {
  console.log(`[AppContext] Updating submission ID ${id} with:`, 
    typeof updateData === 'object' ? 
      { 
        hasStatus: 'status' in updateData, 
        hasResults: 'results' in updateData,
        resultKeys: updateData.results ? Object.keys(updateData.results) : [] 
      } : 
      updateData
  );
  
  if (typeof updateData !== 'object' || updateData === null) {
    console.error("[AppContext] Invalid update data:", updateData);
    return;
  }
  
  // Important: Make a copy of the update data to avoid reference issues
  // Use JSON parse/stringify for deep cloning
  const update = JSON.parse(JSON.stringify(updateData));
  
  setSubmissions((prevSubmissions) => {
    if (!Array.isArray(prevSubmissions)) {
      console.error("[AppContext] prevSubmissions is not an array:", prevSubmissions);
      return [];
    }
    
    return prevSubmissions.map((sub) => {
      if (sub && sub.id === id) {
        // Create an entirely new submission object with the updates
        const updated = { ...sub, ...update };
        console.log(`[AppContext] Updated submission ${id}, has results:`, 'results' in updated);
        return updated;
      }
      return sub;
    });
  });
  
  // Also update currentSubmission if it matches
  setCurrentSubmission((prevCurrent) => {
    if (prevCurrent && prevCurrent.id === id) {
      const updated = { ...prevCurrent, ...update };
      console.log(`[AppContext] Updated currentSubmission:`, 
        { hasResults: 'results' in updated, status: updated.status }
      );
      return updated;
    }
    return prevCurrent;
  });
}
