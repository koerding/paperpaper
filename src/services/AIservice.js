// File Path: src/services/AIService.js
import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Load rules files for reference only (will be included in prompts)
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

// Main analysis function
export async function analyzeDocumentStructure(document, rawText) {
    console.log('[AIService] Starting analysis...');
    const serviceStartTime = Date.now();
    
    try {
        // Save input text for debugging
        await writeDebugFile('00-input-raw-text', rawText);
        
        // Check OpenAI API
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key not configured");
        }
        
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = process.env.OPENAI_MODEL || 'gpt-4o';
        
        // Create unified prompt that handles both parsing and analysis
        const unifiedPrompt = [{
            role: "system",
            content: `You are a scientific paper structure analyzer that performs two tasks:
1. Extract the document structure (title, abstract, sections, paragraphs)
2. Evaluate the structural quality against scientific writing best practices
            
Both tasks must be integrated into a single structured response.`
        }, {
            role: "user",
            content: `I need you to analyze this scientific paper. Complete the analysis in two steps:

STEP 1: Parse the document structure by extracting:
- The paper title
- The abstract
- All sections with their paragraphs

STEP 2: Evaluate each paragraph for:
- Context-Content-Conclusion structure
- Sentence quality (length under 25 words on average)
- Topic continuity
- Terminology consistency
- Structural parallelism

Then evaluate the document as a whole for:
- Title quality
- Abstract completeness
- Introduction effectiveness
- Results organization
- Discussion quality
- Single message focus
- Topic organization

Use these evaluation rules for reference:
${JSON.stringify(paragraphRules)}
${JSON.stringify(documentRules)}

Be rigorous in your evaluation. A paragraph has good CCC structure only if the first sentence provides context, middle sentences provide content, and the last sentence provides a clear conclusion.

Return a JSON object with this combined structure:
{
  "title": "The extracted paper title",
  "abstract": {
    "text": "The complete abstract text",
    "summary": "Brief summary of abstract content",
    "issues": [
      {
        "issue": "Description of issue",
        "severity": "critical | major | minor",
        "recommendation": "Improvement suggestion"
      }
    ]
  },
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
  "sections": [
    {
      "name": "Section name (e.g., Introduction, Methods, etc.)",
      "paragraphs": [
        {
          "text": "Full text of paragraph",
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
              "severity": "critical | major | minor",
              "recommendation": "Improvement suggestion"
            }
          ]
        }
      ]
    }
  ]
}

PAPER TEXT:
${rawText || "No text provided"}

Respond ONLY with the JSON object.`
        }];
        
        // Log the prompt
        await writeDebugFile('01-unified-prompt', unifiedPrompt);
        
        // Make API call
        console.log('[AIService] Sending unified document parsing and analysis request...');
        const response = await openai.chat.completions.create({
            model: model,
            messages: unifiedPrompt,
            response_format: { type: "json_object" },
            temperature: 0.1
        });
        
        // Parse response
        const analysisResult = JSON.parse(response.choices[0]?.message?.content);
        await writeDebugFile('02-analysis-result', analysisResult);
        
        // Calculate issue statistics
        let criticalCount = 0, majorCount = 0, minorCount = 0;
        const prioritizedIssues = [];
        
        // Process abstract issues
        if (analysisResult.abstract && Array.isArray(analysisResult.abstract.issues)) {
            analysisResult.abstract.issues.forEach(issue => {
                if (issue.severity === 'critical') criticalCount++;
                if (issue.severity === 'major') majorCount++;
                if (issue.severity === 'minor') minorCount++;
                
                prioritizedIssues.push({
                    ...issue,
                    location: 'Abstract'
                });
            });
        }
        
        // Process paragraph issues
        if (Array.isArray(analysisResult.sections)) {
            analysisResult.sections.forEach(section => {
                if (Array.isArray(section.paragraphs)) {
                    section.paragraphs.forEach((para, idx) => {
                        if (Array.isArray(para.issues)) {
                            para.issues.forEach(issue => {
                                if (issue.severity === 'critical') criticalCount++;
                                if (issue.severity === 'major') majorCount++;
                                if (issue.severity === 'minor') minorCount++;
                                
                                // Create a text preview for issue location
                                const textPreview = para.text ? para.text.substring(0, 50) + '...' : 'unknown';
                                
                                prioritizedIssues.push({
                                    ...issue,
                                    location: `${section.name}: Paragraph ${idx + 1} (starting with: "${textPreview}")`
                                });
                            });
                        }
                    });
                }
            });
        }
        
        // Sort issues by severity
        prioritizedIssues.sort((a, b) => {
            const severityOrder = { 'critical': 0, 'major': 1, 'minor': 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        
        // Create final results
        const finalResults = {
            title: analysisResult.title || "Title Not Found",
            abstract: analysisResult.abstract || { text: "", summary: "", issues: [] },
            documentAssessment: analysisResult.documentAssessment || {},
            overallRecommendations: analysisResult.overallRecommendations || [],
            statistics: { critical: criticalCount, major: majorCount, minor: minorCount },
            prioritizedIssues: prioritizedIssues,
            sections: analysisResult.sections || []
        };
        
        await writeDebugFile('03-final-results', finalResults);
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
