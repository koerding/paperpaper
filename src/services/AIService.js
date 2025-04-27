// File Path: src/services/AIService.js
// Refactored for single OpenAI call

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
// (Keep the existing robust loadRules function)
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
  console.log('[AIService] Starting single-call analysis...');
  const serviceStartTime = Date.now();

  try {
    safeLog('input-raw-text', { textLength: rawText?.length || 0 });

    // --- Basic Input Validation ---
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
        console.error('[AIService] Error: Input text is empty or invalid.');
        return {
            analysisError: 'Input document text is empty or invalid.',
            title: "Analysis Failed (Empty Input)",
            // ... provide default empty structure ...
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
Return ONLY a single, valid JSON object with the following structure. Ensure all text content (title, abstract, paragraphs) is extracted verbatim.

\`\`\`json
{
  "title": "The full extracted paper title",
  "abstract": {
    "text": "The full extracted abstract text",
    "summary": "Concise summary of the abstract's content",
    "evaluations": {
      "cccStructure": boolean,
      "sentenceQuality": boolean,
      "topicContinuity": boolean,
      "terminologyConsistency": boolean,
      "structuralParallelism": boolean
    },
    "issues": [
      {
        "issue": "Description of issue found in the abstract",
        "severity": "critical | major | minor",
        "recommendation": "Specific improvement suggestion for the abstract"
      }
      // ... more issues if found
    ]
  },
  "documentAssessment": {
    "titleQuality": { "score": 1-10, "assessment": "Evaluation of title quality", "recommendation": "Suggestion" },
    "abstractCompleteness": { "score": 1-10, "assessment": "Evaluation of abstract completeness", "recommendation": "Suggestion" },
    "introductionStructure": { "score": 1-10, "assessment": "Evaluation of introduction", "recommendation": "Suggestion" },
    "resultsOrganization": { "score": 1-10, "assessment": "Evaluation of results section", "recommendation": "Suggestion" },
    "discussionQuality": { "score": 1-10, "assessment": "Evaluation of discussion section", "recommendation": "Suggestion" },
    "messageFocus": { "score": 1-10, "assessment": "Evaluation of single message focus", "recommendation": "Suggestion" },
    "topicOrganization": { "score": 1-10, "assessment": "Evaluation of topic organization (zig-zag)", "recommendation": "Suggestion" }
    // Add other document assessment keys as defined by your rules/needs
  },
   "majorIssues": [
    {
      "issue": "Description of a significant structural problem",
      "location": "General area (e.g., Introduction, Overall Flow)",
      "severity": "critical|major",
      "recommendation": "Specific suggestion for improvement"
    }
    // ... more major issues if found
  ],
  "overallRecommendations": [
    "Top priority overall suggestion 1",
    "Overall suggestion 2",
    "Overall suggestion 3"
  ],
  "sections": [
    {
      "name": "Extracted Section Name (e.g., Introduction)",
      "paragraphs": [
        {
          "text": "Full extracted text of paragraph 1",
          "summary": "Concise summary of paragraph 1's content",
          "evaluations": {
            "cccStructure": boolean,
            "sentenceQuality": boolean,
            "topicContinuity": boolean,
            "terminologyConsistency": boolean,
            "structuralParallelism": boolean
           },
          "issues": [
            {
              "issue": "Description of issue found in paragraph 1",
              "severity": "critical | major | minor",
              "recommendation": "Specific improvement suggestion for paragraph 1"
            }
            // ... more issues if found
          ]
        },
        // ... more paragraphs in this section
      ]
    }
    // ... more sections
  ]
}
\`\`\`

**IMPORTANT:**
* Ensure the JSON is well-formed.
* Extract all text content accurately.
* Apply all specified rules thoroughly.
* Provide boolean values for paragraph evaluations.
* Adhere strictly to the requested JSON structure.
`;

    // --- Make the Single API Call ---
    safeLog('openai-request', 'Sending consolidated analysis request...');
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: fullPrompt }],
      response_format: { type: "json_object" }, // Requires compatible model like gpt-4o or gpt-4-turbo-preview
      temperature: 0.1, // Low temperature for consistent structural output
      // Consider adding max_tokens if needed, but JSON mode often handles this well
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
         // Attempt to extract partial info or return error structure
          throw new Error(`Failed to parse analysis results from AI. Raw response: ${analysisResultRaw.substring(0, 500)}...`);
     }

     // Basic validation of the parsed structure
     if (!analysisResult || typeof analysisResult !== 'object' || !analysisResult.sections) {
          console.error("[AIService] Parsed JSON structure is invalid or missing key fields:", analysisResult);
          throw new Error("Parsed analysis result from AI is missing required fields (e.g., 'sections').");
     }

    // --- Calculate Statistics (Post-Processing) ---
    let criticalCount = 0, majorCount = 0, minorCount = 0;

    // Function to count issues in an issue array
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

    // Count abstract issues
    if (analysisResult.abstract) {
        countIssues(analysisResult.abstract.issues);
    }
     // Count major document issues provided by AI
     if(analysisResult.majorIssues) {
         analysisResult.majorIssues.forEach(issue => {
             if (issue.severity === 'critical') criticalCount++;
             if (issue.severity === 'major') majorCount++;
             // Minor issues aren't typically listed as "majorIssues"
         })
     }


    // Count paragraph issues
    if (Array.isArray(analysisResult.sections)) {
      analysisResult.sections.forEach(section => {
        if (Array.isArray(section.paragraphs)) {
          section.paragraphs.forEach(para => {
            countIssues(para.issues);
          });
        }
      });
    }

    // --- Construct Final Output ---
    // Ensure all expected top-level keys exist, even if empty
    const finalResults = {
      title: analysisResult.title || "Title Not Found",
      abstract: analysisResult.abstract || { text: "", summary: "", evaluations: {}, issues: [] },
      documentAssessment: analysisResult.documentAssessment || {},
      majorIssues: analysisResult.majorIssues || [], // From AI's assessment
      overallRecommendations: analysisResult.overallRecommendations || [],
      statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
      sections: analysisResult.sections || [],
      // Note: prioritizedIssues list is removed as it was generated client-side before.
      // If needed, it could be reconstructed here by iterating through all issues again.
    };

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
    // Return a structured error response
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
