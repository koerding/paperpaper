// File Path: src/services/AIService.js
// Complete file: Using a better JSON template and improved prompting for full document extraction

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

// Basic document structure extraction
const extractDocumentStructure = async (openai, model, rawText) => {
  try {
    const structurePrompt = `
I need you to extract just the basic structure of this scientific document.
Do not analyze anything, just identify:

1. The document title
2. All section headings exactly as they appear in the text
3. For each section, count the approximate number of paragraphs it contains

Return your answer as a valid JSON object formatted like this:
{
  "title": "The document title here",
  "sections": [
    {
      "name": "First section name (e.g. Introduction, Abstract, etc.)",
      "paragraphCount": number_of_paragraphs_in_this_section
    },
    {
      "name": "Second section name",
      "paragraphCount": number_of_paragraphs_in_this_section
    }
    // etc for all sections
  ]
}

Here is the document text:
\`\`\`
${rawText.substring(0, 100000)}
\`\`\`

ONLY return the JSON object containing the document structure, nothing else.`;

    const structureResponse = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: structurePrompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    const structureResult = structureResponse.choices[0]?.message?.content;
    if (!structureResult) { throw new Error("Structure extraction response is empty"); }

    const structure = JSON.parse(structureResult);
    console.log('[AIService] Document structure extracted:', 
                `Title: "${structure.title}", ` +
                `${structure.sections.length} sections, ` + 
                `est. ${structure.sections.reduce((sum, s) => sum + s.paragraphCount, 0)} paragraphs`);
    
    return structure;
  } catch (error) {
    console.error('[AIService] Error extracting document structure:', error);
    return null;
  }
};

// Validate the completeness of the analysis result
const validateResults = (analysisResult) => {
  // Check if we have sections
  if (!Array.isArray(analysisResult.sections) || analysisResult.sections.length === 0) {
    console.error('[AIService] Critical error: AI response contains no sections.');
    return false;
  }
  
  // Check if paragraphs exist in each section
  let totalParagraphs = 0;
  let sectionsWithoutParagraphs = [];
  
  analysisResult.sections.forEach((section, idx) => {
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0) {
      sectionsWithoutParagraphs.push(section.name || `Section ${idx+1}`);
    } else {
      totalParagraphs += section.paragraphs.length;
    }
  });
  
  if (sectionsWithoutParagraphs.length > 0) {
    console.error(`[AIService] Error: Sections without paragraphs: ${sectionsWithoutParagraphs.join(', ')}`);
    return false;
  }
  
  // Check if we have a reasonable number of paragraphs
  // Most scientific papers have at least 10-15 paragraphs
  if (totalParagraphs < 5) {
    console.error(`[AIService] Error: AI only extracted ${totalParagraphs} paragraphs, which seems too few.`);
    return false;
  }
  
  console.log(`[AIService] Validation passed: Found ${analysisResult.sections.length} sections with ${totalParagraphs} total paragraphs.`);
  return true;
};

// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document /* unused */, rawText) {
  console.log('[AIService] Starting single-call analysis (fill-template prompt v7)...'); // Updated log
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

    // --- Extract document structure first ---
    console.log('[AIService] Extracting document structure first...');
    const documentStructure = await extractDocumentStructure(openai, model, truncatedText);

    // --- Define the IMPROVED JSON Template ---
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
            issues: [] // AI fills array if any eval is false
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
        majorIssues: [], // AI fills array
        overallRecommendations: [], // AI fills array
        
        // The sections array MUST contain ALL sections found in the document
        // DO NOT limit to just these example sections
        sections: [
          // EXAMPLE SECTION 1 - THIS IS JUST AN EXAMPLE STRUCTURE
          {
            name: "EXAMPLE: Introduction", // AI REPLACES with actual section name
            paragraphs: [
              // EXAMPLE PARAGRAPH 1 - THIS IS JUST AN EXAMPLE FORMAT
              {
                text: "EXAMPLE TEXT - AI MUST REPLACE WITH ACTUAL PARAGRAPH TEXT",
                summary: "EXAMPLE SUMMARY - AI MUST REPLACE",
                evaluations: { 
                  cccStructure: null, 
                  sentenceQuality: null, 
                  topicContinuity: null, 
                  terminologyConsistency: null, 
                  structuralParallelism: null 
                },
                issues: []
              },
              // REPEAT FOR EACH PARAGRAPH - AI MUST ADD ALL PARAGRAPHS FROM THE DOCUMENT
              // DO NOT LIMIT TO JUST THESE EXAMPLES
            ]
          },
          // REPEAT FOR EACH SECTION - AI MUST ADD ALL SECTIONS FROM THE DOCUMENT
          // DO NOT LIMIT TO JUST THESE EXAMPLES
        ]
    }, null, 2);

    // --- Construct Improved Prompt ---

// --- Construct Improved Prompt with mandatory detailed explanations ---
let fullPrompt = `
You are an expert scientific writing analyzer based on the Mensh & Kording (MnK) 10 Simple Rules paper. Your primary goal is to meticulously analyze the provided paper text and return a COMPLETE and VALID JSON object based EXACTLY on the template provided.

**TASK:**
1. Read the **PAPER TEXT** carefully and completely.
2. Analyze the text based on the **EVALUATION RULES**.
3. **Fill in** the provided **JSON TEMPLATE** with your analysis results. Replace ALL placeholders and null values.

**CRITICAL INSTRUCTION - READ CAREFULLY:**
- You MUST identify and include EVERY SINGLE SECTION and EVERY SINGLE PARAGRAPH from the paper.
- The template shows example formats for sections and paragraphs, but you MUST NOT limit yourself to just those examples.
- Your final JSON MUST include ALL sections and ALL paragraphs from the document, with proper analysis for each.
- Section names should match what's in the document (e.g., "Introduction", "Methods", "Results", "Discussion", etc.)
- If a section has 10 paragraphs, you must include all 10 paragraphs in that section.
- If the document has 8 sections, you must include all 8 sections in your response.

**STRICT EVALUATION STANDARDS:**
When evaluating paragraphs, apply extremely high standards. Paragraphs in scientific writing rarely meet perfect standards. Your default assumption should be that most scientific writing has room for improvement. Use the following strict evaluation criteria:

1. "cccStructure" (Context-Content-Conclusion) - Mark as false unless the paragraph clearly has:
   - A distinct context/topic sentence that introduces the paragraph's main point
   - Well-developed content that supports the topic
   - A clear concluding or transition sentence
   - If any of these three components is missing, mark as false.

2. "sentenceQuality" - Mark as false if you find ANY of these issues:
   - Sentences over 30 words long
   - Passive voice used frequently
   - Vague language or excessive jargon
   - Redundant phrasing
   - Missing or unnecessary punctuation
   - Run-on sentences or sentence fragments

3. "topicContinuity" - Mark as false if:
   - The paragraph discusses multiple unrelated topics
   - Topic shifts occur without clear transitions
   - The focus drifts from the paragraph's initial topic
   - Information appears out of logical order

4. "terminologyConsistency" - Mark as false if:
   - Different terms are used for the same concept
   - Terms are introduced without definition
   - Abbreviations are used inconsistently
   - Technical terms are used in varying ways

5. "structuralParallelism" - Mark as false if:
   - Lists or series don't use parallel structure
   - Similar ideas are presented with inconsistent grammatical structures
   - Sentence patterns vary unnecessarily within related points
   - Inconsistent tense or voice is used for similar actions

When in doubt, mark the evaluation as FALSE and provide specific feedback. The goal is to identify areas for improvement, not to praise mediocre writing.

**MANDATORY ISSUE EXPLANATIONS:**
- For EVERY criterion marked as 'false', you MUST include a detailed explanation in the "issues" array
- Each issue explanation MUST:
  1. Reference the specific MnK rule number
  2. Include a 'severity' rating (critical, major, or minor)
  3. Provide a specific, detailed explanation that references the actual text/problem in the paragraph
  4. Offer a clear recommendation for improvement
- Never mark a criterion as 'false' without adding a corresponding issue explanation
- If multiple criteria are 'false' for a paragraph, include a separate issue entry for EACH failed criterion
- The explanation should be detailed enough that the author can understand exactly what needs to be fixed

**Paragraph Evaluation Details:** For EACH paragraph identified in the text (including the abstract):
* Fill the "evaluations" object using ONLY these EXACT boolean keys: **"cccStructure", "sentenceQuality", "topicContinuity", "terminologyConsistency", "structuralParallelism"**.
* Fill the "issues" array: **IF any evaluation flag is \`false\`, MUST add a corresponding issue object**. Prepend rule-specific feedback with "MnK{ruleNumber}: ". If all flags \`true\`, use \`[]\`.
* Be STRICT in your evaluation. High-quality scientific writing is rare - if you're marking most paragraphs as perfect, you're not being critical enough.
* Every issue MUST be explained in enough detail that the author can understand exactly what's wrong and how to fix it.

**Document Assessment Details:** MUST provide scores (1-10), assessments, recommendations for ALL keys: "titleQuality", "abstractCompleteness", "introductionStructure", "resultsOrganization", "discussionQuality", "messageFocus", "topicOrganization". Prepend rule-specific feedback with "MnK{ruleNumber}: ".

**Major Issues & Recommendations:** Populate these arrays, prepending rule-specific feedback with "MnK{ruleNumber}: ".

**PAPER TEXT:**
\`\`\`
${truncatedText}
\`\`\`

**EVALUATION RULES (Referenced for MnK$ Tags):**
--- Paragraph Rules ---
${paragraphRulesPrompt}
--- Document Rules ---
${documentRulesPrompt}
`;
    

    // Add document structure to the prompt if available
    if (documentStructure && documentStructure.sections && documentStructure.sections.length > 0) {
      fullPrompt += `
**DOCUMENT STRUCTURE DETECTED:**
Title: "${documentStructure.title}"
Sections (${documentStructure.sections.length}):
${documentStructure.sections.map(s => `- ${s.name}: ~${s.paragraphCount} paragraphs`).join('\n')}

Your response MUST include all ${documentStructure.sections.length} sections listed above and analyze all paragraphs in each section (approximately ${documentStructure.sections.reduce((sum, s) => sum + s.paragraphCount, 0)} total paragraphs).`;
    }

    fullPrompt += `

**JSON TEMPLATE TO FILL (Fill ALL fields and replicate section/paragraph structure):**
\`\`\`json
${jsonTemplate}
\`\`\`

**FINAL INSTRUCTIONS:**
- Return ONLY the completed, valid JSON object based on the template.
- Do NOT skip any sections or paragraphs found in the paper apart from references and stray sentences.
- Do NOT limit yourself to the number of example sections/paragraphs shown in the template.
- Include EVERY section and EVERY paragraph with all required evaluations.
- Use boolean \`true\`/\`false\` for paragraph evaluations.
- Generate an 'issue' item whenever a paragraph evaluation is \`false\`.
- Strictly follow the MnK$ tagging requirement.
`;

    // **** Log the full prompt ****
    console.log("\n--- OpenAI Prompt Start (Length:", fullPrompt.length, ") ---\n", fullPrompt, "\n--- OpenAI Prompt End ---\n");

    // --- Make the Single API Call ---
    const requestedMaxTokens = 16384; // Using higher possible output limit
    safeLog('openai-request', `Sending analysis request with max_tokens=${requestedMaxTokens}...`);
    const response = await openai.chat.completions.create({
        model: model,
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

    // --- Validate and potentially retry ---
    if (!validateResults(analysisResult)) {
      console.warn('[AIService] Initial AI analysis failed validation, attempting retry with stronger instructions...');
      
      // Construct a retry prompt with even stronger emphasis
      const retryPrompt = `
IMPORTANT: Your previous analysis did not correctly extract all sections and paragraphs from the document.

You MUST include EVERY section and EVERY paragraph from the document in your analysis. The document clearly has more content than what you included.

Specifically:
1. Identify EACH distinct section in the document (Introduction, Methods, Results, Discussion, etc.)
2. For EACH section, extract and analyze EVERY paragraph within that section
3. Do not skip or summarize multiple paragraphs as one
4. Follow the exact template structure, but include ALL content from the document
${documentStructure ? `
According to my analysis, the document has:
- ${documentStructure.sections.length} sections
- Approximately ${documentStructure.sections.reduce((sum, s) => sum + s.paragraphCount, 0)} paragraphs
Your response must reflect this structure completely.` : ''}

Here's the paper text again:
\`\`\`
${truncatedText}
\`\`\`

Return a complete, valid JSON with ALL sections and paragraphs following the template structure.
`;

      try {
        // Make a retry call with enhanced instructions
        const retryResponse = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'user', content: fullPrompt },
            { role: 'assistant', content: analysisResultRaw }, // Include the previous (incomplete) response
            { role: 'user', content: retryPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: requestedMaxTokens
        });
        
        const retryResultRaw = retryResponse.choices[0]?.message?.content;
        if (!retryResultRaw) { throw new Error("Retry OpenAI response content is empty."); }
        
        try {
          const retryResult = JSON.parse(retryResultRaw);
          if (validateResults(retryResult)) {
            console.log('[AIService] Retry succeeded! Using improved analysis results.');
            analysisResult = retryResult; // Replace with better result
          } else {
            console.warn('[AIService] Retry still failed validation. Using original results but they may be incomplete.');
          }
        } catch (parseError) {
          console.error("[AIService] Failed to parse retry JSON response:", parseError);
        }
      } catch (retryError) {
        console.error('[AIService] Error during retry attempt:', retryError);
      }
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

    // Log section and paragraph count statistics
    const sectionCount = finalResults.sections?.length || 0;
    let paragraphCount = 0;
    finalResults.sections?.forEach(section => {
      paragraphCount += section.paragraphs?.length || 0;
    });

    console.log(`[AIService] Final results: ${sectionCount} sections, ${paragraphCount} paragraphs, ${criticalCount} critical issues, ${majorCount} major issues, ${minorCount} minor issues`);

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
        paragraphCount: paragraphCount,
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


