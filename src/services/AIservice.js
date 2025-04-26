// File Path: src/services/AIservice.js
import { default as OpenAI } from 'openai';
import fs from 'fs'; // To read rules.json
import path from 'path'; // To construct path to rules.json
// Assuming parseStructure uses ProcessingService which might call OpenAI for structure
import { extractDocumentStructure as parseStructure } from './ProcessingService.js';

// --- Load Rules ---
let paperRules = null;
try {
    // Construct path relative to the current file's directory
    const rulesPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../rules.json');
    console.log(`[AIService] Attempting to load rules from: ${rulesPath}`);
    const rulesRaw = fs.readFileSync(rulesPath, 'utf-8');
    paperRules = JSON.parse(rulesRaw);
    console.log("[AIService] Successfully loaded rules.json");
} catch (err) {
    console.error("[AIService] CRITICAL ERROR: Failed to load or parse rules.json.", err);
    // If rules are essential, throw an error or handle appropriately
    // throw new Error("Could not load analysis rules.");
    paperRules = { rules: [] }; // Use empty rules as fallback? Decide strategy.
}

// Helper Function to create prompts dynamically using rules.json
function createParagraphAnalysisPrompt(sectionChunkText, rules) {
    // Extract relevant paragraph-level rules (e.g., Rule 3B, 4B)
    const relevantRules = rules?.rules?.filter(r => ['3B', '4B', '2B'].includes(r.id)) || []; // Add relevant rule IDs
    const ruleDescriptions = relevantRules.map(r => `- ${r.title}: ${r.fullText}\nCheckpoints:\n${r.checkpoints.map(cp => `  - ${cp.description}`).join('\n')}`).join('\n\n');

    // Construct the prompt
    const prompt = `
Analyze the following text chunk from a scientific paper section paragraph by paragraph.
For EACH paragraph, evaluate it based on these rules:
${ruleDescriptions}

Return your analysis as a valid JSON object STRICTLY following this structure for the entire chunk:
{
  "paragraphs": [
    {
      "text_preview": "First ~50 chars of paragraph...", // For identification
      "summary": "1-2 sentence summary of paragraph content",
      "evaluations": { // Boolean evaluations based on rules
         "cccStructure": boolean, // Rule 3B
         "sentenceQuality": boolean, // Rule 2B (length/complexity)
         "topicContinuity": boolean, // Rule 3B/4A
         "terminologyConsistency": boolean, // Rule 4B
         "structuralParallelism": boolean // Rule 4B
         // Add more boolean flags if needed based on rules.json
      },
      "issues": [ // List ONLY issues found
        {
          "issue": "Specific description of the issue found based on rules",
          "rule_id": "ID of the rule violated (e.g., '3B')",
          "severity": "critical | major | minor", // Assign severity based on rule importance/deviation
          "recommendation": "Specific suggestion for improvement"
        }
      ]
    }
    // Include one object for EACH paragraph in the provided text chunk
  ]
}

Text Chunk to Analyze:
--- START TEXT CHUNK ---
${sectionChunkText}
--- END TEXT CHUNK ---

Ensure the output is ONLY the JSON object, without any introductory text or explanations.
Evaluate each paragraph independently based on the rules.
`;
    return [{ role: "user", content: prompt }];
}

function createDocumentAnalysisPrompt(title, abstractText, paragraphAnalysisResults, rules) {
    // Extract relevant document-level rules (e.g., Rule 1, 5, 6, 7A, 8A, 8B, 8C)
    const relevantRules = rules?.rules?.filter(r => ['1', '5', '6', '7A', '8A', '8B', '8C'].includes(r.id)) || []; // Add relevant rule IDs
    const ruleDescriptions = relevantRules.map(r => `- ${r.title}: ${r.fullText}\nCheckpoints:\n${r.checkpoints.map(cp => `  - ${cp.description}`).join('\n')}`).join('\n\n');

    // Simple summary of paragraph issues for context (can be enhanced)
    let issueSummary = "No major paragraph issues detected.";
    let criticalCount = 0;
    let majorCount = 0;
    let minorCount = 0;
    paragraphAnalysisResults?.sections?.forEach(sec => {
        sec.paragraphs?.forEach(p => {
            p.issues?.forEach(iss => {
                if (iss.severity === 'critical') criticalCount++;
                if (iss.severity === 'major') majorCount++;
                if (iss.severity === 'minor') minorCount++;
            });
        });
    });
     if (criticalCount > 0 || majorCount > 0 || minorCount > 0) {
         issueSummary = `Paragraph analysis found: Critical: ${criticalCount}, Major: ${majorCount}, Minor: ${minorCount} issues.`;
     }


    const prompt = `
Analyze the overall structure and flow of a scientific paper based on its title, abstract, and a summary of paragraph-level issues, using the following rules:
${ruleDescriptions}

Evaluate the paper based ONLY on the provided title, abstract, and issue summary.

Return your analysis as a valid JSON object STRICTLY following this structure:
{
  "documentAssessment": {
    "titleQuality": { "score": 1-10 rating, "assessment": "Evaluation text based on Rule 1", "recommendation": "Suggestion if needed" },
    "abstractCompleteness": { "score": 1-10 rating, "assessment": "Evaluation text based on Rule 5", "recommendation": "Suggestion if needed" },
    "introductionEffectiveness": { "score": 1-10 rating, "assessment": "Evaluation text based on Rule 6", "recommendation": "Suggestion if needed" },
    "resultsOrganization": { "score": 1-10 rating, "assessment": "Evaluation text based on Rule 7A", "recommendation": "Suggestion if needed" },
    "discussionQuality": { "score": 1-10 rating, "assessment": "Evaluation text based on Rules 8A, 8B, 8C", "recommendation": "Suggestion if needed" },
    "singleMessageFocus": { "score": 1-10 rating, "assessment": "Evaluation text based on Rule 1", "recommendation": "Suggestion if needed" },
    "topicOrganization": { "score": 1-10 rating, "assessment": "Evaluation text based on Rule 4A", "recommendation": "Suggestion if needed" }
    // Add more assessments corresponding to rules.json document-level checkpoints if needed
  },
  "overallRecommendations": [ // 3-5 most important actionable recommendations based on the assessments
    "Top suggestion 1",
    "Top suggestion 2",
    "Top suggestion 3"
  ],
   "statistics": { // Add counts based on the documentAssessment scores (or refine based on paragraph issues)
      "critical": 0, // Estimate based on scores < 4? Or sum from paragraph issues?
      "major": 0, // Estimate based on scores 4-6?
      "minor": 0 // Estimate based on scores 7-8?
    }
}

Paper Information:
Title: ${title || 'Not Provided'}
Abstract: ${abstractText || 'Not Provided'}
Paragraph Issue Summary: ${issueSummary}

Provide ONLY the JSON object as output. Base scores and assessments on how well the title/abstract seem to align with the rules provided. Provide actionable recommendations. Estimate statistics based on overall assessment scores or paragraph issues.
`;
    return [{ role: "user", content: prompt }];
}


// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document, rawText) {
    console.log('[AIService] >>>>>>>>>> Starting REAL analyzeDocumentStructure...');
    const serviceStartTime = Date.now();
    try {
        if (!paperRules) {
             throw new Error("Analysis rules could not be loaded.");
        }

        let structuredDoc = document;

        // Step 1: Get Base Structure (Uses ProcessingService - might call AI itself)
        if (!structuredDoc || !structuredDoc.sections || structuredDoc.sections.length === 0) {
            if (!rawText) throw new Error("Analysis requires either document structure or raw text.");
            console.log('[AIService] Obtaining base document structure via ProcessingService...');
            structuredDoc = await parseStructure(rawText);
            console.log('[AIService] Base structure obtained.');
        } else {
            console.log('[AIService] Using provided pre-parsed document structure.');
        }

        if (!structuredDoc || typeof structuredDoc !== 'object' || structuredDoc === null) {
            throw new Error("Failed to obtain valid document structure.");
        }
        console.log(`[AIService] Base structure ready. Title: ${structuredDoc.title?.substring(0, 50)}... Sections: ${structuredDoc.sections?.length || 0}`);

        // Step 2: Initialize OpenAI Client
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key not configured for AIService.");
        }
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = process.env.OPENAI_MODEL || 'gpt-4o'; // Or your preferred model

        // Step 3: Perform Detailed Paragraph Analysis (Section by Section)
        console.log('[AIService] Starting detailed paragraph analysis...');
        const analyzedSections = [];
        // Use Promise.all for potentially parallel section analysis (respect API rate limits)
        for (const section of structuredDoc.sections || []) {
             console.log(`[AIService] Analyzing paragraphs for section: "${section.name}"`);
             // Combine paragraphs into a chunk for analysis (add separators)
             const sectionTextChunk = section.paragraphs?.map(p => p.text).join("\n\n---\n\n") || "";

             if (!sectionTextChunk.trim()) {
                  console.log(`[AIService] Skipping empty section: "${section.name}"`);
                  analyzedSections.push({ name: section.name, paragraphs: [] }); // Keep section structure
                  continue;
             }

             // TODO: Implement proper chunking if sectionTextChunk exceeds token limits

             const paragraphPromptMessages = createParagraphAnalysisPrompt(sectionTextChunk, paperRules);
             try {
                 const response = await openai.chat.completions.create({
                     model: model,
                     messages: paragraphPromptMessages,
                     response_format: { type: "json_object" },
                     temperature: 0.2 // Lower temperature for more deterministic JSON output
                 });
                 const resultText = response.choices[0]?.message?.content;
                 console.log(`[AIService] Raw paragraph analysis response for section "${section.name}":`, resultText?.substring(0,100) + '...');
                 const sectionResult = JSON.parse(resultText);
                 // TODO: Add validation for sectionResult structure
                 analyzedSections.push({
                     name: section.name,
                     // Ensure the result has a paragraphs array
                     paragraphs: sectionResult?.paragraphs || []
                 });
             } catch (error) {
                  console.error(`[AIService] Error analyzing paragraphs for section "${section.name}":`, error);
                  // Add section with an error marker or skip? For now, add empty.
                  analyzedSections.push({ name: section.name, paragraphs: [], error: `Failed to analyze paragraphs: ${error.message}` });
             }
        }
        console.log('[AIService] Detailed paragraph analysis complete.');
        // Structure containing results from paragraph analysis calls
        const paragraphAnalysisResults = { sections: analyzedSections };

        // Step 4: Perform Document-Level Analysis
        console.log('[AIService] Starting document-level analysis...');
        const documentPromptMessages = createDocumentAnalysisPrompt(
            structuredDoc.title,
            structuredDoc.abstract?.text, // Pass abstract text if available
            paragraphAnalysisResults, // Pass paragraph results for context
            paperRules
        );
        let documentAnalysis = {}; // Default empty object
        try {
            const response = await openai.chat.completions.create({
                model: model, // Maybe use a more powerful model if needed?
                messages: documentPromptMessages,
                response_format: { type: "json_object" },
                temperature: 0.3
            });
             const resultText = response.choices[0]?.message?.content;
             console.log(`[AIService] Raw document analysis response:`, resultText?.substring(0,100) + '...');
            documentAnalysis = JSON.parse(resultText);
            // TODO: Validate documentAnalysis structure
        } catch (error) {
             console.error(`[AIService] Error during document-level analysis:`, error);
             // Use default/empty analysis or throw error?
             documentAnalysis = { error: `Failed document analysis: ${error.message}` };
        }
        console.log('[AIService] Document-level analysis complete.');


        // Step 5: Merge Results
        console.log('[AIService] Merging final results...');
        // Combine structure, paragraph results, and document results
        const finalResults = {
            title: structuredDoc.title || "Title Not Found",
            abstract: structuredDoc.abstract || { text: "", summary: "", issues: [] }, // Use parsed abstract if available
            documentAssessment: documentAnalysis?.documentAssessment || {},
            overallRecommendations: documentAnalysis?.overallRecommendations || [],
            statistics: documentAnalysis?.statistics || { critical: 0, major: 0, minor: 0 }, // Calculate based on issues below?
            // Combine prioritized issues from document level and critical/major from paragraphs
            prioritizedIssues: combinePrioritizedIssues(documentAnalysis?.majorIssues, paragraphAnalysisResults),
            sections: paragraphAnalysisResults.sections || [], // Use the detailed paragraph analysis
            // Add error marker if document analysis failed
            ...(documentAnalysis?.error && { analysisError: documentAnalysis.error })
        };

        // Recalculate statistics based on actual issues found
        finalResults.statistics = calculateStatistics(finalResults);


        const serviceEndTime = Date.now();
        console.log(`[AIService] <<<<<<<<<< analyzeDocumentStructure finished. Duration: ${serviceEndTime - serviceStartTime}ms`);
        console.log("[AIService] Final merged results structure:", {title: finalResults.title, hasAbstract: !!finalResults.abstract, sectionCount: finalResults.sections?.length });


        return finalResults;

    } catch (error) {
        const serviceEndTime = Date.now();
        console.error(`[AIService] <<<<<<<<<< Error in main analyzeDocumentStructure (Duration: ${serviceEndTime - serviceStartTime}ms):`, error);
        // Return an error structure that the API route can handle
        return {
            analysisError: `Failed to complete analysis: ${error.message}`,
            title: structuredDoc?.title || "Analysis Failed",
            abstract: structuredDoc?.abstract || null,
            documentAssessment: {},
            overallRecommendations: [],
            statistics: { critical: 0, major: 0, minor: 0 },
            prioritizedIssues: [],
            sections: []
        };
    }
}

// Helper function to combine issues for prioritization
function combinePrioritizedIssues(docIssues = [], paragraphResults) {
    let combined = [...docIssues];
    let criticalCount = 0;
    let majorCount = 0;

    paragraphResults?.sections?.forEach((section, sIdx) => {
        section.paragraphs?.forEach((para, pIdx) => {
             para.issues?.forEach(issue => {
                 // Example: Add critical/major paragraph issues to the main list
                 if (issue.severity === 'critical' || issue.severity === 'major') {
                     combined.push({
                         ...issue,
                         location: `Section "${section.name || sIdx+1}", Paragraph ${pIdx+1} (starting: "${para.text_preview || 'N/A'}")`
                     });
                 }
                 // Count severities for statistics (might be better done in final merge)
                 if (issue.severity === 'critical') criticalCount++;
                 if (issue.severity === 'major') majorCount++;
             });
        });
    });

     // Sort by severity (e.g., critical first) - basic sort
     combined.sort((a, b) => {
         const severityOrder = { critical: 0, major: 1, minor: 2 };
         return (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
     });

    // Limit the number? Maybe top 10-15?
    // return combined.slice(0, 15);
    return combined; // Return all for now
}

// Helper function to calculate final statistics
function calculateStatistics(finalResults) {
     let stats = { critical: 0, major: 0, minor: 0 };
     // Count from prioritized issues
      finalResults?.prioritizedIssues?.forEach(issue => {
         if (issue.severity === 'critical') stats.critical++;
         else if (issue.severity === 'major') stats.major++;
         else if (issue.severity === 'minor') stats.minor++;
     });
      // Also count issues in sections that weren't prioritized? Optional.
      // finalResults?.sections?.forEach(section => {
      //     section.paragraphs?.forEach(para => {
      //         para.issues?.forEach(issue => {
      //             // Avoid double counting if already in prioritizedIssues
      //             if (!finalResults.prioritizedIssues.some(pIssue => pIssue === issue)) {
      //                 if (issue.severity === 'minor') stats.minor++;
      //             }
      //         });
      //     });
      // });
     return stats;
}
