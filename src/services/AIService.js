// File Path: src/services/AIService.js
// Refactored for single OpenAI call with improved prompt example

import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Safe console logging
const safeLog = (prefix, message) => {
  try {
    const logMessage = typeof message === 'object' ? JSON.stringify(message).substring(0, 300) + '...' : message;
    console.log(`[AIService] ${prefix}: ${logMessage}`);
  } catch (error) {
    console.log(`[AIService] Error logging ${prefix}: ${error.message}`);
  }
};

// --- Rule Loading ---
const loadRules = () => {
  let paragraphRules = { rules: [] }; // Default empty
  let documentRules = { rules: [] }; // Default empty
  try {
    const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
    if (fs.existsSync(paragraphRulesPath)) {
        paragraphRules = JSON.parse(fs.readFileSync(paragraphRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${paragraphRules.rules.length} paragraph rules from file.`);
    } else {
        console.warn('[AIService] paragraph-rules.json not found, using default empty rules.');
    }

    const documentRulesPath = path.join(process.cwd(), 'src', 'document-rules.json');
     if (fs.existsSync(documentRulesPath)) {
        documentRules = JSON.parse(fs.readFileSync(documentRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${documentRules.rules.length} document rules from file.`);
     } else {
         console.warn('[AIService] document-rules.json not found, using default empty rules.');
     }
  } catch (error) {
    console.error('[AIService] Critical error loading rules JSON files:', error);
    // Return defaults on critical error
     paragraphRules = { rules: [] };
     documentRules = { rules: [] };
     safeLog('loadRules', 'Falling back to empty rules due to critical error.');
  }
  return { paragraphRules, documentRules };
};


// --- Main Analysis Function (Refactored) ---
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  console.log('[AIService] Starting single-call analysis with improved prompt...'); // Updated log message
  const serviceStartTime = Date.now();

  try {
    safeLog('input-raw-text', { textLength: rawText?.length || 0 });

    // --- Basic Input Validation ---
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
        console.error('[AIService] Error: Input text is empty or invalid.');
        return {
            analysisError: 'Input document text is empty or invalid.',
            title: "Analysis Failed (Empty Input)",
             abstract: { text: "", summary: "", issues: [] },
             documentAssessment: {},
             overallRecommendations: [],
             statistics: { critical: 0, major: 0, minor: 0 },
             sections: []
        };
    }

    // --- Environment Check ---
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API Key not configured");
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o'; // Ensure this model supports large context/JSON mode
    console.log(`[AIService] Using OpenAI model: ${model}`);

    // --- Load Rules ---
    const { paragraphRules, documentRules } = loadRules();
    if (paragraphRules.rules.length === 0 || documentRules.rules.length === 0) {
       console.warn('[AIService] Warning: One or both rule sets are empty. Analysis quality may be reduced.');
       // Consider if you want to throw an error or proceed with limited analysis
    }

    // --- Prepare Rule Prompts ---
    const paragraphRulesPrompt = paragraphRules.rules.map(rule => `
### Paragraph Rule ${rule.id}: ${rule.title}
${rule.fullText}
**Checkpoints:**
${rule.checkpoints.map(cp => `- ${cp.description}`).join('\n')}
`).join('\n');

    const documentRulesPrompt = documentRules.rules.map(rule => `
### Document Rule ${rule.id}: ${rule.title}
${rule.fullText}
**Checkpoints:**
${rule.checkpoints.map(cp => `- ${cp.description}`).join('\n')}
`).join('\n');

    // --- Construct the Consolidated Prompt ---
    // Truncate input text if it exceeds the character limit (e.g., 100k)
    const MAX_CHARS = 100000; // Defined in constants.js
    const truncatedText = rawText.substring(0, MAX_CHARS);
    if (rawText.length > MAX_CHARS) {
       console.warn(`[AIService] Input text truncated from ${rawText.length} to ${MAX_CHARS} characters.`);
    }

    // --- ***** MODIFIED PROMPT START ***** ---
    const fullPrompt = `
You are an expert scientific writing analyzer. Analyze the provided paper text based on established best practices.

**TASK:**
Perform a comprehensive analysis of the scientific paper text below. Your analysis must include:
1.  **Structure Extraction:** Identify the paper's title, abstract, and sections (with their contained paragraphs). Extract the full text accurately.
2.  **Paragraph Evaluation:** For EACH paragraph (including the abstract), evaluate it against the PARAGRAPH RULES provided below. Provide a concise summary, boolean evaluations for each criterion, and a list of specific issues found (with severity and recommendation).
3.  **Document Assessment:** Evaluate the OVERALL paper against the DOCUMENT RULES provided below. Provide scores (1-10), assessments, and recommendations for each category.
4.  **Major Issues & Recommendations:** Identify the most significant document-level structural problems and provide overall top recommendations for improvement.

**PAPER TEXT:**
\`\`\`
${truncatedText}
\`\`\`

**EVALUATION RULES:**

--- START PARAGRAPH RULES ---
${paragraphRulesPrompt}
--- END PARAGRAPH RULES ---

--- START DOCUMENT RULES ---
${documentRulesPrompt}
--- END DOCUMENT RULES ---

**REQUIRED OUTPUT FORMAT:**
Return ONLY a single, valid JSON object matching the structure described and exemplified below. Ensure all text content (title, abstract, paragraphs) is extracted verbatim.

**Structure Description:**
The JSON object MUST have the following top-level keys: "title", "abstract", "documentAssessment", "majorIssues", "overallRecommendations", "sections".
- "abstract" and "sections[*].paragraphs[*]" objects MUST contain "text", "summary", "evaluations" (with boolean flags), and "issues" array.
- "documentAssessment" MUST contain keys for each document-level check (e.g., "titleQuality", "abstractCompleteness") with "score", "assessment", and "recommendation".
- "majorIssues" MUST be an array of objects containing "issue", "location", "severity", "recommendation".
- "overallRecommendations" MUST be an array of strings.
- "sections" MUST be an array of objects, each with "name" and a "paragraphs" array.

**Example of CORRECT JSON Structure:**
\`\`\`json
{
  "title": "Example Paper Title",
  "abstract": {
    "text": "Full abstract text here...",
    "summary": "Abstract summary.",
    "evaluations": { "cccStructure": true, "sentenceQuality": false, "topicContinuity": true, "terminologyConsistency": true, "structuralParallelism": true },
    "issues": [ { "issue": "Sentence length varies.", "severity": "minor", "recommendation": "Break up longer sentences." } ]
  },
  "documentAssessment": {
    "titleQuality": { "score": 8, "assessment": "Good title.", "recommendation": "None." },
    "abstractCompleteness": { "score": 7, "assessment": "Mostly complete.", "recommendation": "Add broader impact." },
    "introductionStructure": { "score": 9, "assessment": "Clear structure.", "recommendation": "None." },
    "resultsOrganization": { "score": 6, "assessment": "Needs clearer flow.", "recommendation": "Reorder Fig 2 and 3." },
    "discussionQuality": { "score": 7, "assessment": "Good summary.", "recommendation": "Address limitations more." },
    "messageFocus": { "score": 8, "assessment": "Strong focus.", "recommendation": "None." },
    "topicOrganization": { "score": 7, "assessment": "Minor zig-zag.", "recommendation": "Combine related points in Discussion." }
  },
  "majorIssues": [
    {
      "issue": "Results lack clear logical progression.",
      "location": "Results Section",
      "severity": "major",
      "recommendation": "Reorganize results to build argument step-by-step."
    }
  ],
  "overallRecommendations": [
    "Improve logical flow of the Results section.",
    "Explicitly state broader impact in Abstract and Discussion."
  ],
  "sections": [
    {
      "name": "Introduction",
      "paragraphs": [
        {
          "text": "Paragraph 1 text...",
          "summary": "P1 summary.",
          "evaluations": { "cccStructure": true, "sentenceQuality": true, "topicContinuity": true, "terminologyConsistency": true, "structuralParallelism": true },
          "issues": []
        },
        {
          "text": "Paragraph 2 text...",
          "summary": "P2 summary.",
          "evaluations": { "cccStructure": false, "sentenceQuality": true, "topicContinuity": true, "terminologyConsistency": true, "structuralParallelism": false },
          "issues": [
             { "issue": "Lacks conclusion.", "severity": "major", "recommendation": "Add concluding sentence." },
             { "issue": "Parallelism inconsistent with previous paragraph.", "severity": "minor", "recommendation": "Restructure sentences for parallelism." }
          ]
        }
      ]
    },
    {
      "name": "Methods",
      "paragraphs": [
         {
          "text": "Methods paragraph 1 text...",
          "summary": "Methods P1 summary.",
          "evaluations": { "cccStructure": true, "sentenceQuality": true, "topicContinuity": true, "terminologyConsistency": true, "structuralParallelism": true },
          "issues": []
        }
      ]
    }
    // ... other sections
  ]
}
\`\`\`

**IMPORTANT:**
* Ensure the output is a single, valid JSON object.
* Extract all text content accurately.
* Apply all specified rules thoroughly.
* Provide boolean values for paragraph evaluations.
* **Adhere STRICTLY to the JSON structure described and exemplified above.** Pay close attention to the top-level keys and nesting.
`;
    // --- ***** MODIFIED PROMPT END ***** ---


    // --- Make the Single API Call ---
    safeLog('openai-request', 'Sending consolidated analysis request with improved prompt...');
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: fullPrompt }],
      response_format: { type: "json_object" }, // Requires compatible model
      temperature: 0.1, // Low temperature for structural consistency
    });

    const analysisResultRaw = response.choices[0]?.message?.content;
    if (!analysisResultRaw) {
      throw new Error("OpenAI response content is empty or missing.");
    }
    safeLog('openai-response-raw', analysisResultRaw);


    // --- Parse and Process Results ---
    let analysisResult;
     try {
         analysisResult = JSON.parse(analysisResultRaw);
     } catch (parseError) {
         console.error("[AIService] Failed to parse OpenAI JSON response:", parseError);
         throw new Error(`Failed to parse analysis results from AI. Raw response: ${analysisResultRaw.substring(0, 500)}...`);
     }

     // --- KEEP THE FLEXIBLE PARSING LOGIC AS A FALLBACK ---
     // Still useful if the AI slightly deviates despite the example.
     const docAssessment = analysisResult.documentAssessment || {};
     const majorIssues = analysisResult.majorIssues // Check top-level first
         || (typeof docAssessment === 'object' ? docAssessment.majorIssues : undefined) // Check nested
         || []; // Default
     const overallRecommendations = analysisResult.overallRecommendations // Check top-level first
         || (typeof docAssessment === 'object' ? docAssessment.overallRecommendations : undefined) // Check nested
         || []; // Default
     const sections = analysisResult.sections // Check top-level first
         || (typeof docAssessment === 'object' ? docAssessment.sections : undefined) // Check nested
         || []; // Default


    // --- Calculate Statistics (Post-Processing) ---
    let criticalCount = 0, majorCount = 0, minorCount = 0;
    const countIssues = (issues) => {
        if (Array.isArray(issues)) {
            issues.forEach(issue => {
                if (issue && issue.severity) {
                    switch (issue.severity) {
                        case 'critical': criticalCount++; break;
                        case 'major': majorCount++; break;
                        case 'minor': minorCount++; break;
                    }
                }
            });
        }
    };
    // Count issues using the potentially corrected arrays
    if (analysisResult.abstract) { countIssues(analysisResult.abstract.issues); }
    if (majorIssues) {
        majorIssues.forEach(issue => {
            if (issue.severity === 'critical') criticalCount++;
            if (issue.severity === 'major') majorCount++;
        });
    }
     if (Array.isArray(sections)) {
        sections.forEach(section => {
            if (Array.isArray(section.paragraphs)) {
                section.paragraphs.forEach(para => {
                    countIssues(para.issues);
                });
            }
        });
     }


    // --- Construct Final Output ---
    const finalResults = {
      title: analysisResult.title || "Title Not Found",
      abstract: analysisResult.abstract || { text: "", summary: "", evaluations: {}, issues: [] },
      // Explicitly list expected assessment keys to build the object correctly
      documentAssessment: {
          titleQuality: docAssessment.titleQuality,
          abstractCompleteness: docAssessment.abstractCompleteness,
          introductionStructure: docAssessment.introductionStructure,
          resultsOrganization: docAssessment.resultsOrganization,
          discussionQuality: docAssessment.discussionQuality,
          messageFocus: docAssessment.messageFocus,
          topicOrganization: docAssessment.topicOrganization,
          // Add other expected assessment keys here if needed
      },
      majorIssues: majorIssues, // Use potentially corrected array
      overallRecommendations: overallRecommendations, // Use potentially corrected array
      statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
      sections: sections, // Use potentially corrected array
    };

     // Final validation to ensure sections array was found
     if (!Array.isArray(finalResults.sections)) {
         console.error("[AIService] Error: Could not locate the 'sections' array in the AI response, even with fallback checks.");
         throw new Error("Failed to extract 'sections' array from the AI response structure.");
     }

    safeLog('final-results-structure', {
      title: finalResults.title?.substring(0, 50) + '...',
      abstractIssues: finalResults.abstract?.issues?.length || 0,
      sections: finalResults.sections?.length || 0,
      assessmentKeys: Object.keys(finalResults.documentAssessment).length,
      recommendations: finalResults.overallRecommendations?.length || 0,
      statistics: finalResults.statistics
    });
    console.log(`[AIService] Single-call analysis completed in ${Date.now() - serviceStartTime}ms`);

    return finalResults;

  } catch (error) {
    console.error('[AIService] Critical error during single-call analysis:', error);
     // Return structured error response
     return {
      analysisError: `Failed to complete analysis: ${error.message}`,
      title: "Analysis Failed",
      abstract: { text: rawText?.substring(0, 200) + '...' || "", summary: "Analysis failed.", evaluations: {}, issues: [] },
      documentAssessment: {},
      majorIssues: [],
      overallRecommendations: ["Analysis could not be completed due to an error."],
      statistics: { critical: 0, major: 0, minor: 0 },
      sections: []
    };
  }
}
