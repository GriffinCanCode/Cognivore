/**
 * ResearcherThinkingVisualization - Animated visualization for document analysis state
 * Displays when AI is processing or analyzing document content
 */

import React, { useEffect, useRef } from 'react';
import './ResearcherThinkingVisualization.css';

const ResearcherThinkingVisualization = ({ 
  message = 'Analyzing document', 
  type = 'default',
  size = 'medium'
}) => {
  const containerRef = useRef(null);
  const particlesRef = useRef([]);
  
  // Generate random particles on mount
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const particlesContainer = container.querySelector('.researcher-thinking-particles');
      
      if (particlesContainer) {
        // Clear existing particles
        while (particlesContainer.firstChild) {
          particlesContainer.removeChild(particlesContainer.firstChild);
        }
        
        // Create new particles
        const particleCount = size === 'small' ? 3 : size === 'large' ? 7 : 5;
        
        for (let i = 0; i < particleCount; i++) {
          const particle = document.createElement('div');
          particle.className = 'researcher-thinking-particle';
          particle.style.animationDelay = `${i * 0.2}s`;
          particle.style.left = `${Math.random() * 100}%`;
          particle.style.top = `${Math.random() * 100}%`;
          particlesContainer.appendChild(particle);
          particlesRef.current.push(particle);
        }
      }
    }
    
    // Cleanup function
    return () => {
      particlesRef.current = [];
    };
  }, [size]);
  
  return (
    <div 
      ref={containerRef}
      className={`researcher-thinking-visualization ${type} ${size}`}
      data-testid="researcher-thinking-visualization"
    >
      <div className="researcher-thinking-content">
        <div className="researcher-thinking-icon">
          {type === 'analysis' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path>
              <line x1="2" y1="20" x2="2" y2="20"></line>
            </svg>
          ) : type === 'extraction' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a9 9 0 0 1 9 9c0 3.1-1.5 5.7-4 7.4L17 22H7l-.1-3.6a10.6 10.6 0 0 1-4-7.4 9 9 0 0 1 9-9Z"/>
              <path d="M9 14h.01"/>
              <path d="M15 14h.01"/>
              <path d="M9.5 8.5C10 7.7 11 7 12 7s2 .7 2.5 1.5"/>
            </svg>
          )}
        </div>
        
        <div className="researcher-thinking-spinner">
          <div className="researcher-spinner-ring ring-1"></div>
          <div className="researcher-spinner-ring ring-2"></div>
          <div className="researcher-spinner-ring ring-3"></div>
        </div>
        
        <div className="researcher-thinking-message">
          <span>{message}</span>
          <div className="researcher-thinking-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        </div>
      </div>
      
      <div className="researcher-thinking-particles"></div>
      
      <div className="researcher-thinking-progress">
        <div className="researcher-thinking-progress-track">
          <div className="researcher-thinking-progress-bar"></div>
        </div>
      </div>
    </div>
  );
};

export default ResearcherThinkingVisualization; 