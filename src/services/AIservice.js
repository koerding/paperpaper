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

// DEBUG HELPER: Write content to debug file
const writeDebugFile = async (prefix, content) => {
    try {
        // Create debug directory if it doesn't exist
        const debugDir = path.join(process.cwd(), 'debug_logs');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        
        // Write to timestamped debug file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(debugDir, `${prefix}-${timestamp}.json`);
        
        // Format content based on type
        let formattedContent = content;
        if (typeof content === 'object') {
            formattedContent = JSON.stringify(content, null, 2);
        }
        
        fs.writeFileSync(filename, formattedContent);
        console.log(`[AIService Debug] Wrote ${prefix} to ${filename}`);
        return filename;
    } catch (err) {
        console.error(`[AIService Debug] Failed to write debug file for ${prefix}:`, err);
        return null;
    }
};

// Updated paragraph analysis prompt for AIService.js
function createParagraphAnalysisPrompt(documentStructure) {
  const prompt = `
  Analyze this scientific paper, focusing ONLY on meaningful content paragraphs. 
  
  IMPORTANT FILTERING INSTRUCTIONS:
  - Only analyze complete paragraphs that contain scientific content
  - Skip titles, author information, section headers, and figure captions
  - Skip references, acknowledgments, data availability statements, and conflict of interest sections
  - Skip isolated sentences, bullet points, and metadata
  - Skip equations and mathematical formulas presented on their own lines
  
  For each CONTENT paragraph you identify, evaluate:
  
  1. Context-Content-Conclusion (CCC) structure:
     - First sentence should provide context or introduce the topic
     - Middle sentences should provide evidence, data, or elaboration
     - Final sentence should offer a conclusion, summarize, or transition
  
  2. Sentence quality:
     - Average sentence length under 25 words
     - No sentence exceeding 40 words
     - Appropriate readability for scientific literature
  
  3. Topic continuity:
     - Single focused topic per paragraph
     - Logical progression of ideas
     - No sudden shifts in subject matter
  
  4. Terminology consistency:
     - Same terms used for same concepts
     - No synonyms that could suggest different meanings
     - Consistent use of technical terms
  
  5. Structural parallelism:
     - Similar concepts presented with similar grammatical structures
     - Consistent patterns in lists or series
     - Similar points follow consistent structural patterns
  
  Return your analysis as a valid JSON object with this structure:
  {
    "paragraphs": [
      {
        "text_preview": "First ~50 chars of paragraph...",
        "summary": "1-2 sentence summary of paragraph content",
        "evaluations": {
          "cccStructure": boolean,
          "sentenceQuality": boolean,
          "topicContinuity": boolean,
          "terminologyConsistency": boolean,
          "structuralParallelism": boolean
        },
        "issues": [
          {
            "issue": "Specific description of the issue found",
            "rule_id": "ID of the rule violated (e.g., 'cccStructure')",
            "severity": "critical|major|minor",
            "recommendation": "Specific suggestion for improvement"
          }
        ]
      }
    ]
  }
  
  Be rigorous in your assessment. If a paragraph fails ANY of the criteria, set the corresponding boolean to false and add a detailed issue description with a specific recommendation.

  Severity guidelines:
  - critical: Makes the paragraph difficult to understand or misleading
  - major: Significantly weakens the paragraph's effectiveness
  - minor: Reduces clarity or precision but doesn't impede understanding

  Paper structure:
  
  Title: ${documentStructure['title']}
  
  Abstract: ${documentStructure['abstract']}
  
  ${generateSectionsPararaphsText(documentStructure['sections'])}
  `;
  
  return prompt;
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
        // ENHANCED DEBUGGING - Save input text
        await writeDebugFile('00-input-raw-text', rawText);
        
        if (!paperRules) {
             throw new Error("Analysis rules could not be loaded.");
        }

        let structuredDoc = document;

        // Step 1: Get Base Structure (Uses ProcessingService - might call AI itself)
        if (!structuredDoc || !structuredDoc.sections || structuredDoc.sections.length === 0) {
            if (!rawText) throw new Error("Analysis requires either document structure or raw text.");
            console.log('[AIService] Obtaining base document structure via ProcessingService...');
            structuredDoc = await parseStructure(rawText);
            // DEBUG - Save processed structure
            await writeDebugFile('01-parsed-structure', structuredDoc);
            console.log('[AIService] Base structure obtained.');
        } else {
            console.log('[AIService] Using provided pre-parsed document structure.');
            await writeDebugFile('01-provided-structure', structuredDoc);
        }

        if (!structuredDoc || typeof structuredDoc !== 'object' || structuredDoc === null) {
            throw new Error("Failed to obtain valid document structure.");
        }
        console.log(`[AIService] Base structure ready. Title: ${structuredDoc.title?.substring(0, 50)}... Sections: ${structuredDoc.sections?.length || 0}`);
        console.log(`[AIService DEBUG] Full Document Structure: ${JSON.stringify(structuredDoc, null, 2)}`);

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

             // DEBUG - Write section text chunk
             await writeDebugFile(`02-section-text-${section.name || 'unnamed'}`, sectionTextChunk);

             // TODO: Implement proper chunking if sectionTextChunk exceeds token limits

             const paragraphPromptMessages = createParagraphAnalysisPrompt(sectionTextChunk, paperRules);
             // DEBUG - Write prompt
             await writeDebugFile(`03-paragraph-prompt-${section.name || 'unnamed'}`, paragraphPromptMessages);
             
             try {
                 const response = await openai.chat.completions.create({
                     model: model,
                     messages: paragraphPromptMessages,
                     response_format: { type: "json_object" },
                     temperature: 0.2 // Lower temperature for more deterministic JSON output
                 });
                 const resultText = response.choices[0]?.message?.content;
                 console.log(`[AIService] Raw paragraph analysis response for section "${section.name}":`, resultText?.substring(0,100) + '...');
                 
                 // DEBUG - Write AI response
                 await writeDebugFile(`04-paragraph-response-${section.name || 'unnamed'}`, resultText);
                 
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
        
        // DEBUG - Write paragraph analysis results
        await writeDebugFile('05-combined-paragraph-analysis', paragraphAnalysisResults);

        // Step 4: Perform Document-Level Analysis
        console.log('[AIService] Starting document-level analysis...');
        const documentPromptMessages = createDocumentAnalysisPrompt(
            structuredDoc.title,
            structuredDoc.abstract?.text, // Pass abstract text if available
            paragraphAnalysisResults, // Pass paragraph results for context
            paperRules
        );
        
        // DEBUG - Write document prompt
        await writeDebugFile('06-document-level-prompt', documentPromptMessages);
        
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
             
             // DEBUG - Write document response
             await writeDebugFile('07-document-level-response', resultText);
             
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

        // DEBUG - Write final merged results
        await writeDebugFile('08-final-merged-results', finalResults);

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
