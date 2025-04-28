// File Path: src/services/AIService.js
// Complete file: Using a JSON template in the prompt for the AI to fill

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
  console.log('[AIService] Starting single-call analysis (fill-template prompt v6)...'); // Updated log
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
    const model = process.env.OPENAI_MODEL || 'gpt-4o'; // Define the model variable
    console.log(`[AIService] Using OpenAI model: ${model}`);

    // Load Rules
    const { paragraphRules, documentRules } = loadRules();
    if (!paragraphRules.rules?.length || !documentRules.rules?.length) {
        console.warn('[AIService] Warning: One or both rule sets appear empty. AI analysis may be limited.');
    }

    // Prepare Rule Prompts (for AI reference, used for MnK tagging)
    const paragraphRulesPrompt = paragraphRules.rules?.map(rule => `Rule MnK${rule.originalRuleNumber}(ID:${rule.id}): ${rule.title}`).join('\n') || 'No paragraph rules loaded.';
    const documentRulesPrompt = documentRules.rules?.map(rule => `Rule MnK${rule.originalRuleNumber}(ID:${rule.id}): ${rule.title}`).join('\n') || 'No document rules loaded.';

    // Truncate Text
    const MAX_CHARS = 100000;
    const truncatedText = rawText.substring(0, MAX_CHARS);
    if (rawText.length > MAX_CHARS) {
        console.warn(`[AIService] Input text truncated from ${rawText.length} to ${MAX_CHARS} characters.`);
    }

    // --- Define the MORE DETAILED FULL JSON Template ---
    const jsonTemplate = JSON.stringify({
        title: "...", // To be filled by AI
        abstract: {
            text: "...", // To be filled by AI
            summary: "...", // To be filled by AI
            evaluations: { // AI must fill these specific booleans
                cccStructure: null,
                sentenceQuality: null,
                topicContinuity: null,
                terminologyConsistency: null,
                structuralParallelism: null
            },
            issues: [ /* { issue: "MnK#: ...", severity: "...", recommendation: "MnK#: ..." } */ ] // AI fills array if any eval is false
        },
        documentAssessment: { // AI must fill ALL these objects
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
        // **** Explicitly show multiple sections/paragraphs in template ****
        sections: [
          {
            name: "Section Name 1 (e.g., Introduction) - AI Replaces This",
            paragraphs: [
              {
                text: "Paragraph 1 text... AI Replaces This",
                summary: "...", // AI generates summary
                // AI fills these booleans based on Paragraph Rules
                evaluations: { cccStructure: null, sentenceQuality: null, topicContinuity: null, terminologyConsistency: null, structuralParallelism: null },
                 // AI fills array based on Paragraph Rules
                issues: [ /* { issue: "MnK#:...", severity: "...", recommendation: "MnK#:..." } */ ]
              },
              {
                 text: "Paragraph 2 text... AI Replaces This",
                 summary: "...",
                 evaluations: { cccStructure: null, sentenceQuality: null, topicContinuity: null, terminologyConsistency: null, structuralParallelism: null },
                 issues: []
              }
              // AI: Add more paragraph objects here for Section 1 based on PAPER TEXT
            ]
          },
          {
             name: "Section Name 2 (e.g., Methods) - AI Replaces This",
             // **** CORRECTED THIS LINE ****
             "paragraphs": [
             // ***************************
                {
                   text: "Paragraph 1 text... AI Replaces This",
                   summary: "...",
                   evaluations: { cccStructure: null, sentenceQuality: null, topicContinuity: null, terminologyConsistency: null, structuralParallelism: null },
                   issues: []
                }
                 // AI: Add more paragraph objects here for Section 2 based on PAPER TEXT
             ]
          }
          // AI: Add more section objects here as identified in the PAPER TEXT
        ]
        // ******************************************************************
    }, null, 2); // Pretty print for the prompt


    // --- ***** Prompt using MORE DETAILED JSON Template ***** ---
    const fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Your primary goal is to meticulously analyze the provided paper text and return a COMPLETE and VALID JSON object based EXACTLY on the template provided.

**TASK:**
1.  Read the **PAPER TEXT**.
2.  Analyze the text based on the **EVALUATION RULES**.
3.  **Fill in** the provided **JSON TEMPLATE** with your analysis results. Replace ALL placeholders like "..." and null values. **CRITICAL:** Ensure every single field specified in the template is present and filled. **Identify ALL relevant sections and paragraphs from the PAPER TEXT and represent them accurately within the 'sections' array in the template structure.**
4.  **Paragraph Evaluation Details:** For EACH paragraph identified in the text (including the abstract):
    * Fill the "evaluations" object using ONLY these EXACT boolean keys: **"cccStructure", "sentenceQuality", "topicContinuity", "terminologyConsistency", "structuralParallelism"**.
    * Fill the "issues" array: **IF any evaluation flag is \`false\`, MUST add a corresponding issue object**. Prepend rule-specific feedback with "MnK{ruleNumber}: ". If all flags \`true\`, use \`[]\`.
5.  **Document Assessment Details:** MUST provide scores (1-10), assessments, recommendations for ALL keys: "titleQuality", "abstractCompleteness", "introductionStructure", "resultsOrganization", "discussionQuality", "messageFocus", "topicOrganization". Prepend rule-specific feedback with "MnK{ruleNumber}: ".
6.  **Major Issues & Recommendations:** Populate these arrays, prepending rule-specific feedback with "MnK{ruleNumber}: ".

**PAPER TEXT:**
\`\`\`
${truncatedText}
\`\`\`

**EVALUATION RULES (Referenced for MnK$ Tags):**
--- Paragraph Rules ---
${paragraphRulesPrompt}
--- Document Rules ---
${documentRulesPrompt}

**JSON TEMPLATE TO FILL (Fill ALL fields and replicate section/paragraph structure):**
\`\`\`json
${jsonTemplate}
\`\`\`

**FINAL INSTRUCTIONS:**
- Return ONLY the completed, valid JSON object based on the template.
- **Accurately represent ALL identified sections and paragraphs from the paper text within the 'sections' array, following the nested structure shown in the template.**
- **It is MANDATORY to include and fill ALL fields shown in the template, especially ALL keys within 'documentAssessment' and the correct keys within 'evaluations' for all paragraphs.**
- Use boolean \`true\`/\`false\` for paragraph evaluations.
- Generate an 'issue' item whenever a paragraph evaluation is \`false\`.
- Strictly follow the MnK$ tagging requirement.
`;
    // --- ***** REVISED PROMPT END ***** ---

    // **** Log the full prompt ****
    // WARNING: This can be very long in the console! Consider removing after debugging.
    console.log("\n--- OpenAI Prompt Start (Length:", fullPrompt.length, ") ---\n", fullPrompt, "\n--- OpenAI Prompt End ---\n");


    // --- Make the Single API Call ---
    const requestedMaxTokens = 16384; // Using higher possible output limit
    safeLog('openai-request', `Sending analysis request with max_tokens=${requestedMaxTokens}...`);
    const response = await openai.chat.completions.create({
        // **** Restored 'model' parameter ****
        model: model,
        // ************************************
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: "json_object" }, // Ensure model supports this
        temperature: 0.1, // Low temperature for better structure adherence
        max_tokens: requestedMaxTokens // Explicitly set max output tokens
     });

    // Log stop reason and raw response
    const stopReason = response.choices[0]?.finish_reason;
    safeLog('openai-response-stop-reason', stopReason);
    if (stopReason === 'length') { console.warn('[AIService] OpenAI response finish_reason was "length", output may be truncated.'); }

    const analysisResultRaw = response.choices[0]?.message?.content;
    if (!analysisResultRaw) { throw new Error("OpenAI response content is empty."); }

    // **** Log the full raw response ****
    // WARNING: This can also be very long! Consider removing after debugging.
    console.log("\n--- OpenAI Raw Response Start (Length:", analysisResultRaw.length, ") ---\n", analysisResultRaw, "\n--- OpenAI Raw Response End ---\n");

    // --- Parse and Process Results ---
    let analysisResult;
    try {
        analysisResult = JSON.parse(analysisResultRaw);
        safeLog('openai-response-parsed', 'Successfully parsed AI JSON response.');
    } catch (parseError) {
        console.error("[AIService] Failed to parse OpenAI JSON response:", parseError);
        console.error("--- OpenAI Raw Response on Parse Error ---\n", analysisResultRaw, "\n--- End Raw Response ---");
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

    // Safely count issues from the parsed result
    try {
      if (analysisResult.abstract) { countIssues(analysisResult.abstract.issues); }
      if (analysisResult.majorIssues) {
          analysisResult.majorIssues.forEach(issue => {
               if (issue?.severity === 'critical') criticalCount++;
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
       criticalCount = -1; majorCount = -1; minorCount = -1; // Indicate error
    }


    // --- Construct Final Output ---
    // Assume AI filled the template; provide defaults mainly if top-level keys are entirely missing
    const finalResults = {
      title: analysisResult.title ?? "Title Not Found by AI",
      abstract: analysisResult.abstract ?? { text: "", summary: "", evaluations: {}, issues: [] },
      documentAssessment: analysisResult.documentAssessment ?? {},
      majorIssues: analysisResult.majorIssues ?? [],
      overallRecommendations: analysisResult.overallRecommendations ?? [],
      statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
      sections: analysisResult.sections ?? [],
    };

    // Basic validation logging
    if (typeof finalResults.documentAssessment === 'object' && Object.keys(finalResults.documentAssessment).length > 0) {
        const expectedKeys = ['titleQuality', 'abstractCompleteness', 'introductionStructure', 'resultsOrganization', 'discussionQuality', 'messageFocus', 'topicOrganization'];
        const actualKeys = Object.keys(finalResults.documentAssessment);
        const missingKeys = expectedKeys.filter(k => !actualKeys.includes(k));
        if (missingKeys.length > 0) {
            console.warn(`Final results documentAssessment STILL missing keys: ${missingKeys.join(', ')}`);
        } else {
             console.log('[AIService] All expected documentAssessment keys are present.');
        }
    } else {
        console.warn("Final results documentAssessment is missing or empty.");
     }
    if (!Array.isArray(finalResults.sections)) { console.warn("Final results sections is not an array"); }


    safeLog('final-results-structure-check', {
        titleExists: !!finalResults.title,
        abstractExists: !!finalResults.abstract,
        docAssessmentKeysCount: finalResults.documentAssessment ? Object.keys(finalResults.documentAssessment).length : 0,
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
