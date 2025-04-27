// File Path: src/services/AIService.js
// Cleaned version + Re-emphasized MnK Tagging
'use client' // This likely should NOT be 'use client', AIService runs server-side

import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Safe console logging
const safeLog = (prefix, message) => { /* ... */ };

// Rule Loading (ensure originalRuleNumber is available)
const loadRules = () => { /* ... */ };


// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  // Keep essential logs
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

    // Prepare Rule Prompts (Ensure originalRuleNumber is included)
    const paragraphRulesPrompt = paragraphRules.rules?.map(rule => `
### Paragraph Rule MnK${rule.originalRuleNumber || 'X'} (ID: ${rule.id}): ${rule.title}
${rule.fullText}
**Checkpoints:**
${rule.checkpoints.map(cp => `- ${cp.description}`).join('\n')}
`).join('\n') || 'No paragraph rules loaded.';

    const documentRulesPrompt = documentRules.rules?.map(rule => `
### Document Rule MnK${rule.originalRuleNumber || 'X'} (ID: ${rule.id}): ${rule.title}
${rule.fullText}
**Checkpoints:**
${rule.checkpoints.map(cp => `- ${cp.description}`).join('\n')}
`).join('\n') || 'No document rules loaded.';


    // Construct the Consolidated Prompt
    const MAX_CHARS = 100000;
    const truncatedText = rawText.substring(0, MAX_CHARS);
    if (rawText.length > MAX_CHARS) { console.warn(/*...*/); }

    // --- ***** REFINED PROMPT with STRONGER MnK$ instruction ***** ---
    const fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Analyze the provided paper text.

**TASK:**
Perform a comprehensive analysis:
1.  Structure Extraction: Identify title, abstract, sections, paragraphs (extract full text).
2.  Paragraph Evaluation: Evaluate EACH paragraph (including abstract) against the PARAGRAPH RULES below. Provide summary, boolean evaluations, and issues.
3.  Document Assessment: Evaluate the OVERALL paper against the DOCUMENT RULES below. Provide scores, assessments, recommendations.
4.  Major Issues & Recommendations: Identify significant document-level problems and overall recommendations.

**VERY IMPORTANT - MnK$ Tagging Requirement:**
For EVERY piece of feedback generated (specifically, the text within the "issue", "recommendation", "assessment" fields in the JSON structure), you MUST prepend the feedback text with the corresponding "MnK$:" tag IF the feedback directly relates to one of the MnK rules provided below. Use the format "MnK{originalRuleNumber}: ". For example: "issue": "MnK3: This paragraph lacks a clear conclusion." or "assessment": "MnK7: Results flow could be clearer.". If feedback is general and not tied to a specific rule, do not add the tag.

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
Return ONLY a single, valid JSON object matching the structure described and exemplified below. Adhere strictly to the structure and the MnK$ Tagging Requirement.

**Structure Description:**
(Keep description as before)

**Example of CORRECT JSON Structure (with MnK$ tags):**
(Keep example JSON as before, ensuring it shows tags correctly)
\`\`\`json
{ ... example demonstrating MnK tags in issue, recommendation, assessment ... }
\`\`\`

**FINAL INSTRUCTIONS:**
* Output valid JSON ONLY.
* Apply rules thoroughly.
* **Strictly follow the MnK$ tagging requirement for all rule-specific feedback.**
* Adhere strictly to the overall JSON structure.
`;
    // --- ***** REFINED PROMPT END ***** ---


    // --- Make the Single API Call ---
    safeLog('openai-request', 'Sending consolidated analysis request with MnK tagging...');
    const response = await openai.chat.completions.create({ /* ... API call options ... */ });
    const analysisResultRaw = response.choices[0]?.message?.content;
    if (!analysisResultRaw) { throw new Error("OpenAI response content is empty."); }
    // safeLog('openai-response-raw', analysisResultRaw); // Keep commented unless debugging AI output

    // --- Parse and Process Results ---
    let analysisResult;
    try { analysisResult = JSON.parse(analysisResultRaw); }
    catch (parseError) { throw new Error(`Failed to parse analysis results from AI.`); }

    // --- Flexible Parsing Logic ---
    const docAssessment = analysisResult.documentAssessment || {};
    const majorIssues = analysisResult.majorIssues || docAssessment.majorIssues || [];
    // ... (rest of flexible parsing) ...
    const sections = analysisResult.sections || docAssessment.sections || [];


    // --- Calculate Statistics ---
    let criticalCount = 0, majorCount = 0, minorCount = 0;
    const countIssues = (issues) => { /* ... */ };
    // ... (counting logic) ...

    // --- Construct Final Output ---
    const finalResults = { /* ... */ };
    if (!Array.isArray(finalResults.sections)) { throw new Error("Failed to extract 'sections' array.") }

    safeLog('final-results-structure', { /* ... limited log ... */ });
    console.log(`[AIService] Single-call analysis completed in ${Date.now() - serviceStartTime}ms`);
    return finalResults;

  } catch (error) {
    console.error('[AIService] Critical error during single-call analysis:', error);
    return { /* ... error structure ... */ };
  }
}
