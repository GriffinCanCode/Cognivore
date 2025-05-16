/**
 * ResearcherMessages - Handles rendering of research chat messages
 */

import messageFormatter from '../../../utils/messageFormatter.js';
import logger from '../../../utils/logger.js';
import ThinkingVisualization from '../../renderers/ThinkingVisualization.js';
import DOMPurify from 'dompurify';
import React, { memo, useMemo } from 'react';
import './ResearcherMessages.css';

// Create context-specific logger
const messagesLogger = logger.scope('ResearcherMessages');

/**
 * Individual message component that renders a single chat message
 * Memoized to prevent re-renders unless content changes
 */
const Message = memo(({ message }) => {
  // Prevent re-renders when parent component re-renders
  const messageContent = useMemo(() => {
    if (message.role === 'tool') {
      try {
        // Check if we need to handle special tool formatting
        if (message.name === 'searchKnowledgeBase') {
          // Parse JSON content for knowledge base search results
          const content = typeof message.content === 'string' &&
                        (message.content.startsWith('{') || message.content.startsWith('[')) ?
                        JSON.parse(message.content) : message.content;
          
          if (content && content.results && Array.isArray(content.results)) {
            return (
              <div className="search-results">
                <div className="search-info">Found {content.results.length} results for: {content.query}</div>
                {content.results.map((result, idx) => (
                  <div key={idx} className="search-result-item">
                    <div className="result-title">{result.title}</div>
                    <div className="result-preview">{result.contentPreview || result.summary}</div>
                    <div className="result-meta">
                      <span className="result-type">{result.sourceType}</span>
                      <span className="result-score">Relevance: {Math.round(result.score * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          }
        } else if (message.name === 'summarizeContent') {
          // Format summarization results
          const content = typeof message.content === 'string' && 
                        message.content.startsWith('{') ?
                        JSON.parse(message.content) : message.content;
          
          if (content && content.summary) {
            return (
              <div className="summary-result">
                <div className="summary-text">{content.summary}</div>
                {content.keyPoints && content.keyPoints.length > 0 && (
                  <div className="key-points">
                    <div className="key-points-title">Key Points:</div>
                    <ul>
                      {content.keyPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          }
        }
        
        // Default JSON formatting for other tools or fallback
        const content = typeof message.content === 'string' && 
                      (message.content.startsWith('{') || message.content.startsWith('[')) ?
                      JSON.stringify(JSON.parse(message.content), null, 2) :
                      message.content;
        return (
          <pre className="tool-content">{content}</pre>
        );
      } catch (e) {
        // Fallback to regular text with line breaks
        return (
          <div dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(message.content).replace(/\n/g, '<br>') 
          }} />
        );
      }
    } else {
      // Regular message
      return (
        <div dangerouslySetInnerHTML={{ 
          __html: DOMPurify.sanitize(message.content).replace(/\n/g, '<br>') 
        }} />
      );
    }
  }, [message.content, message.role, message.name]);
  
  // Format timestamp once and memoize it
  const formattedTime = useMemo(() => {
    if (!message.timestamp) return null;
    return new Date(message.timestamp).toLocaleTimeString();
  }, [message.timestamp]);
  
  return (
    <div className={`research-message ${message.role} ${message.isError ? 'error' : ''}`} 
         data-message-id={message.id}>
      <div className="message-content">
        <div className="message-role">
          {message.role === 'user' ? 'You' : 
           message.role === 'tool' ? `Tool: ${message.name}` : 
           'Research Assistant'}
        </div>
        <div className="message-text">
          {message.role === 'tool' && (
            <div className={`tool-status ${message.status || 'running'}`}>
              {message.status === 'completed' ? '✓ ' : 
               message.status === 'error' ? '✗ ' : 
               '⋯ '}
            </div>
          )}
          {messageContent}
        </div>
        {formattedTime && (
          <div className="message-timestamp">{formattedTime}</div>
        )}
      </div>
      
      {/* Render tool calls if present */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="tool-calls">
          {message.toolCalls.map((toolCall, index) => (
            <div className="tool-call" key={`${message.id}-tool-${index}`}>
              <div className="tool-call-header">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                     fill="none" stroke="currentColor" strokeWidth="2" 
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
                <span>Tool: {toolCall.name}</span>
              </div>
              {toolCall.args && (
                <div className="tool-call-args">
                  <pre>{JSON.stringify(toolCall.args, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for message component
  // Only re-render if important properties change
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.isError === nextProps.message.isError
  );
});

/**
 * Loading indicator component for when messages are being processed
 */
const LoadingIndicator = () => (
  <div className="research-message assistant loading">
    <div className="typing-indicator">
      <div className="message-role">Research Assistant</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span>Thinking</span>
        <span style={{ display: 'inline-block', marginLeft: '4px', animation: 'blink 1.4s infinite both' }}>.</span>
        <span style={{ display: 'inline-block', marginLeft: 0, animation: 'blink 1.4s 0.2s infinite both' }}>.</span>
        <span style={{ display: 'inline-block', marginLeft: 0, animation: 'blink 1.4s 0.4s infinite both' }}>.</span>
      </div>
    </div>
  </div>
);

/**
 * Messages container component
 * Memoized to only re-render when the messages list actually changes
 */
const ResearcherMessages = memo(({ messages, loading, onRetry }) => {
  // Track the last set of message IDs to only re-render when messages actually change
  const messageIds = useMemo(() => {
    return messages ? messages.map(m => m.id).join(',') : '';
  }, [messages]);
  
  // If there are no messages, render an empty state
  if (!messages || messages.length === 0) {
    return (
      <div className="research-messages-container empty" data-testid="research-messages-empty">
        <div className="research-messages-empty">
          <div className="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" 
                 fill="none" stroke="currentColor" strokeWidth="2" 
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>No messages yet</h3>
          <p>Ask a question or use the research features to analyze the current page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="research-messages-container" data-testid="research-messages-container">
      {messages.map(message => (
        <Message 
          key={message.id} 
          message={message} 
          onRetry={onRetry} 
        />
      ))}
      {loading && <LoadingIndicator />}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if any of these change
  return (
    prevProps.loading === nextProps.loading &&
    // Compare message IDs as a string to efficiently check if the array changed
    prevProps.messages.map(m => m.id).join(',') === nextProps.messages.map(m => m.id).join(',') &&
    // Check if any existing message status changed
    !prevProps.messages.some((oldMsg, index) => {
      const newMsg = nextProps.messages[index];
      return newMsg && (oldMsg.status !== newMsg.status || oldMsg.content !== newMsg.content);
    })
  );
});

export default ResearcherMessages; 