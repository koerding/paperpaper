// Improved AIService.js with no file system debug logging

import { default as OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Safe console logging that won't break in production
const safeLog = (prefix, message) => {
  try {
    console.log(`[AIService] ${prefix}: ${typeof message === 'object' ? JSON.stringify(message).substring(0, 200) + '...' : message}`);
  } catch (error) {
    console.log(`[AIService] Error logging ${prefix}`);
  }
};

// Load rule JSON files - with robust error handling
const loadRules = () => {
  try {
    // Load paragraph-level rules
    let paragraphRules;
    let documentRules;
    
    try {
      // Try loading from filesystem first
      const paragraphRulesPath = path.join(process.cwd(), 'src', 'paragraph-rules.json');
      paragraphRules = JSON.parse(fs.readFileSync(paragraphRulesPath, 'utf8'));
      
      // Load document-level rules
      const documentRulesPath = path.join(process.cwd(), 'src', 'document-rules.json');
      documentRules = JSON.parse(fs.readFileSync(documentRulesPath, 'utf8'));
      
      console.log('[AIService] Successfully loaded paragraph and document rules from files');
    } catch (fsError) {
      console.error('[AIService] Could not load rules from filesystem:', fsError);
      console.log('[AIService] Using hardcoded default rules');
      
      // Provide simplified default rules if file access fails
      paragraphRules = {
        rules: [
          {
            id: "3B",
            title: "Apply context-content-conclusion structure at the paragraph level",
            fullText: "Each paragraph should have a clear structure with context, content, and conclusion.",
            checkpoints: [
              { description: "First sentence establishes context or introduces the topic" },
              { description: "Middle sentences provide evidence, data, or elaboration of the topic" },
              { description: "Final sentence offers a conclusion or key takeaway" }
            ]
          },
          {
            id: "2B", 
            title: "Manage cognitive load for your readers",
            fullText: "Keep sentences at a reasonable length and limit complexity.",
            checkpoints: [
              { description: "Average sentence length is under 25 words" },
              { description: "No more than 2-3 new technical concepts are introduced per paragraph" }
            ]
          }
        ]
      };
      
      documentRules = {
        rules: [
          {
            id: "5",
            title: "Tell a complete story in the abstract",
            fullText: "The abstract should contain all key elements of the paper in miniature.",
            checkpoints: [
              { description: "Abstract begins with broad context before narrowing to specific research gap" },
              { description: "Abstract explicitly identifies the specific gap or problem the research addresses" },
              { description: "Abstract ends with interpretation of results and statement of broader significance" }
            ]
          },
          {
            id: "1",
            title: "Focus your paper on a central contribution",
            fullText: "The paper should have a clear single main message.",
            checkpoints: [
              { description: "Title explicitly contains the main finding or central contribution" },
              { description: "Abstract presents a single focused message rather than multiple distinct claims" },
              { description: "Different sections consistently support the same central contribution" }
            ]
          }
        ]
      };
    }
    
    return { paragraphRules, documentRules };
  } catch (error) {
    console.error('[AIService] Error loading rules:', error);
    // Return minimal default rules rather than throwing
    return { 
      paragraphRules: { rules: [] },
      documentRules: { rules: [] }
    };
  }
};

// Phase 1: Extract document structure only
async function extractDocumentStructure(openai, model, rawText) {
    console.log('[AIService] Phase 1: Extracting document structure...');
    
    const structurePrompt = [{
        role: "system",
        content: "You are a scientific paper structure analyzer that extracts the document organization precisely."
    }, {
        role: "user",
        content: `Extract the structure of this scientific paper, identifying:
1. The paper title
2. The abstract
3. All sections with their paragraphs

Return a JSON object with this structure:
{
  "title": "The paper title",
  "abstract": "The full abstract text",
  "sections": [
    {
      "name": "Section name",
      "paragraphs": [
        "Full text of paragraph 1",
        "Full text of paragraph 2",
        ...
      ]
    },
    ...
  ]
}

PAPER TEXT:
${rawText}

Respond ONLY with the JSON object.`
    }];
    
    safeLog('structure-extraction-prompt', structurePrompt);
    
    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: structurePrompt,
            response_format: { type: "json_object" },
            temperature: 0.1
        });
        
        const structureResult = JSON.parse(response.choices[0]?.message?.content);
        safeLog('structure-extraction-result', { 
          title: structureResult.title, 
          abstractLength: structureResult.abstract?.length || 0,
          sectionCount: structureResult.sections?.length || 0
        });
        return structureResult;
    } catch (error) {
        console.error('[AIService] Error extracting document structure:', error);
        return {
            title: "Structure Extraction Failed",
            abstract: "",
            sections: []
        };
    }
}

// Phase 2: Evaluate paragraphs in batches using paragraph-rules.json
async function evaluateParagraphs(openai, model, title, abstract, sections) {
    console.log('[AIService] Phase 2: Evaluating paragraphs...');
    
    // Load paragraph rules
    const { paragraphRules } = loadRules();
    safeLog('loaded-rules', `Found ${paragraphRules.rules?.length || 0} paragraph rules`);
    
    // Create a structured rules prompt from the JSON file
    const rulesPrompt = paragraphRules.rules.map(rule => {
        return `Rule ${rule.id}: ${rule.title}
${rule.fullText}

Evaluation criteria:
${rule.checkpoints.map(cp => `- ${cp.description}`).join('\n')}
`;
    }).join('\n\n');
    
    // Evaluate abstract first
    let abstractAnalysis = {
        text: abstract,
        summary: "",
        issues: []
    };
    
    if (abstract) {
        const abstractPrompt = [{
            role: "system",
            content: "You analyze the structure and quality of academic paper abstracts based on established rules for scientific writing."
        }, {
            role: "user",
            content: `Evaluate this abstract from a scientific paper according to these paragraph-level rules:

${rulesPrompt}

ABSTRACT TEXT:
"${abstract}"

Return a JSON object with this structure:
{
  "summary": "Brief summary of abstract content",
  "issues": [
    {
      "issue": "Description of issue",
      "severity": "critical | major | minor",
      "recommendation": "Improvement suggestion"
    }
  ]
}

Respond ONLY with the JSON object.`
        }];
        
        safeLog('abstract-analysis-prompt', 'Sending abstract analysis prompt');
        
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: abstractPrompt,
                response_format: { type: "json_object" },
                temperature: 0.1
            });
            
            const abstractResult = JSON.parse(response.choices[0]?.message?.content);
            abstractAnalysis = {
                text: abstract,
                summary: abstractResult.summary || "",
                issues: abstractResult.issues || []
            };
            
            safeLog('abstract-analysis-result', { 
              summaryLength: abstractResult.summary?.length || 0,
              issueCount: abstractResult.issues?.length || 0
            });
        } catch (error) {
            console.error('[AIService] Error evaluating abstract:', error);
        }
    }
    
    // Process sections, evaluating paragraphs in batches
    const batchSize = 50; // Process up to 50 paragraphs at a time
    const evaluatedSections = [];
    
    for (const section of sections) {
        console.log(`[AIService] Evaluating section: ${section.name}`);
        
        const evaluatedParagraphs = [];
        
        // Process paragraphs in batches
        for (let i = 0; i < section.paragraphs.length; i += batchSize) {
            const batch = section.paragraphs.slice(i, i + batchSize);
            console.log(`[AIService] Evaluating batch of ${batch.length} paragraphs...`);
            
            const batchPrompt = [{
                role: "system",
                content: "You evaluate the quality and structure of scientific paper paragraphs using established rules for effective writing."
            }, {
                role: "user",
                content: `Evaluate each of these paragraphs from the "${section.name}" section according to these paragraph-level rules:

${rulesPrompt}

For each paragraph, analyze:
- Context-Content-Conclusion structure
- Sentence quality (length under 25 words on average)
- Topic continuity
- Terminology consistency
- Structural parallelism

Return a JSON object with this structure:
{
  "evaluations": [
    {
      "text": "The original paragraph text",
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

PARAGRAPHS:
${batch.map((p, idx) => `PARAGRAPH ${i + idx + 1}:\n${p}`).join('\n\n')}

Respond ONLY with the JSON object.`
            }];
            
            safeLog('paragraph-batch-prompt', { batchSize: batch.length, startIndex: i });
            
            try {
                const response = await openai.chat.completions.create({
                    model: model,
                    messages: batchPrompt,
                    response_format: { type: "json_object" },
                    temperature: 0.1
                });
                
                const batchResult = JSON.parse(response.choices[0]?.message?.content);
                safeLog('paragraph-batch-result', { 
                  resultCount: batchResult.evaluations?.length || 0 
                });
                
                if (batchResult.evaluations && Array.isArray(batchResult.evaluations)) {
                    evaluatedParagraphs.push(...batchResult.evaluations);
                }
            } catch (error) {
                console.error('[AIService] Error evaluating paragraph batch:', error);
                // Add empty evaluations for this batch
                batch.forEach(paragraphText => {
                    evaluatedParagraphs.push({
                        text: paragraphText,
                        summary: "Error in analysis",
                        evaluations: {
                            cccStructure: false,
                            sentenceQuality: false,
                            topicContinuity: false,
                            terminologyConsistency: false,
                            structuralParallelism: false
                        },
                        issues: [{
                            issue: "Analysis failed",
                            severity: "minor",
                            recommendation: "Try reanalyzing this paragraph"
                        }]
                    });
                });
            }
        }
        
        evaluatedSections.push({
            name: section.name,
            paragraphs: evaluatedParagraphs
        });
    }
    
    return {
        title: title,
        abstract: abstractAnalysis,
        sections: evaluatedSections
    };
}

// Phase 3: Generate document-level assessment using document-rules.json
async function generateDocumentAssessment(openai, model, title, abstract, sections) {
    console.log('[AIService] Phase 3: Generating document-level assessment...');
    
    // Load document rules
    const { documentRules } = loadRules();
    safeLog('loaded-document-rules', `Found ${documentRules.rules?.length || 0} document rules`);
    
    // Create a structured rules prompt from the JSON file
    const rulesPrompt = documentRules.rules.map(rule => {
        return `Rule ${rule.id}: ${rule.title}
${rule.fullText}

Evaluation criteria:
${rule.checkpoints.map(cp => `- ${cp.description}`).join('\n')}
`;
    }).join('\n\n');
    
    // Create section summaries
    const sectionSummaries = sections.map(section => {
        const paragraphSummaries = section.paragraphs.map(p => p.summary).filter(Boolean);
        const issueCount = section.paragraphs.reduce((total, para) => 
            total + (para.issues?.length || 0), 0);
            
        return {
            name: section.name,
            paragraphCount: section.paragraphs.length,
            issueCount: issueCount,
            summaries: paragraphSummaries,
            hasIntroduction: section.name.toLowerCase().includes("introduction"),
            hasResults: section.name.toLowerCase().includes("result"),
            hasDiscussion: section.name.toLowerCase().includes("discussion")
        };
    });
    
    const docPrompt = [{
        role: "system",
        content: "You evaluate the overall structure and quality of scientific papers based on established rules for effective scientific writing."
    }, {
        role: "user",
        content: `Evaluate the overall structure and quality of this scientific paper according to these document-level rules:

${rulesPrompt}

PAPER INFORMATION:
Title: "${title}"
Abstract: "${abstract.text}"
Abstract Summary: "${abstract.summary}"

SECTION SUMMARIES:
${sectionSummaries.map(section => 
    `Section: ${section.name}
     Paragraph count: ${section.paragraphCount}
     Issues found: ${section.issueCount}
     Paragraph summaries:
     ${section.summaries.map((summary, idx) => `  - P${idx+1}: ${summary}`).join('\n     ')}`
).join('\n\n')}

Return a JSON object with this structure:
{
  "documentAssessment": {
    "titleQuality": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "abstractCompleteness": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "introductionStructure": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "resultsOrganization": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "discussionQuality": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "messageFocus": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" },
    "topicOrganization": { "score": 1-10, "assessment": "Brief evaluation", "recommendation": "Suggestion" }
  },
  "majorIssues": [
    {
      "issue": "Description of significant structural problem",
      "location": "Section or area where issue appears",
      "severity": "critical|major",
      "recommendation": "Specific suggestion for improvement"
    }
  ],
  "overallRecommendations": [
    "Top priority suggestion",
    "Second suggestion",
    "Third suggestion"
  ]
}

Respond ONLY with the JSON object.`
    }];
    
    safeLog('document-assessment-prompt', 'Sending document assessment prompt');
    
    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: docPrompt,
            response_format: { type: "json_object" },
            temperature: 0.2
        });
        
        const assessmentResult = JSON.parse(response.choices[0]?.message?.content);
        safeLog('document-assessment-result', { 
          assessmentCount: Object.keys(assessmentResult.documentAssessment || {}).length,
          majorIssuesCount: assessmentResult.majorIssues?.length || 0,
          recommendationsCount: assessmentResult.overallRecommendations?.length || 0
        });
        
        return assessmentResult;
    } catch (error) {
        console.error('[AIService] Error generating document assessment:', error);
        return {
            documentAssessment: {},
            overallRecommendations: []
        };
    }
}

// Main analysis function
export async function analyzeDocumentStructure(document, rawText) {
    console.log('[AIService] Starting two-phase analysis...');
    const serviceStartTime = Date.now();
    
    try {
        safeLog('input-raw-text', { textLength: rawText?.length || 0 });
        
        // Check OpenAI API
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key not configured");
        }
        
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = process.env.OPENAI_MODEL || 'gpt-4o';
        
        // Phase 1: Extract document structure
        const structureResult = await extractDocumentStructure(openai, model, rawText);
        
        // Phase 2: Evaluate paragraphs
        const evaluationResult = await evaluateParagraphs(
            openai, 
            model, 
            structureResult.title, 
            structureResult.abstract, 
            structureResult.sections
        );
        
        // Phase 3: Generate document assessment
        const assessmentResult = await generateDocumentAssessment(
            openai,
            model,
            evaluationResult.title,
            evaluationResult.abstract,
            evaluationResult.sections
        );
        
        // Count issues by severity
        let criticalCount = 0, majorCount = 0, minorCount = 0;
        const prioritizedIssues = [];
        
        // Add abstract issues
        if (evaluationResult.abstract.issues) {
            evaluationResult.abstract.issues.forEach(issue => {
                if (issue.severity === 'critical') criticalCount++;
                if (issue.severity === 'major') majorCount++;
                if (issue.severity === 'minor') minorCount++;
                
                prioritizedIssues.push({
                    ...issue,
                    location: "Abstract"
                });
            });
        }
        
        // Add paragraph issues
        evaluationResult.sections.forEach(section => {
            section.paragraphs.forEach((para, idx) => {
                if (para.issues) {
                    para.issues.forEach(issue => {
                        if (issue.severity === 'critical') criticalCount++;
                        if (issue.severity === 'major') majorCount++;
                        if (issue.severity === 'minor') minorCount++;
                        
                        const textPreview = para.text ? para.text.substring(0, 50) + '...' : 'unknown';
                        
                        prioritizedIssues.push({
                            ...issue,
                            location: `${section.name}: Paragraph ${idx + 1} (starting with: "${textPreview}")`
                        });
                    });
                }
            });
        });
        
        // Sort issues by severity
        prioritizedIssues.sort((a, b) => {
            const severityOrder = { 'critical': 0, 'major': 1, 'minor': 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        
        // Create final results - without prioritized issues list
        const finalResults = {
            title: evaluationResult.title,
            abstract: evaluationResult.abstract,
            documentAssessment: assessmentResult.documentAssessment || {},
            majorIssues: assessmentResult.majorIssues || [],
            overallRecommendations: assessmentResult.overallRecommendations || [],
            statistics: { 
                critical: criticalCount, 
                major: majorCount, 
                minor: minorCount 
            },
            // Removed prioritizedIssues as requested
            sections: evaluationResult.sections
        };
        
        safeLog('final-results', { 
          title: finalResults.title?.substring(0, 30) + '...',
          sectionCount: finalResults.sections?.length || 0,
          statistics: finalResults.statistics
        });
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
