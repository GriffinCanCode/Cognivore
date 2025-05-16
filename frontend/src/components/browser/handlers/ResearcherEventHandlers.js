/**
 * ResearcherEventHandlers - Event handlers for Researcher component
 */

import logger from '../../../utils/logger';

// Create a logger instance for event handlers
const eventLogger = logger.scope('ResearcherEvents');

/**
 * Handle chat input changes
 * @param {Object} researcher - Researcher component instance
 * @param {Event} event - Input change event
 */
export function handleChatInputChange(researcher, event) {
  eventLogger.debug('Chat input changed');
  researcher.setState({ chatInput: event.target.value });
}

/**
 * Handle chat input key press (Enter to send)
 * @param {Object} researcher - Researcher component instance
 * @param {KeyboardEvent} event - Keyboard event
 */
export function handleChatInputKeyPress(researcher, event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    eventLogger.debug('Enter key pressed in chat input');
    event.preventDefault();
    researcher.sendChatMessage();
  }
}

/**
 * Handle research panel toggle
 * @param {Object} researcher - Researcher component instance
 * @returns {boolean} New active state
 */
export function handlePanelToggle(researcher) {
  eventLogger.info('Toggling research panel');
  
  // Get or create the research panel
  const researchPanel = researcher.getResearchPanel();
  if (!researchPanel) {
    eventLogger.error('Could not get or create research panel');
    return false;
  }
  
  // Remove any existing input containers first to prevent duplicates
  const existingInputs = document.querySelectorAll('.research-chat-input');
  existingInputs.forEach(input => {
    input.remove();
    const index = researcher.createdInputElements.indexOf(input);
    if (index > -1) {
      researcher.createdInputElements.splice(index, 1);
    }
  });
  
  // Update state and trigger initialization
  const newActive = !researcher.state.isActive;
  researcher._handleStateChange({ isActive: newActive });
  
  // If activating, ensure panel is visible and properly set up
  if (newActive) {
    researchPanel.classList.remove('hidden');
    researchPanel.style.visibility = 'visible';
    researchPanel.style.display = 'flex';
    researcher.setupResearchPanelHeader(researchPanel);
    
    // Force chat interface update
    setTimeout(() => {
      researcher._ensureChatInterface();
      researcher.updateChatInterface();
    }, 100);
  } else {
    researchPanel.classList.add('hidden');
  }
  
  return newActive;
}

/**
 * Handle research panel collapse toggle
 * @param {Object} researcher - Researcher component instance
 */
export function handleCollapseToggle(researcher) {
  eventLogger.debug('Toggling panel collapse state');
  
  researcher.setState(prevState => ({
    isCollapsed: !prevState.isCollapsed
  }), () => {
    const researchPanel = researcher.getResearchPanel();
    if (researchPanel) {
      if (researcher.state.isCollapsed) {
        researchPanel.classList.add('collapsed');
      } else {
        researchPanel.classList.remove('collapsed');
      }
    }
  });
}

/**
 * Handle research panel close
 * @param {Object} researcher - Researcher component instance
 */
export function handlePanelClose(researcher) {
  eventLogger.info('Closing research panel');
  
  researcher.setState({ isActive: false }, () => {
    const researchPanel = researcher.getResearchPanel();
    if (researchPanel) {
      researchPanel.classList.add('hidden');
      researchPanel.style.display = 'none';
    }
    
    // Clean up any input elements
    researcher.cleanupInputElements();
  });
}

/**
 * Handle analyze button click
 * @param {Object} researcher - Researcher component instance
 * @param {string} entryId - ID of the research entry to analyze
 */
export function handleAnalyzeClick(researcher, entryId) {
  eventLogger.info(`Analyzing research entry: ${entryId}`);
  researcher.analyzeContent(entryId);
}

/**
 * Handle save to knowledge base button click
 * @param {Object} researcher - Researcher component instance
 * @param {string} entryId - ID of the research entry to save
 */
export function handleSaveClick(researcher, entryId) {
  eventLogger.info(`Saving research entry to knowledge base: ${entryId}`);
  researcher.saveToKnowledgeBase(entryId);
}

/**
 * Handle clear research button click
 * @param {Object} researcher - Researcher component instance
 */
export function handleClearClick(researcher) {
  eventLogger.info('Clearing all research entries');
  researcher.clearResearch();
}

/**
 * Handle export research button click
 * @param {Object} researcher - Researcher component instance
 * @param {string} format - Export format ('markdown', 'json', or 'html')
 */
export function handleExportClick(researcher, format = 'markdown') {
  eventLogger.info(`Exporting research in ${format} format`);
  researcher.exportResearch(format);
}

/**
 * Handle research summary button click
 * @param {Object} researcher - Researcher component instance
 */
export function handleSummaryClick(researcher) {
  eventLogger.info('Generating research summary');
  researcher.getResearchSummary();
}

export default {
  handleChatInputChange,
  handleChatInputKeyPress,
  handlePanelToggle,
  handleCollapseToggle,
  handlePanelClose,
  handleAnalyzeClick,
  handleSaveClick,
  handleClearClick,
  handleExportClick,
  handleSummaryClick
}; 