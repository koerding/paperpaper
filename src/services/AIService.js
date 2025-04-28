// File Path: src/services/AIService.js
// Complete file: Added even stronger emphasis on completing ALL fields in prompt

import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Safe console logging
const safeLog = (prefix, message) => {
  try {
    let loggableMessage = message;
    if (typeof message === 'object' && message !== null) { loggableMessage = JSON.stringify(message).substring(0, 300) + '...'; }
    else if (typeof message === 'string') { loggableMessage = message.substring(0, 300) + (message.length > 300 ? '...' : ''); }
    console.log(`[AIService] ${prefix}: ${loggableMessage}`);
  } catch (error) { console.log(`[AIService] Error logging ${prefix}: ${error.message}`); }
};

// Rule Loading
const loadRules = () => {
  let paragraphRules = { rules: [] };
  let documentRules = { rules: [] };
  try {
    const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
    if (fs.existsSync(paragraphRulesPath)) {
        paragraphRules = JSON.parse(fs.readFileSync(paragraphRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${paragraphRules.rules?.length || 0} paragraph rules.`);
        paragraphRules.rules?.forEach(rule => { if (!rule.originalRuleNumber) { rule.originalRuleNumber = "X"; } });
    } else { console.warn('[AIService] paragraph-rules.json not found.'); }

    const documentRulesPath = path.join(process.cwd(), 'src', 'document-rules.json');
     if (fs.existsSync(documentRulesPath)) {
        documentRules = JSON.parse(fs.readFileSync(documentRulesPath, 'utf8'));
        safeLog('loadRules', `Loaded ${documentRules.rules?.length || 0} document rules.`);
         documentRules.rules?.forEach(rule => { if (!rule.originalRuleNumber) { rule.originalRuleNumber = "X"; } });
     } else { console.warn('[AIService] document-rules.json not found.'); }
  } catch (error) { console.error('[AIService] Critical error loading rules:', error); }
  return { paragraphRules, documentRules };
};


// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  console.log('[AIService] Starting single-call analysis (fill-template prompt v5)...'); // Updated log
  const serviceStartTime = Date.now();

  try {
    safeLog('input-raw-text', { textLength: rawText?.length || 0 });
    // Basic Input Validation & Env Check
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) { return { analysisError: 'Input text is empty.', /*...*/ }; }
    if (!process.env.OPENAI_API_KEY) { throw new Error("OpenAI API Key not configured"); }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`[AIService] Using OpenAI model: ${model}`);

    // Load Rules
    const { paragraphRules, documentRules } = loadRules();
    if (!paragraphRules.rules?.length || !documentRules.rules?.length) { console.warn(/*...*/); }

    // Prepare Rule Prompts
    const paragraphRulesPrompt = paragraphRules.rules?.map(rule => `Rule MnK${rule.originalRuleNumber}(ID:${rule.id}): ${rule.title}`).join('\n') || 'No paragraph rules.';
    const documentRulesPrompt = documentRules.rules?.map(rule => `Rule MnK${rule.originalRuleNumber}(ID:${rule.id}): ${rule.title}`).join('\n') || 'No document rules.';

    // Truncate Text
    const MAX_CHARS = 100000;
    const truncatedText = rawText.substring(0, MAX_CHARS);
    if (rawText.length > MAX_CHARS) { console.warn(/*...*/); }

    // Define the FULL JSON Template
    const jsonTemplate = JSON.stringify({
        title: "...",
        abstract: { text: "...", summary: "...", evaluations: { cccStructure: null, sentenceQuality: null, topicContinuity: null, terminologyConsistency: null, structuralParallelism: null }, issues: [] },
        documentAssessment: { titleQuality: { score: null, assessment: "...", recommendation: "..." }, abstractCompleteness: { score: null, assessment: "...", recommendation: "..." }, introductionStructure: { score: null, assessment: "...", recommendation: "..." }, resultsOrganization: { score: null, assessment: "...", recommendation: "..." }, discussionQuality: { score: null, assessment: "...", recommendation: "..." }, messageFocus: { score: null, assessment: "...", recommendation: "..." }, topicOrganization: { score: null, assessment: "...", recommendation: "..." } },
        majorIssues: [ /* { issue: "MnK#: ...", location: "...", severity: "...", recommendation: "MnK#: ..." } */ ],
        overallRecommendations: [ /* "MnK#: ..." */ ],
        sections: [ { name: "...", paragraphs: [ { text: "...", summary: "...", evaluations: { cccStructure: null, sentenceQuality: null, topicContinuity: null, terminologyConsistency: null, structuralParallelism: null }, issues: [] } ] } ]
    }, null, 2);

    // --- ***** REVISED PROMPT - Strongest Instructions Yet ***** ---
    const fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Your primary goal is to meticulously analyze the provided paper text and return a COMPLETE and VALID JSON object based EXACTLY on the template provided.

**TASK:**
1.  Read the **PAPER TEXT**.
2.  Analyze the text based on the **EVALUATION RULES**.
3.  **Fill in** the provided **JSON TEMPLATE** with your analysis results. Replace ALL placeholders like "..." and null values. **CRITICAL: Ensure every single field specified in the template is present and filled in the final JSON.**
4.  **Paragraph Evaluation Details:**
    * For the "evaluations" object (in abstract & paragraphs), provide boolean flags (\`true\`/\`false\`) ONLY for these keys: **"cccStructure", "sentenceQuality", "topicContinuity", "terminologyConsistency", "structuralParallelism"**.
    * For the "issues" array (in abstract & paragraphs): **IF any evaluation flag is \`false\`, you MUST add a corresponding issue object**. Prepend rule-specific feedback with "MnK{ruleNumber}: ". If all flags \`true\`, the issues array MUST be empty \`[]\`.
5.  **Document Assessment Details:** You MUST provide scores (1-10), assessments, and recommendations for ALL of the following keys: **"titleQuality", "abstractCompleteness", "introductionStructure", "resultsOrganization", "discussionQuality", "messageFocus", "topicOrganization"**. Ensure ALL these keys are present in the output object. Prepend rule-specific feedback with "MnK{ruleNumber}: ".
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

**JSON TEMPLATE TO FILL (Fill ALL fields):**
\`\`\`json
${jsonTemplate}
\`\`\`

**FINAL INSTRUCTIONS:**
- Return ONLY the completed, valid JSON object based on the template.
- **It is MANDATORY to include and fill ALL fields shown in the template, especially ALL keys within 'documentAssessment' and the correct keys within 'evaluations' for paragraphs.** Do not omit any requested fields.
- Use boolean \`true\`/\`false\` for paragraph evaluations.
- Generate an 'issue' item whenever a paragraph evaluation is \`false\`.
- Strictly follow the MnK$ tagging requirement.
`;
    // --- ***** REVISED PROMPT END ***** ---

    // **** Log the full prompt ****
    console.log("\n--- OpenAI Prompt Start (Length:", fullPrompt.length, ") ---\n", fullPrompt, "\n--- OpenAI Prompt End ---\n");

    // --- Make the Single API Call ---
    const requestedMaxTokens = 16384;
    safeLog('openai-request', `Sending analysis request with max_tokens=${requestedMaxTokens}...`);
    const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: requestedMaxTokens
     });

    const stopReason = response.choices[0]?.finish_reason;
    safeLog('openai-response-stop-reason', stopReason);
    if (stopReason === 'length') { console.warn('[AIService] OpenAI response finish_reason was "length", output may be truncated.'); }

    const analysisResultRaw = response.choices[0]?.message?.content;
    if (!analysisResultRaw) { throw new Error("OpenAI response content is empty."); }

    // **** Log the full raw response ****
    console.log("\n--- OpenAI Raw Response Start (Length:", analysisResultRaw.length, ") ---\n", analysisResultRaw, "\n--- OpenAI Raw Response End ---\n");

    // --- Parse and Process Results ---
    let analysisResult;
    try { analysisResult = JSON.parse(analysisResultRaw); safeLog('openai-response-parsed', 'OK'); }
    catch (parseError) { console.error(/*...*/); throw new Error(/*...*/); }

    // --- Calculate Statistics ---
    let criticalCount = 0, majorCount = 0, minorCount = 0;
    const countIssues = (issues) => { /* ... count logic ... */ };
    try { /* ... Safely count issues ... */ } catch(countError) { /* ... error handling ... */ }

    // --- Construct Final Output ---
    const finalResults = {
      title: analysisResult.title ?? "Title Not Found by AI",
      abstract: analysisResult.abstract ?? { text: "", summary: "", evaluations: {}, issues: [] },
      documentAssessment: analysisResult.documentAssessment ?? {},
      majorIssues: analysisResult.majorIssues ?? [],
      overallRecommendations: analysisResult.overallRecommendations ?? [],
      statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
      sections: analysisResult.sections ?? [],
    };

    // Validation logging (check if all keys are present now)
    if (typeof finalResults.documentAssessment === 'object') {
        const expectedKeys = ['titleQuality', 'abstractCompleteness', 'introductionStructure', 'resultsOrganization', 'discussionQuality', 'messageFocus', 'topicOrganization'];
        const actualKeys = Object.keys(finalResults.documentAssessment);
        const missingKeys = expectedKeys.filter(k => !actualKeys.includes(k));
        if (missingKeys.length > 0) {
            console.warn(`Final results documentAssessment STILL missing keys: ${missingKeys.join(', ')}`);
        } else {
             console.log('[AIService] All expected documentAssessment keys are present.');
        }
    } else { console.warn("Final results documentAssessment is missing or invalid."); }
    if (!Array.isArray(finalResults.sections)) { console.warn(/* ... */); }

    safeLog('final-results-structure-check', { /* ... */ });
    console.log(`[AIService] Single-call analysis completed in ${Date.now() - serviceStartTime}ms`);
    return finalResults;

  } catch (error) {
    console.error('[AIService] Critical error during single-call analysis:', error);
    return { /* ... error structure ... */ };
  }
} // End of analyzeDocumentStructure
