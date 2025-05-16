/**
 * ResearcherInput - Handles the chat input functionality for the researcher
 */

import logger from '../../../utils/logger.js';
import React, { useRef, useState, memo, useCallback, useEffect } from 'react';
import './ResearcherInput.css';

// Create context-specific logger
const inputLogger = logger.scope('ResearcherInput');

/**
 * ResearcherInput component for rendering the chat input field
 * Memoized to prevent unnecessary re-renders during typing
 */
const ResearcherInput = memo(({ 
  value, 
  onChange, 
  onSubmit, 
  disabled, 
  placeholder,
  autoFocus,
  disabledMessage
}) => {
  const [internalValue, setInternalValue] = useState(value || '');
  const inputRef = useRef(null);
  
  // Update internal value when prop changes
  useEffect(() => {
    if (value !== internalValue && document.activeElement !== inputRef.current) {
      setInternalValue(value || '');
    }
  }, [value]);
  
  // Use callback to prevent recreating function on each render
  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    // Update internal state immediately for responsive UI
    setInternalValue(newValue);
    // Notify parent component of change
    if (onChange) {
      onChange(newValue);
    }
  }, [onChange]);
  
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      const trimmedValue = internalValue.trim();
      if (trimmedValue && onSubmit) {
        onSubmit(trimmedValue);
        setInternalValue('');
      }
    }
  }, [internalValue, onSubmit, disabled]);
  
  const handleSubmitClick = useCallback(() => {
    const trimmedValue = internalValue.trim();
    if (trimmedValue && onSubmit && !disabled) {
      onSubmit(trimmedValue);
      setInternalValue('');
      // Focus back on input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [internalValue, onSubmit, disabled]);
  
  // Focus input on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [autoFocus]);
  
  return (
    <div className={`researcher-input-container ${disabled ? 'disabled' : ''}`}>
      {disabledMessage && disabled && (
        <div className="researcher-input-disabled-message">
          {disabledMessage}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        className="researcher-input"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type a message...'}
        disabled={disabled}
        data-testid="researcher-input-field"
      />
      <button
        className={`researcher-send-button ${!internalValue.trim() || disabled ? 'disabled' : ''}`}
        onClick={handleSubmitClick}
        disabled={!internalValue.trim() || disabled}
        data-testid="researcher-send-button"
        title="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo to determine if re-render is needed
  // Return true if props are equal (no re-render needed)
  return (
    prevProps.disabled === nextProps.disabled &&
    prevProps.disabledMessage === nextProps.disabledMessage &&
    prevProps.placeholder === nextProps.placeholder &&
    // Only re-render for value changes when component is not handling input internally
    (document.activeElement !== document.querySelector('.researcher-input-field') || 
     prevProps.value === nextProps.value)
  );
});

export default ResearcherInput; 