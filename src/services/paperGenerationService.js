// FILE: src/services/paperGenerationService.js

/**
 * Service for generating complete research papers using AI
 * Takes section content and generates a full structured paper
 */
import { callOpenAI } from './openaiService';
import { buildSystemPrompt } from '../utils/promptUtils';
import useAppStore from '../store/appStore';

/**
 * Generates a complete research paper from section content
 * @param {Object} sectionsContent - Object with section IDs as keys and content as values
 * @returns {Promise<Object>} - Result with success flag and generated paper
 */
export const generateResearchPaper = async (sectionsContent) => {
  try {
    console.log("[Paper Generation] Starting paper generation process");
    console.time("paperGenerationTime");

    // Build the system prompt for paper generation
    const systemPrompt = buildSystemPrompt('paperGeneration');

    // Format the sections content for the AI prompt
    const formattedSections = formatSectionsForPrompt(sectionsContent);

    // Create the user prompt with the formatted sections
    const userPrompt = `Please generate a complete research paper using the following project plan sections:

${formattedSections}

Follow the structure and rules provided in the system prompt. Use <expected> tags for any content you need to infer or expand beyond what was provided.`;

    console.log(`[Paper Generation] Sending ${Object.keys(sectionsContent).length} sections to AI`);

    // Call OpenAI API with extended timeout for paper generation
    const response = await callOpenAI(
      userPrompt,
      "paper_generation", // Context type
      sectionsContent, // Pass sections for context
      [], // No section definitions needed
      {
        temperature: 0.3, // Lower temperature for more structured output
        max_tokens: 4096 // Maximum tokens for full paper
      },
      [], // No chat history
      systemPrompt, // Use the paper generation system prompt
      false // Don't use JSON mode
    );

    console.log("[Paper Generation] Paper generated successfully");
    console.timeEnd("paperGenerationTime");

    return {
      success: true,
      paper: response,
      sectionsUsed: Object.keys(sectionsContent),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("Error generating research paper:", error);
    console.timeEnd("paperGenerationTime");

    return {
      success: false,
      error: error.message || "An error occurred while generating the paper",
      errorType: error.name || "UnknownError"
    };
  }
};

/**
 * Formats section content for inclusion in the AI prompt
 * @param {Object} sectionsContent - Raw sections content
 * @returns {string} - Formatted sections for prompt
 */
const formatSectionsForPrompt = (sectionsContent) => {
  const sectionOrder = [
    'question',
    'audience', 
    'hypothesis', // These three are mutually exclusive based on active toggles
    'needsresearch',
    'exploratoryresearch',
    'relatedpapers',
    'experiment', // These three are mutually exclusive based on active toggles  
    'existingdata',
    'theorysimulation',
    'analysis',
    'process',
    'abstract'
  ];

  let formatted = [];

  sectionOrder.forEach(sectionId => {
    if (sectionsContent[sectionId] && sectionsContent[sectionId].trim() !== '') {
      const sectionTitle = getSectionTitle(sectionId);
      formatted.push(`## ${sectionTitle}\n${sectionsContent[sectionId]}\n`);
    }
  });

  // Add any sections that weren't in our predefined order
  Object.keys(sectionsContent).forEach(sectionId => {
    if (!sectionOrder.includes(sectionId) && sectionsContent[sectionId].trim() !== '') {
      const sectionTitle = getSectionTitle(sectionId);
      formatted.push(`## ${sectionTitle}\n${sectionsContent[sectionId]}\n`);
    }
  });

  return formatted.join('\n');
};

/**
 * Gets a human-readable title for a section ID
 * @param {string} sectionId - The section identifier
 * @returns {string} - Human-readable section title
 */
const getSectionTitle = (sectionId) => {
  const titleMap = {
    'question': 'Research Question & Significance',
    'audience': 'Target Audience',
    'hypothesis': 'Hypothesis-Based Research Approach',
    'needsresearch': 'Needs-Based Research Approach', 
    'exploratoryresearch': 'Exploratory Research Approach',
    'relatedpapers': 'Related Work',
    'experiment': 'Experimental Design',
    'existingdata': 'Existing Data Analysis',
    'theorysimulation': 'Theory & Simulation',
    'analysis': 'Data Analysis Plan',
    'process': 'Process, Skills & Timeline',
    'abstract': 'Abstract'
  };

  return titleMap[sectionId] || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
};

/**
 * Extracts active sections content from the store
 * @returns {Object} - Object with active section content only
 */
export const getActiveSectionsContent = () => {
  const state = useAppStore.getState();
  const sections = state.sections || {};
  const activeToggles = state.activeToggles || { approach: 'hypothesis', dataMethod: 'experiment' };
  
  const activeSections = {};
  
  // Always include these sections if they have content
  const alwaysInclude = ['question', 'audience', 'relatedpapers', 'analysis', 'process', 'abstract'];
  
  alwaysInclude.forEach(sectionId => {
    if (sections[sectionId] && sections[sectionId].content) {
      activeSections[sectionId] = sections[sectionId].content;
    }
  });
  
  // Include active approach section
  if (activeToggles.approach && sections[activeToggles.approach] && sections[activeToggles.approach].content) {
    activeSections[activeToggles.approach] = sections[activeToggles.approach].content;
  }
  
  // Include active data method section
  if (activeToggles.dataMethod && sections[activeToggles.dataMethod] && sections[activeToggles.dataMethod].content) {
    activeSections[activeToggles.dataMethod] = sections[activeToggles.dataMethod].content;
  }
  
  return activeSections;
};
