// File Path: src/services/AIService.js
import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { extractDocumentStructure as parseStructure } from './ProcessingService.js';

// Load rules files
let paragraphRules = null;
let documentRules = null;

try {
    const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
    const documentRulesPath = path.join(process.cwd(), 'src', 'document-rules.json');
    
    paragraphRules = JSON.parse(fs.readFileSync(paragraphRulesPath, 'utf-8'));
    documentRules = JSON.parse(fs.readFileSync(documentRulesPath, 'utf-8'));
    
    console.log("[AIService] Successfully loaded rules files");
} catch (err) {
    console.error("[AIService] Error loading rules files:", err);
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
        console.error(`[AIService] Debug file error:`, err);
        return null;
    }
};

// Create minimalist paragraph analysis prompt
function createParagraphAnalysisPrompt(documentText) {
    return [{
        role: "user",
        content: `
Here are the rules for evaluating paragraph structure in scientific papers:
${JSON.stringify(paragraphRules)}

Be very rigorous and critical in your evaluation. Analyze each paragraph and identify any structural issues.
Be especially strict about Context-Content-Conclusion structure - the final sentence of a paragraph must 
provide a clear conclusion or key takeaway.

Return a JSON object with this structure:
{
  "paragraphs": [
    {
      "text": "The complete paragraph text",
      "summary": "Brief summary of content",
      "evaluations": {
        "cccStructure": boolean,
        "sentenceQuality": boolean,
        "topicContinuity": boolean, 
        "terminologyConsistency": boolean,
        "structuralParallelism": boolean
      },
      "issues": [
        {
          "issue": "Description of issue",
          "rule_id": "ruleId",
          "severity": "critical | major | minor",
          "recommendation": "Improvement suggestion"
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

// Create minimalist document analysis prompt
function createDocumentAnalysisPrompt(title, abstractText, issuesSummary, criticalCount, majorCount, minorCount) {
    return [{
        role: "user",
        content: `
Here are the rules for evaluating document structure in scientific papers:
${JSON.stringify(documentRules)}

Be precise and helpful in your evaluation. Assess the document based on these rules.

Return a JSON object with this structure:
{
  "documentAssessment": {
    "titleQuality": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "abstractCompleteness": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "introductionEffectiveness": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "resultsOrganization": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "discussionQuality": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "singleMessageFocus": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "topicOrganization": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" }
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
Paragraph Issues: ${criticalCount} critical, ${majorCount} major, ${minorCount} minor
${issuesSummary ? `Issues Details: ${issuesSummary}` : ''}

Respond ONLY with the JSON object.`
    }];
}

// Main analysis function
export async function analyzeDocumentStructure(document, rawText) {
    console.log('[AIService] Starting analysis...');
    const serviceStartTime = Date.now();
    
    try {
        await writeDebugFile('00-input-raw-text', rawText);
        
        // Get document structure
        let structuredDoc = document;
        if (!structuredDoc || !structuredDoc.sections || structuredDoc.sections.length === 0) {
            if (!rawText) throw new Error("Analysis requires document structure or raw text.");
            structuredDoc = await parseStructure(rawText);
            await writeDebugFile('01-parsed-structure', structuredDoc);
        }
        
        // Prepare full text
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
        await writeDebugFile('02-full-text', fullText);
        
        // Check OpenAI API
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key not configured");
        }
        
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = process.env.OPENAI_MODEL || 'gpt-4o';
        
        // 1. Paragraph analysis
        console.log('[AIService] Starting paragraph analysis...');
        const paragraphPrompt = createParagraphAnalysisPrompt(fullText);
        await writeDebugFile('03-paragraph-prompt', paragraphPrompt);
        
        let paragraphResults;
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: paragraphPrompt,
                response_format: { type: "json_object" },
                temperature: 0.1
            });
            
            paragraphResults = JSON.parse(response.choices[0]?.message?.content);
            await writeDebugFile('04-paragraph-results', paragraphResults);
            
            if (!paragraphResults.paragraphs) {
                paragraphResults = { paragraphs: [] };
            }
        } catch (error) {
            console.error('[AIService] Paragraph analysis error:', error);
            paragraphResults = { paragraphs: [] };
        }
        
        // Process issues
        const paragraphs = paragraphResults.paragraphs || [];
        const prioritizedIssues = [];
        
        let criticalCount = 0, majorCount = 0, minorCount = 0;
        
        paragraphs.forEach((para, idx) => {
            if (Array.isArray(para.issues)) {
                para.issues.forEach(issue => {
                    if (issue.severity === 'critical') criticalCount++;
                    if (issue.severity === 'major') majorCount++;
                    if (issue.severity === 'minor') minorCount++;
                    
                    // Create a text preview for issue location (first 50 chars)
                    const textPreview = para.text ? para.text.substring(0, 50) + '...' : 'unknown';
                    
                    prioritizedIssues.push({
                        ...issue,
                        location: `Paragraph ${idx + 1} (starting with: "${textPreview}")`
                    });
                });
            }
        });
        
        // Sort issues by severity
        prioritizedIssues.sort((a, b) => {
            const severityOrder = { 'critical': 0, 'major': 1, 'minor': 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        
        // Prepare issues summary
        const issuesSummary = prioritizedIssues.length > 0 ?
            prioritizedIssues.slice(0, 5).map(issue => // Only include top 5 issues
                `${issue.severity.toUpperCase()}: ${issue.issue}`
            ).join('; ') : 'No issues found.';
        
        // 2. Document analysis
        console.log('[AIService] Starting document analysis...');
        const documentPrompt = createDocumentAnalysisPrompt(
            structuredDoc.title,
            structuredDoc.abstract?.text,
            issuesSummary,
            criticalCount,
            majorCount,
            minorCount
        );
        
        await writeDebugFile('05-document-prompt', documentPrompt);
        
        let documentResults;
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: documentPrompt,
                response_format: { type: "json_object" },
                temperature: 0.2
            });
            
            documentResults = JSON.parse(response.choices[0]?.message?.content);
            await writeDebugFile('06-document-results', documentResults);
        } catch (error) {
            console.error('[AIService] Document analysis error:', error);
            documentResults = { 
                documentAssessment: {}, 
                overallRecommendations: [],
                statistics: { critical: criticalCount, major: majorCount, minor: minorCount }
            };
        }
        
        // 3. Create final results
        const finalResults = {
            title: structuredDoc.title || "Title Not Found",
            abstract: {
                text: structuredDoc.abstract?.text || "",
                summary: structuredDoc.abstract?.summary || "",
                issues: []
            },
            documentAssessment: documentResults?.documentAssessment || {},
            overallRecommendations: documentResults?.overallRecommendations || [],
            statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
            prioritizedIssues: prioritizedIssues,
            sections: [{ name: "Content", paragraphs: paragraphs }]
        };
        
        await writeDebugFile('07-final-results', finalResults);
        console.log(`[AIService] Analysis completed in ${Date.now() - serviceStartTime}ms`);
        
        return finalResults;
    } catch (error) {
        console.error('[AIService] Analysis error:', error);
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
