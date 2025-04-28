// File Path: src/services/AIService.js
// Complete file: Reinforced paragraph eval keys & issue generation rules in prompt

import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Safe console logging
const safeLog = (prefix, message) => {
  try {
    // Ensure message is serializable before logging potentially large objects
    let loggableMessage = message;
    if (typeof message === 'object' && message !== null) {
        loggableMessage = JSON.stringify(message).substring(0, 300) + '...';
    } else if (typeof message === 'string') {
        loggableMessage = message.substring(0, 300) + (message.length > 300 ? '...' : '');
    }
    console.log(`[AIService] ${prefix}: ${loggableMessage}`);
  } catch (error) {
    console.log(`[AIService] Error logging ${prefix}: ${error.message}`);
  }
};

// Rule Loading
const loadRules = () => {
  let paragraphRules = { rules: [] }; // Default empty
  let documentRules = { rules: [] }; // Default empty

  try {
    // Load paragraph-specific rules for prompting
    const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
    if (fs.existsSync(paragraphRulesPath)) {
        paragraphRules = JSON.parse(fs.readFileSync(paragraphRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${paragraphRules.rules?.length || 0} paragraph rules from file.`);
         // Ensure originalRuleNumber is present, add placeholder if needed
        paragraphRules.rules?.forEach(rule => {
            if (!rule.originalRuleNumber) {
                 console.warn(`Rule ${rule.id} (paragraph) missing originalRuleNumber.`);
                 rule.originalRuleNumber = "X"; // Placeholder
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
                  console.warn(`Rule ${rule.id} (document) missing originalRuleNumber.`);
                  rule.originalRuleNumber = "X"; // Placeholder
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
  return { paragraphRules, documentRules };
};


// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  console.log('[AIService] Starting single-call analysis (fill-template prompt v3)...'); // Updated log
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
    const { paragraphRules, documentRules } = loadRules();
    if (!paragraphRules.rules?.length || !documentRules.rules?.length) {
        console.warn('[AIService] Warning: One or both rule sets appear empty. AI analysis may be limited.');
    }

    // Prepare Rule Prompts (for AI reference)
    // Use rule IDs that correspond to the expected evaluation keys if possible
    // Ensure these rules cover: cccStructure, sentenceQuality, topicContinuity, terminologyConsistency, structuralParallelism
    const paragraphRulesPrompt = paragraphRules.rules?.map(rule => `
### Paragraph Rule MnK${rule.originalRuleNumber || 'X'} (ID: ${rule.id}): ${rule.title}
${rule.fullText}
Checkpoints: ${rule.checkpoints?.map(cp => cp.description).join(', ') || 'N/A'}
`).join('\n') || 'No paragraph rules loaded.';

    const documentRulesPrompt = documentRules.rules?.map(rule => `
### Document Rule MnK${rule.originalRuleNumber || 'X'} (ID: ${rule.id}): ${rule.title}
${rule.fullText}
Checkpoints: ${rule.checkpoints?.map(cp => cp.description).join(', ') || 'N/A'}
`).join('\n') || 'No document rules loaded.';


    // Truncate Text
    const MAX_CHARS = 100000;
    const truncatedText = rawText.substring(0, MAX_CHARS);
    if (rawText.length > MAX_CHARS) {
        console.warn(`[AIService] Input text truncated from ${rawText.length} to ${MAX_CHARS} characters.`);
    }

    // Define the FULL JSON Template
    const jsonTemplate = JSON.stringify({
        title: "...", // To be filled by AI
        abstract: {
            text: "...", // To be filled by AI
            summary: "...", // To be filled by AI
            evaluations: { // AI must fill these booleans based on Paragraph Rules
                cccStructure: null,
                sentenceQuality: null,
                topicContinuity: null,
                terminologyConsistency: null,
                structuralParallelism: null
            },
            issues: [ /* { issue: "MnK#: ...", severity: "...", recommendation: "MnK#: ..." } */ ] // AI fills array
        },
        documentAssessment: { // AI must fill ALL these objects based on Document Rules
            titleQuality: { score: null, assessment: "...", recommendation: "..." },
            abstractCompleteness: { score: null, assessment: "...", recommendation: "..." },
            introductionStructure: { score: null, assessment: "...", recommendation: "..." },
            resultsOrganization: { score: null, assessment: "...", recommendation: "..." },
            discussionQuality: { score: null, assessment: "...", recommendation: "..." },
            messageFocus: { score: null, assessment: "...", recommendation: "..." },
            topicOrganization: { score: null, assessment: "...", recommendation: "..." }
        },
        majorIssues: [ /* { issue: "MnK#: ...", location: "...", severity: "...", recommendation: "MnK#: ..." } */ ], // AI fills array
        overallRecommendations: [ /* "MnK#: ..." */ ], // AI fills array
        sections: [
            // AI should generate structure like this based on paper text
            // Provide one example structure for AI guidance
            {
                name: "Example Section Name (e.g., Introduction) - Replace this",
                paragraphs: [
                    {
                        text: "Example paragraph text - AI replaces this.",
                        summary: "AI generates summary.",
                        // AI fills these booleans based on Paragraph Rules
                        evaluations: { cccStructure: null, sentenceQuality: null, topicContinuity: null, terminologyConsistency: null, structuralParallelism: null },
                         // AI fills array based on Paragraph Rules
                        issues: [ /* { issue: "MnK#:...", severity: "...", recommendation: "MnK#:..." } */ ]
                    }
                    // AI should add more paragraph objects here as identified
                ]
            }
            // AI should add more section objects here as identified
        ]
    }, null, 2); // Pretty print for the prompt


    // --- ***** REVISED PROMPT with specific instructions ***** ---
    const fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Analyze the provided paper text according to the rules listed below.

**TASK:**
1.  Read the **PAPER TEXT**.
2.  Analyze the text based on the **EVALUATION RULES**.
3.  **Fill in** the provided **JSON TEMPLATE** with your analysis results. Replace ALL placeholders like "..." and null values.
4.  **Paragraph Evaluation Details:**
    * For the "evaluations" object in EACH paragraph (and abstract), provide boolean flags (\`true\`/\`false\`) ONLY for these EXACT keys: **"cccStructure", "sentenceQuality", "topicContinuity", "terminologyConsistency", "structuralParallelism"**. Do NOT include other keys like 'cognitiveLoad' or 'logicalFlow'.
    * For the "issues" array in EACH paragraph (and abstract): **IF any of the above boolean evaluation flags are \`false\`, you MUST add a corresponding issue object** describing the problem and a recommendation. Prepend rule-specific "issue" and "recommendation" text with "MnK{originalRuleNumber}: ". If all flags are \`true\`, the issues array should be empty \`[]\`.
5.  **Document Assessment Details:** You MUST provide scores (1-10), assessments, and recommendations for ALL of the following keys: "titleQuality", "abstractCompleteness", "introductionStructure", "resultsOrganization", "discussionQuality", "messageFocus", "topicOrganization". Prepend rule-specific "assessment" and "recommendation" text with "MnK{originalRuleNumber}: ".
6.  **Major Issues & Recommendations:** Populate these arrays, prepending rule-specific feedback with "MnK{originalRuleNumber}: ".

**PAPER TEXT:**
\`\`\`
${truncatedText}
\`\`\`

**EVALUATION RULES (Referenced for MnK$ Tags):**
--- Paragraph Rules ---
${paragraphRulesPrompt}
--- Document Rules ---
${documentRulesPrompt}

**JSON TEMPLATE TO FILL:**
\`\`\`json
${jsonTemplate}
\`\`\`

**FINAL INSTRUCTIONS:**
- Return ONLY the completed, valid JSON object based on the template.
- **Ensure ALL fields specified in the template (ALL documentAssessment keys, required paragraph 'evaluations' keys) are present and filled.**
- **Use ONLY the specified boolean keys in paragraph 'evaluations'.**
- **Generate an 'issue' item whenever a paragraph evaluation boolean is \`false\`.**
- Strictly follow the MnK$ tagging requirement ("MnK{ruleNumber}: ").
`;
    // --- ***** REVISED PROMPT END ***** ---


    // --- Make the Single API Call ---
    safeLog('openai-request', 'Sending consolidated analysis request (v3 - corrected evals)...');
    const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: "json_object" }, // Ensure model supports this
        temperature: 0.1, // Low temperature for better structure adherence
     });
    const analysisResultRaw = response.choices[0]?.message?.content;
    if (!analysisResultRaw) { throw new Error("OpenAI response content is empty."); }

    // --- Parse and Process Results ---
    let analysisResult;
    try {
        analysisResult = JSON.parse(analysisResultRaw);
        safeLog('openai-response-parsed', 'Successfully parsed AI JSON response.');
    } catch (parseError) {
        console.error("[AIService] Failed to parse OpenAI JSON response:", parseError);
        safeLog('openai-response-raw-on-error', analysisResultRaw); // Log raw on error
        throw new Error(`Failed to parse analysis results from AI.`);
    }

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

    // Safely count issues
    try {
      if (analysisResult.abstract) { countIssues(analysisResult.abstract.issues); }
      // Count major issues directly from the top-level array
      if (analysisResult.majorIssues) {
          analysisResult.majorIssues.forEach(issue => {
               if (issue?.severity === 'critical') criticalCount++; // Should ideally not be critical here, but check
               if (issue?.severity === 'major') majorCount++;
          });
      }
      if (Array.isArray(analysisResult.sections)) {
          analysisResult.sections.forEach(section => {
              if (Array.isArray(section.paragraphs)) {
                  section.paragraphs.forEach(para => { countIssues(para?.issues); });
              }
          });
       }
    } catch(countError) {
       console.error("[AIService] Error calculating statistics from AI results:", countError);
       criticalCount = -1; majorCount = -1; minorCount = -1; // Indicate error in stats
    }


    // --- Construct Final Output ---
    // Assume AI filled the template; provide defaults only if top-level keys are missing
    const finalResults = {
      title: analysisResult.title ?? "Title Not Found by AI", // Use nullish coalescing
      abstract: analysisResult.abstract ?? { text: "", summary: "", evaluations: {}, issues: [] },
      documentAssessment: analysisResult.documentAssessment ?? {}, // Provide empty obj if missing
      majorIssues: analysisResult.majorIssues ?? [], // Provide empty array if missing
      overallRecommendations: analysisResult.overallRecommendations ?? [], // Provide empty array if missing
      statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
      sections: analysisResult.sections ?? [], // Provide empty array if missing
    };

    // Basic validation logging for key parts
    if (typeof finalResults.documentAssessment !== 'object') { console.warn("Final results documentAssessment is not an object"); }
    if (!Array.isArray(finalResults.sections)) { console.warn("Final results sections is not an array"); }


    safeLog('final-results-structure-check', {
        titleExists: !!finalResults.title,
        abstractExists: !!finalResults.abstract,
        docAssessmentKeys: finalResults.documentAssessment ? Object.keys(finalResults.documentAssessment).length : 0,
        sectionsCount: finalResults.sections.length,
        stats: finalResults.statistics
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
} // End of analyzeDocumentStructure
