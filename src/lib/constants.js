/**
 * Constants for the Scientific Paper Structure Checker
 */

// Supported file types
export const SUPPORTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/plain', // txt
  'text/markdown', // md
  'text/x-tex', // tex
  'application/x-tex', // tex alternative
]

// Supported file extensions
export const SUPPORTED_EXTENSIONS = ['docx', 'txt', 'md', 'tex']

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// Maximum character count for document
export const MAX_CHAR_COUNT = 100000

// Severity levels for issues
export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
}

// Document structure rules
export const STRUCTURE_RULES = {
  PARAGRAPH: {
    CCC_STRUCTURE: 'Context-Content-Conclusion structure',
    SENTENCE_QUALITY: 'Sentence length and quality',
    TOPIC_CONTINUITY: 'Topic continuity',
    TERMINOLOGY_CONSISTENCY: 'Terminology consistency',
    STRUCTURAL_PARALLELISM: 'Structural parallelism',
  },
  DOCUMENT: {
    TITLE_QUALITY: 'Title quality',
    ABSTRACT_COMPLETENESS: 'Abstract completeness',
    INTRODUCTION_STRUCTURE: 'Introduction structure',
    RESULTS_COHERENCE: 'Results coherence',
    DISCUSSION_EFFECTIVENESS: 'Discussion effectiveness',
    MESSAGE_FOCUS: 'Message focus',
    TOPIC_ORGANIZATION: 'Topic organization',
  }
}

// Score thresholds
export const SCORE_THRESHOLDS = {
  GOOD: 8, // 8-10
  ACCEPTABLE: 6, // 6-7
  NEEDS_IMPROVEMENT: 0, // 0-5
}

// Color mapping for scores and severities
export const COLORS = {
  POSITIVE: 'green',
  WARNING: 'yellow',
  NEGATIVE: 'red',
  NEUTRAL: 'blue',
}

// Temporary storage time limit (24 hours in milliseconds)
export const STORAGE_TTL = 24 * 60 * 60 * 1000
