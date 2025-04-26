// File Path: src/services/AIService.js
import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { extractDocumentStructure as parseStructure } from './ProcessingService.js';

// --- Load Rules Files ---
let paragraphRules = null;
let documentRules = null;

try {
    // Load paragraph-level rules
    const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
    const paragraphRulesRaw = fs.readFileSync(paragraphRulesPath, 'utf-8');
    paragraphRules = JSON.parse(paragraphRulesRaw);
    console.log("[AIService] Successfully loaded paragraph-rules.json");
    
    // Load document-level rules
    const documentRulesPath = path.join(process.cwd(), 'src', 'document-rules.json');
    const documentRulesRaw = fs.readFileSync(documentRulesPath, 'utf-8');
    documentRules = JSON.parse(documentRulesRaw);
    console.log("[AIService] Successfully loaded document-rules.json");
} catch (err) {
    console.error("[AIService] ERROR: Failed to load or parse rules files.", err);
    // Initialize with empty rules if loading fails
    paragraphRules = { rules: [] };
    documentRules = { rules: [] };
}

// Debug helper
const writeDebugFile = async (prefix, content) => {
    try {
        const debugDir = path.join(process.cwd(), 'debug_logs');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(debugDir, `${prefix}-${timestamp}.json`);
        
        fs.writeFileSync(filename, typeof content === 'object' 
            ? JSON.stringify(content, null, 2) : content);
        return filename;
    } catch (err) {
        console.error(`[AIService Debug] Failed to write debug file for ${prefix}:`, err);
        return null;
    }
};

// Create paragraph analysis prompt using paragraph-level rules
function createParagraphAnalysisPrompt(documentText) {
    // Extract relevant rules
    const rules = paragraphRules.rules || [];
    const cccRule = rules.find(r => r.id === '3B') || { 
        fullText: "The C-C-C scheme defines the structure of the paper on multiple scales. Applying C-C-C at the paragraph scale, the first sentence defines the topic or context, the body hosts the novel content put forth for the reader's consideration, and the last sentence provides the conclusion to be remembered.",
        checkpoints: []
    };
    
    // Get checkpoints for CCC structure
    const cccCheckpoints = (cccRule.checkpoints || [])
        .map(cp => `   - ${cp.description}`)
        .join('\n');
    
    // Get cognitive load rule
    const cognitiveLoadRule = rules.find(r => r.id === '2B') || {
        fullText: "Manage cognitive load for your readers by using appropriate sentence length and complexity.",
        checkpoints: []
    };
    
    // Get parallelism rule
    const parallelismRule = rules.find(r => r.id === '4B') || {
        fullText: "Use parallel structure for similar concepts and consistent terminology.",
        checkpoints: []
    };
    
    return [{
        role: "user",
        content: `
Analyze the paragraphs in this scientific paper according to these structural rules from "Ten simple rules for structuring papers":

1. Context-Content-Conclusion Structure (Rule 3B):
${cccRule.fullText}

Checkpoints for C-C-C structure:
${cccCheckpoints}

2. Cognitive Load Management (Rule 2B):
${cognitiveLoadRule.fullText}

3. Structural Parallelism (Rule 4B):
${parallelismRule.fullText}

For each paragraph, evaluate all criteria rigorously. Be very strict about the C-C-C structure requirement.
If a paragraph ends without a proper concluding sentence that provides a key takeaway or summarizes the main point, 
mark it as failing C-C-C structure (set cccStructure to false).

Return a JSON object with this structure:
{
  "paragraphs": [
    {
      "text_preview": "First ~50 chars of paragraph...", 
      "summary": "Brief summary of paragraph content",
      "evaluations": {
        "cccStructure": boolean,
        "sentenceQuality": boolean,
        "topicContinuity": boolean,
        "terminologyConsistency": boolean,
        "structuralParallelism": boolean
      },
      "issues": [
        {
          "issue": "Description of the issue found",
          "rule_id": "cccStructure",
          "severity": "critical | major | minor",
          "recommendation": "Specific suggestion for improvement"
        }
      ]
    }
  ]
}

TEXT TO ANALYZE:
${documentText}

Respond ONLY with the JSON object.`
    }];
}

// Create document-level analysis prompt using document-level rules
function createDocumentAnalysisPrompt(title, abstractText, paragraphIssues, criticalCount, majorCount, minorCount) {
    // Extract relevant rules from document-rules.json
    const rules = documentRules.rules || [];
    
    // Get title rule
    const titleRule = rules.find(r => r.id === '1');
    const titleRuleText = titleRule ? 
        titleRule.fullText.substring(0, 150) + "..." : 
        "Focus on a single message in the title; the title should communicate the central contribution.";
    
    // Get abstract rule
    const abstractRule = rules.find(r => r.id === '5');
    const abstractRuleText = abstractRule ? 
        abstractRule.fullText.substring(0, 150) + "..." : 
        "The abstract must tell a complete story with context, gap, approach, results, and significance.";
    
    // Get introduction rule
    const introRule = rules.find(r => r.id === '6');
    const introRuleText = introRule ? 
        introRule.fullText.substring(0, 150) + "..." : 
        "The introduction should highlight the gap in knowledge and why it matters.";
    
    return [{
        role: "user",
        content: `
Evaluate this scientific paper's overall structure using these key rules from "Ten Simple Rules for Structuring Papers":

1. Title Quality (Rule 1): 
${titleRuleText}

2. Abstract Completeness (Rule 5):
${abstractRuleText}

3. Introduction Effectiveness (Rule 6):
${introRuleText}

4. Results Organization:
Results should be presented in logical order that builds toward the central claim.

5. Discussion Quality:
Discussion should explain how results fill the gap, address limitations, and explain broader impact.

6. Single Message Focus:
Paper should focus on a single central contribution rather than multiple disconnected topics.

7. Topic Organization:
Topics should be discussed in a consolidated way (avoiding zig-zag between subjects).

Based on the provided information, evaluate these aspects on a scale of 1-10,
provide a brief assessment for each, and suggest improvements.

Return a JSON object with this structure:
{
  "documentAssessment": {
    "titleQuality": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" },
    "abstractCompleteness": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" },
    "introductionEffectiveness": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" },
    "resultsOrganization": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" },
    "discussionQuality": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" },
    "singleMessageFocus": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" },
    "topicOrganization": { "score": 1-10, "assessment": "Evaluation", "recommendation": "Suggestion" }
  },
  "overallRecommendations": [
    "Top priority suggestion",
    "Second suggestion",
    "Third suggestion"
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
Paragraph Issues: Found ${criticalCount} critical, ${majorCount} major, ${minorCount} minor issues.
${paragraphIssues ? `Issue Details: ${paragraphIssues}` : ''}

Respond ONLY with the JSON object.`
    }];
}

// Main analysis function
export async function analyzeDocumentStructure(document, rawText) {
    console.log('[AIService] Starting document structure analysis...');
    const serviceStartTime = Date.now();
    
    try {
        await writeDebugFile('00-input-raw-text', rawText);
        
        // Verify rules were loaded
        if (!paragraphRules || !paragraphRules.rules || paragraphRules.rules.length === 0) {
            console.warn("[AIService] Warning: Paragraph rules not properly loaded");
        }
        if (!documentRules || !documentRules.rules || documentRules.rules.length === 0) {
            console.warn("[AIService] Warning: Document rules not properly loaded");
        }
        
        // Get document structure
        let structuredDoc = document;
        if (!structuredDoc || !structuredDoc.sections || structuredDoc.sections.length === 0) {
            if (!rawText) throw new Error("Analysis requires document structure or raw text.");
            structuredDoc = await parseStructure(rawText);
            await writeDebugFile('01-parsed-structure', structuredDoc);
        }
        
        // Prepare full text for analysis
        let fullText = '';
        if (structuredDoc.title) fullText += structuredDoc.title + '\n\n';
        if (structuredDoc.abstract?.text) fullText += structuredDoc.abstract.text + '\n\n';
        
        structuredDoc.sections?.forEach(section => {
            if (section.name) fullText += section.name + '\n\n';
            section.paragraphs?.forEach(para => {
                if (para.text) fullText += para.text + '\n\n';
            });
        });
        
        if (!fullText.trim() && rawText) fullText = rawText;
        await writeDebugFile('02-full-text-for-analysis', fullText);
        
        // Check if OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key not configured");
        }
        
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = process.env.OPENAI_MODEL || 'gpt-4o';
        
        // Analyze paragraphs using paragraph-level rules
        console.log('[AIService] Starting paragraph analysis with paragraph-level rules...');
        const paragraphPromptMessages = createParagraphAnalysisPrompt(fullText);
        await writeDebugFile('03-paragraph-prompt', paragraphPromptMessages);
        
        let paragraphAnalysisResults;
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: paragraphPromptMessages,
                response_format: { type: "json_object" },
                temperature: 0.1 // Lower temperature for more consistent results
            });
            
            const resultText = response.choices[0]?.message?.content;
            await writeDebugFile('04-paragraph-response', resultText);
            
            paragraphAnalysisResults = JSON.parse(resultText);
            await writeDebugFile('05-paragraph-analysis', paragraphAnalysisResults);
            
            if (!paragraphAnalysisResults.paragraphs) {
                paragraphAnalysisResults = { paragraphs: [] };
            }
        } catch (error) {
            console.error('[AIService] Error during paragraph analysis:', error);
            paragraphAnalysisResults = { paragraphs: [] };
        }
        
        // Extract issues and create prioritized list
        const paragraphs = paragraphAnalysisResults.paragraphs || [];
        const prioritizedIssues = [];
        
        let criticalCount = 0, majorCount = 0, minorCount = 0;
        
        paragraphs.forEach((para, pIdx) => {
            if (Array.isArray(para.issues)) {
                para.issues.forEach(issue => {
                    if (issue.severity === 'critical') criticalCount++;
                    if (issue.severity === 'major') majorCount++;
                    if (issue.severity === 'minor') minorCount++;
                    
                    prioritizedIssues.push({
                        ...issue,
                        location: `Paragraph ${pIdx + 1} (starting with: "${para.text_preview || 'unknown'}")`
                    });
                });
            }
        });
        
        // Sort issues by severity
        prioritizedIssues.sort((a, b) => {
            const severityOrder = { 'critical': 0, 'major': 1, 'minor': 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        
        await writeDebugFile('06-prioritized-issues', prioritizedIssues);
        
        // Create a summary of issues for document analysis
        const issuesSummary = prioritizedIssues.length > 0 ?
            prioritizedIssues.map(issue => 
                `- ${issue.severity.toUpperCase()}: ${issue.issue} (${issue.location})`
            ).join('\n') : 'No specific issues found.';
        
        // Document analysis using document-level rules
        console.log('[AIService] Starting document-level analysis with document-level rules...');
        const documentPromptMessages = createDocumentAnalysisPrompt(
            structuredDoc.title,
            structuredDoc.abstract?.text,
            issuesSummary,
            criticalCount,
            majorCount,
            minorCount
        );
        
        await writeDebugFile('07-document-prompt', documentPromptMessages);
        
        let documentAnalysis;
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: documentPromptMessages,
                response_format: { type: "json_object" },
                temperature: 0.2
            });
            
            const resultText = response.choices[0]?.message?.content;
            await writeDebugFile('08-document-response', resultText);
            
            documentAnalysis = JSON.parse(resultText);
            await writeDebugFile('09-document-analysis', documentAnalysis);
        } catch (error) {
            console.error('[AIService] Error during document analysis:', error);
            documentAnalysis = { 
                documentAssessment: {}, 
                overallRecommendations: [],
                statistics: { critical: criticalCount, major: majorCount, minor: minorCount }
            };
        }
        
        // Final results
        const finalResults = {
            title: structuredDoc.title || "Title Not Found",
            abstract: {
                text: structuredDoc.abstract?.text || "",
                summary: structuredDoc.abstract?.summary || "",
                issues: []
            },
            documentAssessment: documentAnalysis?.documentAssessment || {},
            overallRecommendations: documentAnalysis?.overallRecommendations || [],
            statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
            prioritizedIssues: prioritizedIssues,
            sections: [{ name: "Content", paragraphs: paragraphs }]
        };
        
        await writeDebugFile('10-final-results', finalResults);
        console.log(`[AIService] Analysis completed in ${Date.now() - serviceStartTime}ms`);
        
        return finalResults;
    } catch (error) {
        console.error('[AIService] Error in document analysis:', error);
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
