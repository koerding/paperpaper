// File Path: src/services/AIService.js
// Corrected: Removed 'use client' directive

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

// Rule Loading (ensure originalRuleNumber is available)
const loadRules = () => {
  let paragraphRules = { rules: [] };
  let documentRules = { rules: [] };
  const ruleMap = new Map(); // Store rule details by originalRuleNumber

  try {
    // Load combined rules first to get originalRuleNumber mapping easily
    const combinedRulesPath = path.join(process.cwd(), 'src', 'rules.json');
    if (fs.existsSync(combinedRulesPath)) {
        const combinedRules = JSON.parse(fs.readFileSync(combinedRulesPath, 'utf8'));
        if (combinedRules.rules && Array.isArray(combinedRules.rules)) {
            combinedRules.rules.forEach(rule => {
                if (rule.id && rule.originalRuleNumber && rule.title) {
                    ruleMap.set(rule.originalRuleNumber.toString(), { id: rule.id, title: rule.title });
                }
            });
        }
        safeLog('loadRules', `Processed ${ruleMap.size} rules from combined rules.json for mapping.`);
    } else {
         console.warn('[AIService] src/rules.json not found. MnK Tag mapping might be incomplete.');
    }


    // Load paragraph-specific rules for prompting
    const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
    if (fs.existsSync(paragraphRulesPath)) {
        paragraphRules = JSON.parse(fs.readFileSync(paragraphRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${paragraphRules.rules?.length || 0} paragraph rules from file.`);
        // Ensure originalRuleNumber is present, fallback if needed
        paragraphRules.rules?.forEach(rule => {
            if (!rule.originalRuleNumber) {
                 const mappedRule = Array.from(ruleMap.values()).find(r => r.id === rule.id);
                 if (mappedRule) rule.originalRuleNumber = parseInt(Array.from(ruleMap.keys()).find(key => ruleMap.get(key) === mappedRule));
                 else rule.originalRuleNumber = "X"; // Placeholder if mapping fails
            }
        });
    } else {
        console.warn('[AIService] paragraph-rules.json not found.');
    }

    // Load document-specific rules for prompting
    const documentRulesPath = path.join(process.cwd(), 'src', 'document-rules.json');
     if (fs.existsSync(documentRulesPath)) {
        documentRules = JSON.parse(fs.readFileSync(documentRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${documentRules.rules?.length || 0} document rules from file.`);
         // Ensure originalRuleNumber is present
         documentRules.rules?.forEach(rule => {
             if (!rule.originalRuleNumber) {
                  const mappedRule = Array.from(ruleMap.values()).find(r => r.id === rule.id);
                  if (mappedRule) rule.originalRuleNumber = parseInt(Array.from(ruleMap.keys()).find(key => ruleMap.get(key) === mappedRule));
                  else rule.originalRuleNumber = "X"; // Placeholder
             }
         });
     } else {
         console.warn('[AIService] document-rules.json not found.');
     }

  } catch (error) {
    console.error('[AIService] Critical error loading rules JSON files:', error);
     paragraphRules = { rules: [] };
     documentRules = { rules: [] };
     safeLog('loadRules', 'Falling back to empty rules due to critical error.');
  }
  // Return the map as well for potential use later
  return { paragraphRules, documentRules, ruleMap };
};


// --- Main Analysis Function ---
// Ensure this is correctly exported as a named export
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  // Keep essential logs
  console.log('[AIService] Starting single-call analysis...');
  const serviceStartTime = Date.now();

  try {
    safeLog('input-raw-text', { textLength: rawText?.length || 0 });
    // Basic Input Validation & Env Check
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
       console.error('[AIService] Error: Input text is empty or invalid.');
        return {
            analysisError: 'Input document text is empty or invalid.',
            title: "Analysis Failed (Empty Input)",
            abstract: { text: "", summary: "", evaluations: {}, issues: [] },
            documentAssessment: {},
            majorIssues: [],
            overallRecommendations: [],
            statistics: { critical: 0, major: 0, minor: 0 },
            sections: []
        };
     }
    if (!process.env.OPENAI_API_KEY) { throw new Error("OpenAI API Key not configured"); }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`[AIService] Using OpenAI model: ${model}`);

    // Load Rules
    const { paragraphRules, documentRules } = loadRules(); // ruleMap is loaded inside but not needed here currently
    if (!paragraphRules.rules?.length || !documentRules.rules?.length) { console.warn('[AIService] Warning: One or both rule sets are empty.'); }

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
    if (rawText.length > MAX_CHARS) { console.warn(`[AIService] Input text truncated to ${MAX_CHARS} chars.`); }

    // --- Prompt with MnK Tagging Instruction ---
    const fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Analyze the provided paper text.

**TASK:**
Perform a comprehensive analysis:
1.  Structure Extraction: Identify title, abstract, sections, paragraphs (extract full text).
2.  Paragraph Evaluation: Evaluate EACH paragraph (including abstract) against the PARAGRAPH RULES below. Provide summary, boolean evaluations, and issues. **VERY IMPORTANT:** For every 'issue' and 'recommendation' generated, prepend it with the corresponding "MnK{originalRuleNumber}: " tag (e.g., "MnK3: ").
3.  Document Assessment: Evaluate the OVERALL paper against the DOCUMENT RULES below. Provide scores, assessments, recommendations. Prepend "assessment" and "recommendation" with "MnK{originalRuleNumber}: " IF the feedback directly relates to a rule.
4.  Major Issues & Recommendations: Identify significant document-level problems and overall recommendations. Prepend these with "MnK{originalRuleNumber}: " where applicable.

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
(Top-level keys: "title", "abstract", "documentAssessment", "majorIssues", "overallRecommendations", "sections". Nested structures as previously defined.)

**Example of CORRECT JSON Structure (with MnK$ tags):**
\`\`\`json
{
  "title": "Example Paper Title",
  "abstract": {
    "text": "Full abstract text here...",
    "summary": "Abstract summary.",
    "evaluations": { "cccStructure": true, "sentenceQuality": false, "topicContinuity": true, "terminologyConsistency": true, "structuralParallelism": true },
    "issues": [ { "issue": "MnK5: Abstract lacks broader significance statement.", "severity": "minor", "recommendation": "MnK5: Add a concluding sentence about the work's wider impact." } ]
  },
  "documentAssessment": {
    "titleQuality": { "score": 8, "assessment": "MnK1: Title clearly states the main finding.", "recommendation": "None." },
    "abstractCompleteness": { "score": 7, "assessment": "MnK5: Mostly complete but missing broader significance.", "recommendation": "MnK5: Add broader impact statement." }
    // ... other assessments ...
  },
  "majorIssues": [
    { "issue": "MnK7: Results lack clear logical progression.", "location": "Results Section", "severity": "major", "recommendation": "MnK7: Reorganize results." }
  ],
  "overallRecommendations": [
    "MnK7: Improve logical flow of the Results section.",
    "MnK5: Explicitly state broader impact."
  ],
  "sections": [ { /* ... sections with paragraphs containing tagged issues/recommendations ... */ } ]
}
\`\`\`

**FINAL INSTRUCTIONS:**
* Output valid JSON ONLY.
* Apply rules thoroughly.
* **Strictly follow the MnK$ tagging requirement ("MnK{ruleNumber}: ") for all rule-specific feedback.**
* Adhere strictly to the overall JSON structure.
`;

    // --- Make the Single API Call ---
    safeLog('openai-request', 'Sending consolidated analysis request with MnK tagging...');
    const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
     });
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
    if (analysisResult.abstract) { countIssues(analysisResult.abstract.issues); }
    if (majorIssues) { majorIssues.forEach(issue => { if (issue.severity === 'critical') criticalCount++; if (issue.severity === 'major') majorCount++; }); }
    if (Array.isArray(sections)) { sections.forEach(section => { if (Array.isArray(section.paragraphs)) { section.paragraphs.forEach(para => { countIssues(para.issues); }); } }); }

    // --- Construct Final Output ---
    const finalResults = {
      title: analysisResult.title || "Title Not Found",
      abstract: analysisResult.abstract || { text: "", summary: "", evaluations: {}, issues: [] },
      documentAssessment: {
          titleQuality: docAssessment.titleQuality,
          abstractCompleteness: docAssessment.abstractCompleteness,
          introductionStructure: docAssessment.introductionStructure,
          resultsOrganization: docAssessment.resultsOrganization,
          discussionQuality: docAssessment.discussionQuality,
          messageFocus: docAssessment.messageFocus,
          topicOrganization: docAssessment.topicOrganization,
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
} // End of analyzeDocumentStructure
