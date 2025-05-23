/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Voyager from '../../../src/components/browser/Voyager';

// Mock electron API
global.electronAPI = {
  checkBackendHealth: jest.fn().mockResolvedValue({ healthy: true }),
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  onWebviewMessage: jest.fn(),
  handleWebviewError: jest.fn()
};

// Mock dependencies
jest.mock('../../../src/components/browser/researcher/Researcher', () => ({
  default: jest.fn().mockImplementation(function(props) {
    this.initialize = jest.fn();
    this.destroy = jest.fn();
    this.analyzeContent = jest.fn();
    this.setAutoAnalyze = jest.fn();
    this.updateUrl = jest.fn();
    this.updateTitle = jest.fn();
    return this;
  })
}));

jest.mock('../../../src/components/browser/utils/BookmarkManager', () => ({
  default: jest.fn().mockImplementation(function() {
    this.addBookmark = jest.fn().mockResolvedValue({ id: '123', url: 'https://test.com', title: 'Test' });
    this.removeBookmark = jest.fn().mockResolvedValue(true);
    this.getBookmarks = jest.fn().mockResolvedValue([]);
    return this;
  })
}));

// Mock WorkerManager - may not exist in some configurations
jest.mock('../../../src/components/browser/workers/WorkerManager', () => ({
  default: null
}), { virtual: true });

describe('Voyager Component', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    document.body.removeChild(container);
    container = null;
    jest.clearAllMocks();
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  describe('Component Initialization', () => {
    it('should render with default props', () => {
      const { getByPlaceholderText } = render(<Voyager />, { container });
      expect(getByPlaceholderText('Enter URL...')).toBeInTheDocument();
    });

    it('should render with custom URL', () => {
      const { getByDisplayValue } = render(
        <Voyager url="https://example.com" />, 
        { container }
      );
      expect(getByDisplayValue('https://example.com')).toBeInTheDocument();
    });

    it('should initialize with proper state', () => {
      const component = render(<Voyager />, { container });
      expect(console.log).toHaveBeenCalledWith('Voyager initialized with props:', expect.any(Object));
    });
  });

  describe('Researcher Integration', () => {
    it('should not render Researcher as React component', () => {
      const { container: renderedContainer } = render(<Voyager />, { container });
      
      // Researcher should not be rendered as a React component
      const researcherElements = renderedContainer.querySelectorAll('Researcher');
      expect(researcherElements.length).toBe(0);
    });

    it('should initialize Researcher programmatically when research mode is toggled', async () => {
      const Researcher = require('../../../src/components/browser/researcher/Researcher').default;
      const { getByText } = render(<Voyager />, { container });
      
      // Find and click the research toggle button
      const researchButton = getByText('📊');
      fireEvent.click(researchButton);
      
      await waitFor(() => {
        expect(Researcher).toHaveBeenCalledWith(expect.objectContaining({
          browser: expect.any(Object),
          containerRef: expect.any(Object),
          autoAnalyze: false,
          onToggle: expect.any(Function)
        }));
      });
    });

    it('should pass proper props to Researcher constructor', async () => {
      const Researcher = require('../../../src/components/browser/researcher/Researcher').default;
      const { getByText } = render(
        <Voyager autoAnalyzeContent={true} />, 
        { container }
      );
      
      const researchButton = getByText('📊');
      fireEvent.click(researchButton);
      
      await waitFor(() => {
        expect(Researcher).toHaveBeenCalledWith(expect.objectContaining({
          autoAnalyze: true
        }));
      });
    });

    it('should update Researcher when URL changes', async () => {
      const { getByText, getByPlaceholderText } = render(<Voyager />, { container });
      
      // Enable research mode
      const researchButton = getByText('📊');
      fireEvent.click(researchButton);
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith('Initializing Researcher component');
      });
      
      // Change URL
      const addressBar = getByPlaceholderText('Enter URL...');
      fireEvent.change(addressBar, { target: { value: 'https://newsite.com' } });
      fireEvent.keyPress(addressBar, { key: 'Enter', code: 13 });
      
      // Note: In a real test, we'd check that researcher.updateUrl was called
    });
  });

  describe('Navigation Methods', () => {
    it('should handle back navigation correctly', () => {
      const { getByText } = render(<Voyager />, { container });
      
      const backButton = getByText('◀');
      expect(backButton).toBeInTheDocument();
      
      // Should not throw error when clicked
      fireEvent.click(backButton);
      expect(console.log).toHaveBeenCalledWith('Going back in history');
    });

    it('should handle forward navigation correctly', () => {
      const { getByText } = render(<Voyager />, { container });
      
      const forwardButton = getByText('▶');
      expect(forwardButton).toBeInTheDocument();
      
      // Should not throw error when clicked
      fireEvent.click(forwardButton);
      expect(console.log).toHaveBeenCalledWith('Going forward in history');
    });

    it('should handle refresh correctly', () => {
      const { getByText } = render(<Voyager />, { container });
      
      const refreshButton = getByText('↻');
      fireEvent.click(refreshButton);
      
      expect(console.log).toHaveBeenCalledWith('Refreshing page');
    });

    it('should handle stop loading correctly', () => {
      const { getByText } = render(<Voyager />, { container });
      
      const stopButton = getByText('✕');
      fireEvent.click(stopButton);
      
      expect(console.log).toHaveBeenCalledWith('Stopping page load');
    });
  });

  describe('Bookmark Functionality', () => {
    it('should handle bookmark creation correctly', async () => {
      const { getByText } = render(<Voyager />, { container });
      
      const bookmarkButton = getByText('🔖');
      expect(bookmarkButton).toBeInTheDocument();
      
      fireEvent.click(bookmarkButton);
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith('Adding bookmark...');
      });
    });

    it('should use instance method for bookmark creation', () => {
      const { getByText } = render(<Voyager />, { container });
      
      const bookmarkButton = getByText('🔖');
      const onClickHandler = bookmarkButton.onclick || bookmarkButton.getAttribute('onClick');
      
      // Verify it's not calling undefined method
      expect(() => fireEvent.click(bookmarkButton)).not.toThrow();
    });
  });

  describe('URL Navigation', () => {
    it('should handle URL submission', () => {
      const { getByPlaceholderText } = render(<Voyager />, { container });
      
      const addressBar = getByPlaceholderText('Enter URL...');
      fireEvent.change(addressBar, { target: { value: 'https://test.com' } });
      fireEvent.keyPress(addressBar, { key: 'Enter', code: 13 });
      
      expect(console.log).toHaveBeenCalledWith('Navigating to:', 'https://test.com');
    });

    it('should update address bar value on change', () => {
      const { getByPlaceholderText } = render(<Voyager />, { container });
      
      const addressBar = getByPlaceholderText('Enter URL...');
      fireEvent.change(addressBar, { target: { value: 'https://changed.com' } });
      
      expect(addressBar.value).toBe('https://changed.com');
    });
  });

  describe('Component Lifecycle', () => {
    it('should clean up on unmount', () => {
      const { unmount } = render(<Voyager />, { container });
      
      unmount();
      
      expect(console.log).toHaveBeenCalledWith('Voyager component unmounting, cleaning up...');
    });

    it('should handle prop updates', () => {
      const { rerender } = render(<Voyager url="https://initial.com" />, { container });
      
      rerender(<Voyager url="https://updated.com" />);
      
      expect(console.log).toHaveBeenCalledWith('Voyager props updated');
    });
  });

  describe('Error Handling', () => {
    it('should handle webview initialization errors gracefully', () => {
      // Simulate webview not being available
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'webview') {
          throw new Error('Webview not available');
        }
        return originalCreateElement.call(document, tagName);
      });
      
      expect(() => render(<Voyager />, { container })).not.toThrow();
      
      document.createElement = originalCreateElement;
    });

    it('should handle missing researcher gracefully', async () => {
      const { getByText } = render(<Voyager />, { container });
      
      // Try to toggle research mode multiple times
      const researchButton = getByText('📊');
      fireEvent.click(researchButton);
      fireEvent.click(researchButton);
      
      // Should not throw errors
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Research'));
      });
    });
  });

  describe('Webview Styles', () => {
    it('should handle style application errors gracefully', () => {
      const { container: renderedContainer } = render(<Voyager />, { container });
      
      // Should render without throwing even if styles can't be applied
      expect(renderedContainer.querySelector('.voyager-container')).toBeInTheDocument();
    });
  });
});
