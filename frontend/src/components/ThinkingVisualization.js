/**
 * ThinkingVisualization Component - Animated visualization for AI thinking state
 */

class ThinkingVisualization {
  /**
   * Constructor for ThinkingVisualization component
   */
  constructor() {
    this.container = null;
  }

  /**
   * Render the thinking visualization
   * @returns {HTMLElement} - The rendered component
   */
  render() {
    const container = document.createElement('div');
    container.className = 'thinking-visualization-container';
    
    // Create the main thinking bubble with avatar
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'thinking-bubble';
    
    // Add assistant avatar
    const avatarElement = document.createElement('div');
    avatarElement.className = 'message-avatar';
    avatarElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a9 9 0 0 1 9 9c0 3.1-1.5 5.7-4 7.4L17 22H7l-.1-3.6a10.6 10.6 0 0 1-4-7.4 9 9 0 0 1 9-9Z"/>
        <path d="M9 14h.01"/>
        <path d="M15 14h.01"/>
        <path d="M9.5 8.5C10 7.7 11 7 12 7s2 .7 2.5 1.5"/>
      </svg>
    `;
    thinkingBubble.appendChild(avatarElement);
    
    // Create the visualization content
    const content = document.createElement('div');
    content.className = 'thinking-content';
    
    // Add the thinking text
    const thinkingText = document.createElement('div');
    thinkingText.className = 'thinking-text';
    thinkingText.textContent = 'Thinking';
    
    // Add animated dots
    const dots = document.createElement('div');
    dots.className = 'thinking-dots';
    dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    thinkingText.appendChild(dots);
    
    content.appendChild(thinkingText);
    
    // Create the animated spinner
    const spinner = document.createElement('div');
    spinner.className = 'thinking-spinner';
    
    // Create multiple spinner elements for layered effect
    for (let i = 0; i < 3; i++) {
      const spinnerRing = document.createElement('div');
      spinnerRing.className = `spinner-ring ring-${i + 1}`;
      spinner.appendChild(spinnerRing);
    }
    
    // Create pulsing brain icon in the center
    const brainIcon = document.createElement('div');
    brainIcon.className = 'brain-icon pulse';
    brainIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5V5a2 2 0 0 1 2 2v1.5a.5.5 0 0 0 .5.5.5.5 0 0 1 .5.5.5.5 0 0 0 .5.5h1.5a1 1 0 0 1 1 1 1 1 0 0 0 1 1h1a2 2 0 0 1 2 2v.5a.5.5 0 0 1-.5.5.5.5 0 0 0-.5.5.5.5 0 0 1-.5.5.5.5 0 0 0-.5.5 2 2 0 0 1-2 2 1 1 0 0 0-1 1v1a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2 1 1 0 0 0-1-1h-.5A2.5 2.5 0 0 1 4 16.5v-1.25A2.25 2.25 0 0 1 6.25 13a.75.75 0 0 0 .75-.75V12a1 1 0 0 1 1-1h.5a.5.5 0 0 0 .5-.5.5.5 0 0 1 .5-.5z"></path>
        <path d="M3 5a2 2 0 0 1 2-2h1a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h1"></path>
      </svg>
    `;
    spinner.appendChild(brainIcon);
    
    content.appendChild(spinner);
    thinkingBubble.appendChild(content);
    container.appendChild(thinkingBubble);
    
    // Create shimmer particles for background effect
    const particles = document.createElement('div');
    particles.className = 'thinking-particles';
    
    // Add multiple particle elements
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.animationDelay = `${i * 0.2}s`;
      particles.appendChild(particle);
    }
    
    container.appendChild(particles);
    
    // Save reference to container
    this.container = container;
    
    return container;
  }

  /**
   * Clean up component resources
   */
  cleanup() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export default ThinkingVisualization; 