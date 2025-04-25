# Scientific Paper Structure Checker: Implementation Guide

This document outlines the complete workflow for the Scientific Paper Structure Checker application, from paper ingestion to delivering formatted feedback.

## 1. Paper Ingestion

### 1.1 Supported Formats

- LaTeX (.tex)
- Microsoft Word (.docx)

### 1.2 Format-Specific Parsing

#### LaTeX:
```python
def ingest_latex(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Extract document content (strip comments and commands)
    # We need the raw text for analysis but preserve position information
    # for reinserting comments later
    
    # Structure tracking - we need to identify:
    # 1. Title and author block
    # 2. Abstract environment
    # 3. Section headers (track \section, \subsection, etc.)
    # 4. Paragraph breaks
    
    # Return both the raw text for AI analysis and the structured document
    # with position mappings for feedback insertion
    return {
        "raw_text": extracted_text,
        "document_structure": parsed_structure_with_positions
    }
```

#### Microsoft Word:
```python
def ingest_word(file_path):
    # Use docx or python-docx library
    doc = Document(file_path)
    
    # Extract text while preserving section structure
    # Track paragraph indices for comment insertion
    
    return {
        "raw_text": extracted_text,
        "document_structure": parsed_structure_with_positions
    }
```

### 1.3 Format Agnostic Text Extraction

```python
def extract_text_structure(parsed_document):
    # Regardless of source format, we want to extract:
    # 1. Title
    # 2. Authors (if available)
    # 3. Abstract
    # 4. Sections with their headers
    # 5. Paragraphs within each section
    
    # Return a standardized structure 
    return {
        "title": extracted_title,
        "authors": extracted_authors,
        "abstract": extracted_abstract,
        "sections": [
            {
                "name": section_name,
                "paragraphs": [
                    {
                        "text": paragraph_text,
                        "position": position_info  # Format-specific position for reinsertion
                    }
                ]
            }
        ]
    }
```

## 2. AI Prompting Strategy

### 2.1 Paragraph-Level Analysis (First Pass)

```python
def generate_paragraph_analysis_prompt(document_structure):
    prompt = f"""
    Analyze this scientific paper parsed into sections and paragraphs. For each paragraph:
    
    1. Evaluate if it follows Context-Content-Conclusion structure (first sentence provides context, middle sentences provide content, last sentence provides conclusion)
    2. Check if sentences are appropriate length (under 25 words on average)
    3. Assess topic continuity within the paragraph (single focused topic)
    4. Evaluate terminology consistency (same terms used for same concepts)
    5. Check for structural parallelism where appropriate
    6. Provide a 1-2 sentence summary capturing the main point
    
    For each issue found, provide a specific recommendation for improvement.
    
    Return your analysis as a valid JSON object with this structure:
    {{
      "title": "extracted paper title",
      "abstract": {{
        "text": "abstract text",
        "summary": "abstract summary",
        "issues": [
          {{
            "issue": "description of issue",
            "severity": "critical|major|minor",
            "recommendation": "specific suggestion for improvement"
          }}
        ]
      }},
      "sections": [
        {{
          "name": "section name",
          "paragraphs": [
            {{
              "text": "first few words of paragraph for identification...",
              "summary": "1-2 sentence summary of paragraph content",
              "cccStructure": boolean,
              "sentenceQuality": boolean,
              "topicContinuity": boolean,
              "terminologyConsistency": boolean,
              "structuralParallelism": boolean,
              "issues": [
                {{
                  "issue": "description of specific issue",
                  "severity": "critical|major|minor",
                  "recommendation": "specific suggestion"
                }}
              ]
            }}
          ]
        }}
      ]
    }}
    
    Paper structure:
    
    Title: {document_structure['title']}
    
    Abstract: {document_structure['abstract']}
    
    {generate_sections_paragraphs_text(document_structure['sections'])}
    """
    
    return prompt
```

### 2.2 Document-Level Analysis (Second Pass)

```python
def generate_document_analysis_prompt(title, abstract, paragraph_summaries):
    # Prepare a structure of section summaries based on paragraph summaries
    section_summaries = organize_paragraphs_by_section(paragraph_summaries)
    
    prompt = f"""
    Based on the title, abstract, and section summaries of this scientific paper, analyze the overall document structure according to these criteria:
    
    1. Title assessment: Does the title clearly communicate the central contribution?
    2. Abstract completeness: Does the abstract tell a complete story (context, gap, approach, results, significance)?
    3. Introduction effectiveness: Does the introduction progress from broad field to specific gap and preview the solution?
    4. Results organization: Are results presented in logical sequence supporting the main claim?
    5. Discussion quality: Does the discussion connect results back to the gap and explain broader significance?
    6. Single message focus: Is there a consistent focus on a single main contribution?
    7. Topic organization: Are topics discussed in a consolidated way (avoiding zig-zag)?
    
    Return your analysis as a valid JSON object with this structure:
    {{
      "documentAssessment": {{
        "titleQuality": {{
          "score": 1-10 rating,
          "assessment": "evaluation of how well title communicates contribution",
          "recommendation": "specific suggestion if improvement needed"
        }},
        "abstractCompleteness": {{
          "score": 1-10 rating,
          "assessment": "evaluation of abstract's storytelling",
          "recommendation": "specific suggestion if improvement needed"
        }},
        "introductionStructure": {{
          "score": 1-10 rating,
          "assessment": "evaluation of introduction's progression",
          "recommendation": "specific suggestion if improvement needed"
        }},
        "resultsCoherence": {{
          "score": 1-10 rating,
          "assessment": "evaluation of results presentation",
          "recommendation": "specific suggestion if improvement needed"
        }},
        "discussionEffectiveness": {{
          "score": 1-10 rating,
          "assessment": "evaluation of discussion quality",
          "recommendation": "specific suggestion if improvement needed"
        }},
        "messageFocus": {{
          "score": 1-10 rating,
          "assessment": "evaluation of single vs. multiple focus",
          "recommendation": "specific suggestion if improvement needed"
        }},
        "topicOrganization": {{
          "score": 1-10 rating,
          "assessment": "evaluation of topic consolidation",
          "recommendation": "specific suggestion if improvement needed"
        }}
      }},
      "majorIssues": [
        {{
          "issue": "description of significant structural problem",
          "location": "section or area where issue appears",
          "severity": "critical|major",
          "recommendation": "specific suggestion for improvement"
        }}
      ],
      "overallRecommendations": [
        "prioritized suggestion 1",
        "prioritized suggestion 2",
        "prioritized suggestion 3"
      ]
    }}
    
    Title: {title}
    
    Abstract: {abstract}
    
    Section Summaries:
    {format_section_summaries(section_summaries)}
    """
    
    return prompt
```

## 3. Processing AI Responses

### 3.1 Validating and Parsing AI Responses

```python
def process_paragraph_analysis(ai_response):
    try:
        # Parse JSON response
        analysis = json.loads(ai_response)
        
        # Validate structure (error handling omitted for brevity)
        
        # Extract and organize paragraph summaries for second pass
        paragraph_summaries = []
        for section in analysis["sections"]:
            for paragraph in section["paragraphs"]:
                paragraph_summaries.append({
                    "sectionType": section["name"],
                    "summary": paragraph["summary"],
                    "hasIssues": len(paragraph["issues"]) > 0
                })
        
        return {
            "analysis": analysis,
            "paragraph_summaries": paragraph_summaries
        }
    except json.JSONDecodeError:
        # Handle JSON parsing errors
        # May need fallback parsing for non-compliant responses
        pass
```

### 3.2 Merging Paragraph and Document Analysis

```python
def merge_analyses(paragraph_analysis, document_analysis):
    # Combine both analyses into a single comprehensive assessment
    # Structure for generating feedback
    
    return {
        "title": paragraph_analysis["title"],
        "abstract": {
            "text": paragraph_analysis["abstract"]["text"],
            "issues": paragraph_analysis["abstract"]["issues"],
            "document_level_assessment": document_analysis["documentAssessment"]["abstractCompleteness"]
        },
        "document_assessment": document_analysis["documentAssessment"],
        "major_issues": document_analysis["majorIssues"],
        "overall_recommendations": document_analysis["overallRecommendations"],
        "sections": paragraph_analysis["sections"]
    }
```

## 4. Generating Feedback for Document

### 4.1 Comment Generation for Each Format

#### LaTeX:
```python
def generate_latex_comments(merged_analysis, original_document_structure):
    # First, create a modified copy of the original LaTeX file
    latex_with_comments = original_document_structure["raw_text"]
    
    # Add required packages to preamble
    latex_with_comments = add_todonotes_package(latex_with_comments)
    
    # Add document-level comments at the beginning
    summary_comments = generate_document_level_summary(merged_analysis)
    latex_with_comments = add_summary_section(latex_with_comments, summary_comments)
    
    # Process each section and paragraph
    for section_idx, section in enumerate(merged_analysis["sections"]):
        for para_idx, paragraph in enumerate(section["paragraphs"]):
            # Generate appropriate todonotes for each issue
            for issue in paragraph["issues"]:
                comment = f"\\todo[color={severity_to_color(issue['severity'])}]{{{issue['severity'].capitalize()}: {issue['issue']}. {issue['recommendation']}}}"
                
                # Insert at correct position using mapping from original_document_structure
                position = original_document_structure["sections"][section_idx]["paragraphs"][para_idx]["position"]
                latex_with_comments = insert_at_position(latex_with_comments, comment, position)
            
            # Add paragraph summary as lower priority note
            summary_comment = f"\\todo[color=gray,size=\small]{{Summary: {paragraph['summary']}}}"
            position = original_document_structure["sections"][section_idx]["paragraphs"][para_idx]["position"]
            latex_with_comments = insert_at_position(latex_with_comments, summary_comment, position, priority="low")
    
    return latex_with_comments
```

#### Microsoft Word:
```python
def generate_word_comments(merged_analysis, original_document_structure):
    # Load the original docx
    doc = Document(original_document_structure["file_path"])
    
    # Add document-level summary to beginning
    summary = generate_document_level_summary(merged_analysis)
    doc.paragraphs[0].insert_before_paragraph(summary)
    
    # Track paragraph indices for mapping to analysis
    current_section_idx = 0
    current_para_idx = 0
    
    # For each paragraph in the document
    for i, para in enumerate(doc.paragraphs):
        # Skip empty paragraphs
        if not para.text.strip():
            continue
            
        # Check if this is a section header and update our tracking
        if is_section_header(para):
            current_section_idx += 1
            current_para_idx = 0
            continue
        
        # Get corresponding paragraph analysis if available
        if (current_section_idx < len(merged_analysis["sections"]) and 
            current_para_idx < len(merged_analysis["sections"][current_section_idx]["paragraphs"])):
            
            paragraph_analysis = merged_analysis["sections"][current_section_idx]["paragraphs"][current_para_idx]
            
            # Add comments for issues
            for issue in paragraph_analysis["issues"]:
                comment_text = f"{issue['severity'].upper()}: {issue['issue']}. {issue['recommendation']}"
                add_comment_to_paragraph(doc, para, comment_text)
            
            # Add paragraph summary as comment
            summary_comment = f"SUMMARY: {paragraph_analysis['summary']}"
            add_comment_to_paragraph(doc, para, summary_comment, author="Summary")
                
        current_para_idx += 1
    
    return doc
```

### 4.2 Format-Agnostic Prioritization

```python
def prioritize_feedback(merged_analysis):
    # Count issues by severity
    severity_counts = {"critical": 0, "major": 0, "minor": 0}
    
    for section in merged_analysis["sections"]:
        for paragraph in section["paragraphs"]:
            for issue in paragraph["issues"]:
                severity_counts[issue["severity"]] += 1
    
    # Add document-level issues
    for issue in merged_analysis["major_issues"]:
        severity_counts[issue["severity"]] += 1
    
    # Create prioritized list of issues
    prioritized_issues = []
    
    # First add critical document-level issues
    for issue in [i for i in merged_analysis["major_issues"] if i["severity"] == "critical"]:
        prioritized_issues.append({
            "location": "Document: " + issue["location"],
            "issue": issue["issue"],
            "recommendation": issue["recommendation"],
            "severity": "critical"
        })
    
    # Then critical paragraph issues
    for section in merged_analysis["sections"]:
        for paragraph in section["paragraphs"]:
            for issue in [i for i in paragraph["issues"] if i["severity"] == "critical"]:
                prioritized_issues.append({
                    "location": f"Section '{section['name']}', paragraph starting with '{paragraph['text'][:30]}...'",
                    "issue": issue["issue"],
                    "recommendation": issue["recommendation"],
                    "severity": "critical"
                })
    
    # Repeat for major and minor issues
    # (Code omitted for brevity)
    
    return {
        "statistics": severity_counts,
        "prioritized_issues": prioritized_issues
    }
```

### 4.3 Summary Report Generation

```python
def generate_summary_report(merged_analysis, prioritized_feedback):
    # Create an executive summary for the document beginning
    
    report = f"""
    # Scientific Paper Structure Assessment
    
    ## Overall Assessment
    
    - Title Quality: {merged_analysis["document_assessment"]["titleQuality"]["score"]}/10 - {merged_analysis["document_assessment"]["titleQuality"]["assessment"]}
    - Abstract Completeness: {merged_analysis["document_assessment"]["abstractCompleteness"]["score"]}/10
    - Introduction Structure: {merged_analysis["document_assessment"]["introductionStructure"]["score"]}/10
    - Results Coherence: {merged_analysis["document_assessment"]["resultsCoherence"]["score"]}/10
    - Discussion Effectiveness: {merged_analysis["document_assessment"]["discussionEffectiveness"]["score"]}/10
    - Message Focus: {merged_analysis["document_assessment"]["messageFocus"]["score"]}/10
    - Topic Organization: {merged_analysis["document_assessment"]["topicOrganization"]["score"]}/10
    
    ## Issue Summary
    
    - Critical Issues: {prioritized_feedback["statistics"]["critical"]}
    - Major Issues: {prioritized_feedback["statistics"]["major"]}
    - Minor Issues: {prioritized_feedback["statistics"]["minor"]}
    
    ## Top Recommendations
    
    {format_top_recommendations(merged_analysis["overall_recommendations"])}
    
    ## Critical Issues to Address
    
    {format_critical_issues(prioritized_feedback["prioritized_issues"])}
    """
    
    return report
```

## 5. Reinserting Feedback into Document

### 5.1 Finding Correct Insertion Points

```python
def find_insertion_points(original_document_structure, merged_analysis):
    # Create mapping between analysis paragraphs and document positions
    insertion_map = {}
    
    for section_idx, section in enumerate(merged_analysis["sections"]):
        insertion_map[section["name"]] = {
            "position": original_document_structure["sections"][section_idx]["position"],
            "paragraphs": {}
        }
        
        for para_idx, paragraph in enumerate(section["paragraphs"]):
            # Use text prefix to ensure correct matching
            para_text_prefix = paragraph["text"][:50]
            
            # Find matching paragraph in original structure
            matching_position = find_matching_paragraph_position(
                original_document_structure["sections"][section_idx]["paragraphs"],
                para_text_prefix
            )
            
            insertion_map[section["name"]]["paragraphs"][para_idx] = matching_position
    
    return insertion_map
```

### 5.2 Format-Specific Insertion Logic

#### LaTeX:
```python
def insert_at_position(latex_text, comment, position, priority="normal"):
    # LaTeX positions could be line numbers or character indices
    
    # For line-based position:
    lines = latex_text.split('\n')
    
    if position["type"] == "line":
        # Choose insertion line based on priority
        if priority == "normal":
            # Insert at beginning of paragraph
            insertion_line = position["start_line"]
        else:  # "low" priority
            # Insert at end of paragraph
            insertion_line = position["end_line"]
        
        lines.insert(insertion_line, comment)
        return '\n'.join(lines)
    
    elif position["type"] == "character":
        # For character-based position:
        insertion_point = position["start_char"]
        if priority == "low":
            insertion_point = position["end_char"]
        
        return latex_text[:insertion_point] + comment + latex_text[insertion_point:]
```

#### Microsoft Word:
```python
def add_comment_to_paragraph(doc, paragraph, comment_text, author="Feedback"):
    # Use python-docx to add a comment to the paragraph
    # Example using a hypothetical comment API:
    comment_range = paragraph.add_comment_range(0, len(paragraph.text))
    comment = doc.add_comment(comment_range, author, comment_text)
    
    # In reality, the python-docx API doesn't directly support comments
    # You might need to use COM automation with win32com or a similar approach
```

### 5.3 Removing Feedback Options

```python
def create_feedback_removal_options(document_format, annotated_document):
    if document_format == "latex":
        # For LaTeX, create two versions:
        # 1. With feedback
        # 2. With \usepackage[disable]{todonotes}
        clean_version = disable_todonotes(annotated_document)
        return {
            "with_feedback": annotated_document,
            "without_feedback": clean_version
        }
    
    elif document_format == "docx":
        # For Word, can't easily create a "switch" to disable comments
        # Instead, create a clean copy with no comments
        clean_version = remove_all_comments(annotated_document)
        return {
            "with_feedback": annotated_document,
            "without_feedback": clean_version
        }
```

## 6. Complete Workflow

```python
def analyze_paper(file_path):
    # 1. Determine document format
    document_format = determine_format(file_path)
    
    # 2. Ingest document based on format
    if document_format == "latex":
        parsed_document = ingest_latex(file_path)
    elif document_format == "docx":
        parsed_document = ingest_word(file_path)
    else:
        raise ValueError("Unsupported document format")
    
    # 3. Extract standardized structure
    document_structure = extract_text_structure(parsed_document)
    
    # 4. First AI query: Paragraph-level analysis
    paragraph_prompt = generate_paragraph_analysis_prompt(document_structure)
    paragraph_ai_response = query_ai(paragraph_prompt)
    paragraph_analysis = process_paragraph_analysis(paragraph_ai_response)
    
    # 5. Second AI query: Document-level analysis using paragraph summaries
    document_prompt = generate_document_analysis_prompt(
        paragraph_analysis["analysis"]["title"],
        paragraph_analysis["analysis"]["abstract"]["text"],
        paragraph_analysis["paragraph_summaries"]
    )
    document_ai_response = query_ai(document_prompt)
    document_analysis = json.loads(document_ai_response)
    
    # 6. Merge analyses
    merged_analysis = merge_analyses(paragraph_analysis["analysis"], document_analysis)
    
    # 7. Prioritize feedback
    prioritized_feedback = prioritize_feedback(merged_analysis)
    
    # 8. Generate summary report
    summary_report = generate_summary_report(merged_analysis, prioritized_feedback)
    
    # 9. Insert feedback into document
    if document_format == "latex":
        annotated_document = generate_latex_comments(merged_analysis, parsed_document)
    elif document_format == "docx":
        annotated_document = generate_word_comments(merged_analysis, parsed_document)
    
    # 10. Create versions with and without feedback
    output_versions = create_feedback_removal_options(document_format, annotated_document)
    
    # 11. Return everything the user needs
    return {
        "summary_report": summary_report,
        "annotated_document": output_versions["with_feedback"],
        "clean_document": output_versions["without_feedback"],
        "full_analysis": merged_analysis
    }
```

## 7. Implementation Considerations

### 7.1 Token Limits and Large Documents

For very large documents, we may need to:
1. Chunk the document for paragraph analysis
2. Preserve section structure during chunking
3. Reassemble results from multiple API calls

```python
def chunk_large_document(document_structure, max_tokens=4000):
    # Split document into manageable chunks for API
    chunks = []
    current_chunk = {"title": document_structure["title"], "sections": []}
    current_token_estimate = len(document_structure["title"])
    
    for section in document_structure["sections"]:
        # Check if adding this section would exceed token limit
        section_token_estimate = estimate_tokens(section)
        
        if current_token_estimate + section_token_estimate > max_tokens:
            # Finalize current chunk and start a new one
            chunks.append(current_chunk)
            current_chunk = {"title": document_structure["title"], "sections": []}
            current_token_estimate = len(document_structure["title"])
        
        # Add section to current chunk
        current_chunk["sections"].append(section)
        current_token_estimate += section_token_estimate
    
    # Add the last chunk
    if current_chunk["sections"]:
        chunks.append(current_chunk)
    
    return chunks
```

### 7.2 Error Handling and Fallbacks

```python
def handle_ai_response_errors(response, attempt=1, max_attempts=3):
    try:
        parsed = json.loads(response)
        # Validate expected structure
        return parsed
    except json.JSONDecodeError:
        if attempt < max_attempts:
            # Retry with more explicit instructions
            new_prompt = "You must return a valid JSON object. Previous response was not valid JSON. " + original_prompt
            new_response = query_ai(new_prompt)
            return handle_ai_response_errors(new_response, attempt + 1, max_attempts)
        else:
            # Fall back to more forgiving parsing
            return extract_partial_results(response)
```

### 7.3 User Control and Customization

```python
def customize_analysis(base_config, user_preferences):
    # Allow users to customize the types of feedback they want
    
    # Adjust severity thresholds
    if "severity_thresholds" in user_preferences:
        base_config["severity_thresholds"] = user_preferences["severity_thresholds"]
    
    # Enable/disable specific rule checks
    if "disabled_rules" in user_preferences:
        for rule in user_preferences["disabled_rules"]:
            base_config["rules"][rule]["enabled"] = False
    
    # Customize output format
    if "output_format" in user_preferences:
        base_config["output_format"] = user_preferences["output_format"]
    
    return base_config
```

## 8. Example Prompts

### 8.1 Complete Paragraph Analysis Prompt

```
Analyze this scientific paper parsed into sections and paragraphs. For each paragraph:

1. Evaluate if it follows Context-Content-Conclusion structure (first sentence provides context, middle sentences provide content, last sentence provides conclusion)
2. Check if sentences are appropriate length (under 25 words on average)
3. Assess topic continuity within the paragraph (single focused topic)
4. Evaluate terminology consistency (same terms used for same concepts)
5. Check for structural parallelism where appropriate
6. Provide a 1-2 sentence summary capturing the main point

For each issue found, provide a specific recommendation for improvement.

Return your analysis as a valid JSON object with this structure:
{
  "title": "extracted paper title",
  "abstract": {
    "text": "abstract text",
    "summary": "abstract summary",
    "issues": [
      {
        "issue": "description of issue",
        "severity": "critical|major|minor",
        "recommendation": "specific suggestion for improvement"
      }
    ]
  },
  "sections": [
    {
      "name": "section name",
      "paragraphs": [
        {
          "text": "first few words of paragraph for identification...",
          "summary": "1-2 sentence summary of paragraph content",
          "cccStructure": boolean,
          "sentenceQuality": boolean,
          "topicContinuity": boolean,
          "terminologyConsistency": boolean,
          "structuralParallelism": boolean,
          "issues": [
            {
              "issue": "description of specific issue",
              "severity": "critical|major|minor",
              "recommendation": "specific suggestion"
            }
          ]
        }
      ]
    }
  ]
}

Paper structure:

Title: Ten simple rules for structuring papers

Abstract: Good scientific writing is essential to career development and to the progress of science. A well-structured manuscript allows readers and reviewers to get excited about the subject matter, to understand and verify the paper's contributions, and to integrate these contributions into a broader context. However, many scientists struggle with producing high-quality manuscripts and are typically untrained in paper writing. Focusing on how readers consume information, we present a set of ten simple rules to help you communicate the main idea of your paper. These rules are designed to make your paper more influential and the process of writing more efficient and pleasurable.

Section: Introduction
Paragraph: Writing and reading papers are key skills for scientists. Indeed, success at publishing is used to evaluate scientists and can help predict their future success. In the production and consumption of papers, multiple parties are involved, each having their own motivations and priorities. The editors want to make sure that the paper is significant, and the reviewers want to determine whether the conclusions are justified by the results. The reader wants to quickly understand the conceptual conclusions of the paper before deciding whether to dig into the details, and the writer wants to convey the important contributions to the broadest audience possible while convincing the specialist that the findings are credible. You can facilitate all of these goals by structuring the paper well at multiple scales—spanning the sentence, paragraph, section, and document.

[... additional sections and paragraphs ...]
```

### 8.2 Complete Document Analysis Prompt

```
Based on the title, abstract, and section summaries of this scientific paper, analyze the overall document structure according to these criteria:

1. Title assessment: Does the title clearly communicate the central contribution?
2. Abstract completeness: Does the abstract tell a complete story (context, gap, approach, results, significance)?
3. Introduction effectiveness: Does the introduction progress from broad field to specific gap and preview the solution?
4. Results organization: Are results presented in logical sequence supporting the main claim?
5. Discussion quality: Does the discussion connect results back to the gap and explain broader significance?
6. Single message focus: Is there a consistent focus on a single main contribution?
7. Topic organization: Are topics discussed in a consolidated way (avoiding zig-zag)?

Return your analysis as a valid JSON object with this structure:
{
  "documentAssessment": {
    "titleQuality": {
      "score": 1-10 rating,
      "assessment": "evaluation of how well title communicates contribution",
      "recommendation": "specific suggestion if improvement needed"
    },
    "abstractCompleteness": {
      "score": 1-10 rating,
      "assessment": "evaluation of abstract's storytelling",
      "recommendation": "specific suggestion if improvement needed"
    },
    "introductionStructure": {
      "score": 1-10 rating,
      "assessment": "evaluation of introduction's progression",
      "recommendation": "specific suggestion if improvement needed"
    },
    "resultsCoherence": {
      "score": 1-10 rating,
      "assessment": "evaluation of results presentation",
      "recommendation": "specific suggestion if improvement needed"
    },
    "discussionEffectiveness": {
      "score": 1-10 rating,
      "assessment": "evaluation of discussion quality",
      "recommendation": "specific suggestion if improvement needed"
    },
    "messageFocus": {
      "score": 1-10 rating,
      "assessment": "evaluation of single vs. multiple focus",
      "recommendation": "specific suggestion if improvement needed"
    },
    "topicOrganization": {
      "score": 1-10 rating,
      "assessment": "evaluation of topic consolidation",
      "recommendation": "specific suggestion if improvement needed"
    }
  },
  "majorIssues": [
    {
      "issue": "description of significant structural problem",
      "location": "section or area where issue appears",
      "severity": "critical|major",
      "recommendation": "specific suggestion for improvement"
    }
  ],
  "overallRecommendations": [
    "prioritized suggestion 1",
    "prioritized suggestion 2",
    "prioritized suggestion 3"
  ]
}

Title: Ten simple rules for structuring papers

Abstract: Good scientific writing is essential to career development and to the progress of science. A well-structured manuscript allows readers and reviewers to get excited about the subject matter, to understand and verify the paper's contributions, and to integrate these contributions into a broader context. However, many scientists struggle with producing high-quality manuscripts and are typically untrained in paper writing. Focusing on how readers consume information, we present a set of ten simple rules to help you communicate the main idea of your paper. These rules are designed to make your paper more influential and the process of writing more efficient and pleasurable.

Section Summaries:
Introduction:
- The paragraph emphasizes the importance of scientific writing skills, noting how various stakeholders (editors, reviewers, readers, writers) have different priorities. It concludes by stating that good paper structure at multiple scales can satisfy all these stakeholders' needs.

Rule 1 - Focus your paper on a central contribution:
- This paragraph explains the importance of focusing a paper on a single central message, as papers with multiple contributions are less memorable. It emphasizes the title's importance as the ultimate refinement of the paper's contribution and suggests that focusing on the title early can help guide both writing and research.

[... additional section summaries ...]
```
