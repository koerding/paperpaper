// File Path: src/services/AIservice.js
import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
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

// Helper Function to create prompts dynamically using rules.json
function createParagraphAnalysisPrompt(documentText, rules) {
    // Extract relevant paragraph-level rules
    const relevantRules = rules?.rules?.filter(r => ['3B', '4B', '2B'].includes(r.id)) || [];
    const ruleDescriptions = relevantRules.map(r => 
        `- ${r.title}: ${r.fullText}\nCheckpoints:\n${r.checkpoints.map(cp => `  - ${cp.description}`).join('\n')}`
    ).join('\n\n');

    // Construct the prompt
    const prompt = `
Analyze this scientific paper and evaluate ONLY the meaningful content paragraphs.

IMPORTANT FILTERING INSTRUCTIONS:
- Only analyze complete paragraphs that contain scientific content
- Skip titles, author information, section headers, and figure captions
- Skip references, acknowledgments, data availability statements, and conflict of interest sections
- Skip isolated sentences, bullet points, lists, highlights, and metadata
- Skip equations and mathematical formulas presented on their own lines
- Skip single-sentence paragraphs

Evaluate each content paragraph based on these rules:
${ruleDescriptions}

For each paragraph you identify, analyze:

1. Context-Content-Conclusion (CCC) structure:
   - First sentence should provide context or introduce the topic
   - Middle sentences should provide evidence, data, or elaboration
   - Final sentence should offer a conclusion, summarize, or connect to broader implications
   - The paragraph should form a complete thought unit with clear beginning, middle, and end

2. Sentence quality:
   - Average sentence length under 25 words
   - No sentence exceeding 40 words
   - Appropriate readability for scientific literature
   - Logical structures (if-then, cause-effect) not nested more than two levels deep

3. Topic continuity:
   - Single focused topic per paragraph
   - Logical progression of ideas
   - No sudden shifts in subject matter
   - Paragraph focused on a single idea or step (4-6 sentences ideal)

4. Terminology consistency:
   - Same terms used for same concepts throughout
   - No synonyms that could suggest different meanings
   - Consistent use of technical terms
   - Important terms defined before use

5. Structural parallelism:
   - Similar concepts presented with similar grammatical structures
   - Items in lists or series use parallel grammatical forms
   - Sequence of similar points follow consistent structural patterns
   - Consistent patterns when presenting related information

Return your analysis as a valid JSON object STRICTLY following this structure:
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
          "issue": "Specific description of the issue found based on rules",
          "rule_id": "ID of the rule violated (e.g., 'cccStructure')",
          "severity": "critical | major | minor",
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

Text to Analyze:
--- START TEXT ---
${documentText}
--- END TEXT ---

Ensure the output is ONLY the JSON object, without any introductory text or explanations.
`;
    return [{ role: "user", content: prompt }];
}

function createDocumentAnalysisPrompt(title, abstractText, paragraphAnalysisResults, rules) {
    // Extract relevant document-level rules
    const relevantRules = rules?.rules?.filter(r => ['1', '5', '6', '7A', '8A', '8B', '8C'].includes(r.id)) || [];
    const ruleDescriptions = relevantRules.map(r => 
        `- ${r.title}: ${r.fullText}\nCheckpoints:\n${r.checkpoints.map(cp => `  - ${cp.description}`).join('\n')}`
    ).join('\n\n');

    // Count paragraph issues for context
    let criticalCount = 0;
    let majorCount = 0;
    let minorCount = 0;
    
    paragraphAnalysisResults?.paragraphs?.forEach(p => {
        p.issues?.forEach(iss => {
            if (iss.severity === 'critical') criticalCount++;
            if (iss.severity === 'major') majorCount++;
            if (iss.severity === 'minor') minorCount++;
        });
    });
    
    const issueSummary = (criticalCount > 0 || majorCount > 0 || minorCount > 0) 
        ? `Paragraph analysis found: Critical: ${criticalCount}, Major: ${majorCount}, Minor: ${minorCount} issues.`
        : "No major paragraph issues detected.";

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
  },
  "overallRecommendations": [
    "Top suggestion 1",
    "Top suggestion 2",
    "Top suggestion 3"
  ],
  "statistics": {
    "critical": ${criticalCount},
    "major": ${majorCount},
    "minor": ${minorCount}
  }
}

Paper Information:
Title: ${title || 'Not Provided'}
Abstract: ${abstractText || 'Not Provided'}
Paragraph Issue Summary: ${issueSummary}

Provide ONLY the JSON object as output. Base scores and assessments on how well the title/abstract seem to align with the rules provided. Provide actionable recommendations. The statistics should reflect the paragraph-level issues found.
`;
    return [{ role: "user", content: prompt }];
}

// --- Main Analysis Function ---
export async function analyzeDocumentStructure(document, rawText) {
    console.log('[AIService] >>>>>>>>>> Starting document structure analysis...');
    const serviceStartTime = Date.now();
    try {
        // ENHANCED DEBUGGING - Save input text
        await writeDebugFile('00-input-raw-text', rawText);
        
        if (!paperRules) {
             throw new Error("Analysis rules could not be loaded.");
        }

        let structuredDoc = document;

        // Step 1: Get Base Structure
        if (!structuredDoc || !structuredDoc.sections || structuredDoc.sections.length === 0) {
            if (!rawText) throw new Error("Analysis requires either document structure or raw text.");
            console.log('[AIService] Obtaining base document structure via ProcessingService...');
            structuredDoc = await parseStructure(rawText);
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

        // Step 2: Initialize OpenAI Client
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key not configured for AIService.");
        }
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = process.env.OPENAI_MODEL || 'gpt-4o'; // Or your preferred model

        // Step 3: Perform Paragraph Analysis
        console.log('[AIService] Starting paragraph analysis...');
        
        // Prepare full document text for analysis
        let fullText = '';
        if (structuredDoc.title) fullText += structuredDoc.title + '\n\n';
        if (structuredDoc.abstract?.text) fullText += structuredDoc.abstract.text + '\n\n';
        
        structuredDoc.sections?.forEach(section => {
            if (section.name) fullText += section.name + '\n\n';
            section.paragraphs?.forEach(para => {
                if (para.text) fullText += para.text + '\n\n';
            });
        });
        
        // If no structured text was generated, fall back to raw text
        if (!fullText.trim() && rawText) {
            fullText = rawText;
        }
        
        await writeDebugFile('02-full-text-for-analysis', fullText);
        
        // Analyze paragraphs
        const paragraphPromptMessages = createParagraphAnalysisPrompt(fullText, paperRules);
        await writeDebugFile('03-paragraph-prompt', paragraphPromptMessages);
        
        let paragraphAnalysisResults;
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: paragraphPromptMessages,
                response_format: { type: "json_object" },
                temperature: 0.2
            });
            
            const resultText = response.choices[0]?.message?.content;
            console.log(`[AIService] Raw paragraph analysis response received (${resultText?.length || 0} chars)`);
            await writeDebugFile('04-paragraph-response', resultText);
            
            paragraphAnalysisResults = JSON.parse(resultText);
            await writeDebugFile('05-paragraph-analysis-parsed', paragraphAnalysisResults);
            
            // Validate structure
            if (!paragraphAnalysisResults.paragraphs || !Array.isArray(paragraphAnalysisResults.paragraphs)) {
                console.error('[AIService] Invalid paragraph analysis structure. Missing paragraphs array.');
                paragraphAnalysisResults = { paragraphs: [] };
            }
            
        } catch (error) {
            console.error(`[AIService] Error during paragraph analysis:`, error);
            paragraphAnalysisResults = { paragraphs: [] };
        }
        
        console.log(`[AIService] Paragraph analysis complete. Found ${paragraphAnalysisResults.paragraphs?.length || 0} paragraphs.`);

        // Step 4: Perform Document-Level Analysis
        console.log('[AIService] Starting document-level analysis...');
        const documentPromptMessages = createDocumentAnalysisPrompt(
            structuredDoc.title,
            structuredDoc.abstract?.text,
            paragraphAnalysisResults,
            paperRules
        );
        
        await writeDebugFile('06-document-level-prompt', documentPromptMessages);
        
        let documentAnalysis;
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: documentPromptMessages,
                response_format: { type: "json_object" },
                temperature: 0.3
            });
            
            const resultText = response.choices[0]?.message?.content;
            console.log(`[AIService] Raw document analysis response received (${resultText?.length || 0} chars)`);
            await writeDebugFile('07-document-level-response', resultText);
            
            documentAnalysis = JSON.parse(resultText);
            await writeDebugFile('08-document-analysis-parsed', documentAnalysis);
            
        } catch (error) {
            console.error(`[AIService] Error during document-level analysis:`, error);
            documentAnalysis = { 
                documentAssessment: {}, 
                overallRecommendations: [],
                statistics: { critical: 0, major: 0, minor: 0 }
            };
        }
        
        console.log('[AIService] Document-level analysis complete.');

        // Step 5: Merge Results and Create Prioritized Issues
        console.log('[AIService] Merging and prioritizing results...');
        
        // Extract and prioritize issues from paragraphs
        const prioritizedIssues = createPrioritizedIssues(paragraphAnalysisResults.paragraphs || []);
        await writeDebugFile('09-prioritized-issues', prioritizedIssues);
        
        // Prepare final results
        const finalResults = {
            title: structuredDoc.title || "Title Not Found",
            abstract: {
                text: structuredDoc.abstract?.text || "",
                summary: structuredDoc.abstract?.summary || "",
                issues: []  // Abstract issues would be populated if we analyzed the abstract separately
            },
            documentAssessment: documentAnalysis?.documentAssessment || {},
            overallRecommendations: documentAnalysis?.overallRecommendations || [],
            statistics: documentAnalysis?.statistics || { critical: 0, major: 0, minor: 0 },
            prioritizedIssues: prioritizedIssues,
            sections: [{
                name: "Content", 
                paragraphs: paragraphAnalysisResults.paragraphs || []
            }]
        };

        await writeDebugFile('10-final-results', finalResults);

        const serviceEndTime = Date.now();
        console.log(`[AIService] <<<<<<<<<< Analysis completed. Duration: ${serviceEndTime - serviceStartTime}ms`);
        
        return finalResults;

    } catch (error) {
        const serviceEndTime = Date.now();
        console.error(`[AIService] <<<<<<<<<< Error in analyzeDocumentStructure (Duration: ${serviceEndTime - serviceStartTime}ms):`, error);
        
        return {
            analysisError: `Failed to complete analysis: ${error.message}`,
            title: "Analysis Failed",
            abstract: { text: "" },
            documentAssessment: {},
            overallRecommendations: [],
            statistics: { critical: 0, major: 0, minor: 0 },
            prioritizedIssues: [],
            sections: []
        };
    }
}

// Helper function to create prioritized issues list
function createPrioritizedIssues(paragraphs) {
    const allIssues = [];
    
    // Collect all issues with location information
    paragraphs.forEach((para, pIdx) => {
        if (Array.isArray(para.issues)) {
            para.issues.forEach(issue => {
                allIssues.push({
                    ...issue,
                    location: `Paragraph ${pIdx + 1} (starting with: "${para.text_preview || 'unknown'}")`
                });
            });
        }
    });
    
    // Sort by severity
    const sortedIssues = allIssues.sort((a, b) => {
        const severityOrder = { 'critical': 0, 'major': 1, 'minor': 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    return sortedIssues;
}
