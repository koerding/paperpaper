// File Path: src/services/AIService.js
// Added more explicit keys in prompt/example for documentAssessment

import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Safe console logging
const safeLog = (prefix, message) => { /* ... */ };

// Rule Loading
const loadRules = () => { /* ... */ }; // Assuming this works correctly


// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  console.log('[AIService] Starting single-call analysis...');
  const serviceStartTime = Date.now();

  try {
    safeLog('input-raw-text', { textLength: rawText?.length || 0 });
    // Basic Input Validation & Env Check
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) { /*...*/ }
    if (!process.env.OPENAI_API_KEY) { throw new Error("OpenAI API Key not configured"); }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`[AIService] Using OpenAI model: ${model}`);

    // Load Rules
    const { paragraphRules, documentRules } = loadRules();
    if (!paragraphRules.rules?.length || !documentRules.rules?.length) { console.warn(/*...*/); }

    // Prepare Rule Prompts
    const paragraphRulesPrompt = paragraphRules.rules?.map(rule => `...`).join('\n') || 'No paragraph rules.';
    const documentRulesPrompt = documentRules.rules?.map(rule => `...`).join('\n') || 'No document rules.';

    // Truncate Text
    const MAX_CHARS = 100000;
    const truncatedText = rawText.substring(0, MAX_CHARS);
    if (rawText.length > MAX_CHARS) { console.warn(/*...*/); }

    // --- ***** REFINED PROMPT - More Explicit documentAssessment Keys ***** ---
    const fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Analyze the provided paper text.

**TASK:**
Perform a comprehensive analysis:
1.  Structure Extraction: Identify title, abstract, sections, paragraphs (extract full text).
2.  Paragraph Evaluation: Evaluate EACH paragraph (including abstract) against the PARAGRAPH RULES below. Provide summary, boolean evaluations, and issues. Prepend rule-specific feedback with "MnK{ruleNumber}: ".
3.  Document Assessment: Evaluate the OVERALL paper against the DOCUMENT RULES below. Provide scores (1-10), assessments, recommendations for ALL specified keys: "titleQuality", "abstractCompleteness", "introductionStructure", "resultsOrganization", "discussionQuality", "messageFocus", "topicOrganization". Prepend rule-specific feedback with "MnK{ruleNumber}: ".
4.  Major Issues & Recommendations: Identify significant document-level problems and overall recommendations. Prepend rule-specific feedback with "MnK{ruleNumber}: ".

**PAPER TEXT:**
\`\`\`
${truncatedText}
\`\`\`

**EVALUATION RULES (Referenced for MnK$ Tags):**
--- START PARAGRAPH RULES ---
${paragraphRulesPrompt}
--- END PARAGRAPH RULES ---
--- START DOCUMENT RULES ---
${documentRulesPrompt}
--- END DOCUMENT RULES ---

**REQUIRED OUTPUT FORMAT:**
Return ONLY a single, valid JSON object matching the structure described and exemplified below.

**Structure Description:**
The JSON object MUST have top-level keys: "title", "abstract", "documentAssessment", "majorIssues", "overallRecommendations", "sections".
- "documentAssessment" MUST contain OBJECTS for ALL these keys: "titleQuality", "abstractCompleteness", "introductionStructure", "resultsOrganization", "discussionQuality", "messageFocus", "topicOrganization". Each object must have "score", "assessment", "recommendation".
- (Other structure descriptions remain the same)

**MnK$ Tagging Requirement:**
(Keep tagging requirements as before)

**Example of CORRECT JSON Structure (Showing ALL assessment keys):**
\`\`\`json
{
  "title": "Example Paper Title",
  "abstract": { /* ... abstract object ... */ },
  "documentAssessment": {
    "titleQuality": { "score": 8, "assessment": "MnK1: Title clearly states the main finding.", "recommendation": "None." },
    "abstractCompleteness": { "score": 7, "assessment": "MnK5: Mostly complete but missing broader significance.", "recommendation": "MnK5: Add broader impact statement." },
    "introductionStructure": { "score": 9, "assessment": "MnK6: Clear context and gap.", "recommendation": "None." },
    "resultsOrganization": { "score": 6, "assessment": "MnK7: Results flow could be clearer.", "recommendation": "MnK7: Reorder Fig 2 and 3." },
    "discussionQuality": { "score": 7, "assessment": "MnK8: Good summary, addresses limitations.", "recommendation": "MnK8: Expand on future directions." },
    "messageFocus": { "score": 8, "assessment": "MnK1: Strong focus on central theme.", "recommendation": "None." },
    "topicOrganization": { "score": 7, "assessment": "MnK4: Minor zig-zag in discussion.", "recommendation": "MnK4: Consolidate discussion of limitation X." }
  },
  "majorIssues": [ /* ... major issues array ... */ ],
  "overallRecommendations": [ /* ... recommendations array ... */ ],
  "sections": [ /* ... sections array ... */ ]
}
\`\`\`

**FINAL INSTRUCTIONS:**
* Output valid JSON ONLY.
* **Provide assessments for ALL specified documentAssessment keys.**
* Strictly follow the MnK$ tagging requirement.
* Adhere strictly to the overall JSON structure.
`;
    // --- ***** REFINED PROMPT END ***** ---


    // --- Make the Single API Call ---
    safeLog('openai-request', 'Sending consolidated analysis request (explicit assessment keys)...');
    const response = await openai.chat.completions.create({ /* ... API call options ... */ });
    const analysisResultRaw = response.choices[0]?.message?.content;
    if (!analysisResultRaw) { throw new Error("OpenAI response content is empty."); }

    // --- Parse and Process Results ---
    let analysisResult;
    try { analysisResult = JSON.parse(analysisResultRaw); }
    catch (parseError) { throw new Error(`Failed to parse analysis results from AI.`); }

    // --- Flexible Parsing Logic ---
    const docAssessment = analysisResult.documentAssessment || {};
    const majorIssues = analysisResult.majorIssues || docAssessment.majorIssues || [];
    const overallRecommendations = analysisResult.overallRecommendations || docAssessment.overallRecommendations || [];
    const sections = analysisResult.sections || docAssessment.sections || [];

    // --- Calculate Statistics ---
    let criticalCount = 0, majorCount = 0, minorCount = 0;
    const countIssues = (issues) => { /* ... */ };
    // ... (counting logic) ...

    // --- Construct Final Output ---
    // Ensure *all* expected keys are present, even if AI missed them (value will be undefined)
    const finalResults = {
      title: analysisResult.title || "Title Not Found",
      abstract: analysisResult.abstract || { text: "", summary: "", evaluations: {}, issues: [] },
      documentAssessment: {
          titleQuality: docAssessment.titleQuality, // Get value if present
          abstractCompleteness: docAssessment.abstractCompleteness,
          introductionStructure: docAssessment.introductionStructure, // Get value if present
          resultsOrganization: docAssessment.resultsOrganization,   // Get value if present
          discussionQuality: docAssessment.discussionQuality,     // Get value if present
          messageFocus: docAssessment.messageFocus,           // Get value if present
          topicOrganization: docAssessment.topicOrganization,     // Get value if present
      },
      majorIssues: majorIssues,
      overallRecommendations: overallRecommendations,
      statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
      sections: sections,
    };
    if (!Array.isArray(finalResults.sections)) { throw new Error("Failed to extract 'sections' array.") }

    safeLog('final-results-structure', { title: finalResults.title?.substring(0, 30) + '...', sections: finalResults.sections?.length });
    console.log(`[AIService] Single-call analysis completed in ${Date.now() - serviceStartTime}ms`);
    return finalResults;

  } catch (error) {
    console.error('[AIService] Critical error during single-call analysis:', error);
    return { /* ... error structure ... */ };
  }
}
