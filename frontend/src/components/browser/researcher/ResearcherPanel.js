/**
 * ResearcherPanel - Manages the research panel UI and layout
 */

import logger from '../../../utils/logger.js';
import ResearcherMessages from './ResearcherMessages.js';
import ResearcherInput from './ResearcherInput.js';
import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import './ResearcherPanel.css';

// Create context-specific logger
const panelLogger = logger.scope('ResearcherPanel');

/**
 * ResearcherPanel component for rendering the research interface
 * Memoized to prevent unnecessary re-renders during typing
 */
const ResearcherPanel = memo(({
  messages = [],
  isLoading = false,
  onSubmit,
  onClose,
  onCollapse,
  onAnalyze,
  onClear,
  onInputChange,
  inputDisabled = false,
  disabledMessage = null
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const panelRef = useRef(null);
  const messagesRef = useRef(null);
  
  // Handle collapse toggle with memoization
  const handleCollapseToggle = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapse) {
      onCollapse(newState);
    }
  }, [isCollapsed, onCollapse]);
  
  // Handle pin toggle with memoization
  const handlePinToggle = useCallback(() => {
    setIsPinned(!isPinned);
  }, [isPinned]);
  
  // Handle closing with memoization
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);
  
  // Handle analyze with memoization
  const handleAnalyze = useCallback(() => {
    if (onAnalyze) {
      onAnalyze();
    }
  }, [onAnalyze]);
  
  // Handle clear with memoization
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
  }, [onClear]);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesRef.current && !isCollapsed) {
      const container = messagesRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isCollapsed]);
  
  return (
    <div 
      ref={panelRef}
      className={`researcher-panel ${isCollapsed ? 'collapsed' : ''} ${isPinned ? 'pinned' : ''}`}
      data-testid="researcher-panel"
    >
      <div className="researcher-panel-header">
        <div className="researcher-panel-title">
          <div className="researcher-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a9 9 0 0 1 9 9c0 3.1-1.5 5.7-4 7.4L17 22H7l-.1-3.6a10.6 10.6 0 0 1-4-7.4 9 9 0 0 1 9-9Z"/>
              <path d="M9 14h.01"/>
              <path d="M15 14h.01"/>
              <path d="M9.5 8.5C10 7.7 11 7 12 7s2 .7 2.5 1.5"/>
            </svg>
          </div>
          <span>Research Assistant</span>
        </div>
        <div className="researcher-panel-controls">
          <button 
            className="researcher-action-button" 
            onClick={handleAnalyze}
            title="Extract page content"
            data-testid="research-extract-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </button>
          <button 
            className="researcher-action-button" 
            onClick={handleClear}
            title="Clear conversation"
            data-testid="research-clear-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
          <button 
            className="researcher-action-button" 
            onClick={handlePinToggle}
            title={isPinned ? "Unpin panel" : "Pin panel"}
            data-testid="research-pin-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10h-10v-10Z"></path>
              <path d="M12 2v10h10"></path>
              <path d="M21 12a9 9 0 0 1-9 9"></path>
            </svg>
          </button>
          <button 
            className="researcher-action-button" 
            onClick={handleCollapseToggle}
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
            data-testid="research-collapse-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points={isCollapsed ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
            </svg>
          </button>
          <button 
            className="researcher-action-button" 
            onClick={handleClose}
            title="Close panel"
            data-testid="research-close-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="researcher-panel-body">
          <div 
            ref={messagesRef}
            className="researcher-messages-container"
            data-testid="researcher-messages-wrapper"
          >
            <ResearcherMessages 
              messages={messages} 
              loading={isLoading}
            />
          </div>
          <div className="researcher-input-wrapper">
            <ResearcherInput
              onSubmit={onSubmit}
              onChange={onInputChange}
              disabled={inputDisabled}
              disabledMessage={disabledMessage}
              placeholder="Ask about this content or ask research questions..."
              autoFocus={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.inputDisabled !== nextProps.inputDisabled) return false;
  if (prevProps.disabledMessage !== nextProps.disabledMessage) return false;
  
  // Only check messages when not currently typing in the input field
  if (document.activeElement?.className !== 'researcher-input') {
    // Compare message IDs to check for changes
    const prevMessageIds = prevProps.messages.map(m => m.id).join(',');
    const nextMessageIds = nextProps.messages.map(m => m.id).join(',');
    
    if (prevMessageIds !== nextMessageIds) return false;
    
    // Check if any existing message status or content changed
    const hasChanges = prevProps.messages.some((oldMsg, index) => {
      const newMsg = nextProps.messages[index];
      return newMsg && (oldMsg.status !== newMsg.status || oldMsg.content !== newMsg.content);
    });
    
    if (hasChanges) return false;
  }
  
  // No meaningful changes detected
  return true;
});

export default ResearcherPanel; 