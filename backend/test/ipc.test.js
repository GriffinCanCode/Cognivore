/**
 * Tests for IPC communication
 * Focuses on ensuring IPC channels are correctly set up
 */

const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const path = require('path');

describe('IPC Communication', () => {
  let ipcMainStub;
  let searchServiceStub;
  let databaseServiceStub;
  let processorStubs;
  let handlers;
  
  beforeEach(() => {
    // Create stubs for IPC and services
    handlers = {};
    
    // Create a proper ipcMain stub with a handle method
    ipcMainStub = {
      handle: sinon.stub().callsFake((channel, handler) => {
        handlers[channel] = handler;
      })
    };
    
    searchServiceStub = {
      semanticSearch: sinon.stub().resolves([
        { id: 'test-id', title: 'Test Document' }
      ])
    };
    
    databaseServiceStub = {
      listItems: sinon.stub().resolves([
        { id: 'test-id', title: 'Test Document', source_type: 'pdf' }
      ]),
      deleteItem: sinon.stub().resolves(true)
    };
    
    processorStubs = {
      processPDF: sinon.stub().resolves({ id: 'new-pdf' }),
      processURL: sinon.stub().resolves({ id: 'new-url' }),
      processYouTube: sinon.stub().resolves({ id: 'new-youtube' })
    };
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should register all required IPC handlers', () => {
    // Mock the electron module to test IPC setup
    const loggerStub = { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub() };
    const createLoggerStub = sinon.stub().returns(loggerStub);

    // The mocking approach needs to be modified to ensure proper access to the ipcMain.handle
    // Mock the electron module with a getter for ipcMain to ensure it's properly accessible
    const electronMock = {
      // Use Object.defineProperty to make a getter that returns our ipcMainStub
      get ipcMain() { return ipcMainStub; }
    };

    const mocks = {
      'electron': electronMock,
      './utils/logger': { createContextLogger: createLoggerStub },
      './services/search': searchServiceStub,
      './services/database': databaseServiceStub,
      './services/pdfProcessor': { processPDF: processorStubs.processPDF },
      './services/urlProcessor': { processURL: processorStubs.processURL },
      './services/youtubeProcessor': { processYouTube: processorStubs.processYouTube }
    };
    
    const ipcHandlers = proxyquire('../src/ipcHandlers', mocks);
    
    // Call the initialize function
    ipcHandlers.initializeIpcHandlers();
    
    // Verify that all expected IPC channels are registered
    expect(ipcMainStub.handle.callCount).toBeGreaterThanOrEqual(5);
    
    // Check for specific channel registrations
    const registeredChannels = Object.keys(handlers);
    
    // Core functionality channels
    expect(registeredChannels).toContain('process-pdf');
    expect(registeredChannels).toContain('process-url');
    expect(registeredChannels).toContain('process-youtube');
    expect(registeredChannels).toContain('delete-item');
    expect(registeredChannels).toContain('list-items');
    
    // Search channel
    expect(registeredChannels).toContain('search');
  });
  
  it('should call the search service with proper parameters', async () => {
    // Mock the electron module to test IPC setup
    const loggerStub = { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub() };
    const createLoggerStub = sinon.stub().returns(loggerStub);

    // Use the same improved mocking approach
    const electronMock = {
      get ipcMain() { return ipcMainStub; }
    };

    const mocks = {
      'electron': electronMock,
      './utils/logger': { createContextLogger: createLoggerStub },
      './services/search': searchServiceStub,
      './services/database': databaseServiceStub,
      './services/pdfProcessor': { processPDF: processorStubs.processPDF },
      './services/urlProcessor': { processURL: processorStubs.processURL },
      './services/youtubeProcessor': { processYouTube: processorStubs.processYouTube }
    };
    
    const ipcHandlers = proxyquire('../src/ipcHandlers', mocks);
    
    // Call the initialize function
    ipcHandlers.initializeIpcHandlers();
    
    // Get the search handler function
    const searchHandler = handlers['search'];
    expect(searchHandler).toBeDefined();
    
    // Call the handler with test data
    const result = await searchHandler({}, 'test query', 5);
    
    // Verify the service was called with proper args
    expect(searchServiceStub.semanticSearch.calledOnce).toBe(true);
    expect(searchServiceStub.semanticSearch.firstCall.args[0]).toBe('test query');
    expect(searchServiceStub.semanticSearch.firstCall.args[1]).toBe(5);
    
    // Verify the handler returns the expected response structure
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
  
  it('should handle search errors properly', async () => {
    // Setup search service to throw an error
    searchServiceStub.semanticSearch.rejects(new Error('Search failed'));
    
    // Mock the electron module to test IPC setup
    const loggerStub = { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub() };
    const createLoggerStub = sinon.stub().returns(loggerStub);

    // Use the improved mocking approach
    const electronMock = {
      get ipcMain() { return ipcMainStub; }
    };

    const mocks = {
      'electron': electronMock,
      './utils/logger': { createContextLogger: createLoggerStub },
      './services/search': searchServiceStub,
      './services/database': databaseServiceStub,
      './services/pdfProcessor': { processPDF: processorStubs.processPDF },
      './services/urlProcessor': { processURL: processorStubs.processURL },
      './services/youtubeProcessor': { processYouTube: processorStubs.processYouTube }
    };
    
    const ipcHandlers = proxyquire('../src/ipcHandlers', mocks);
    
    // Call the initialize function
    ipcHandlers.initializeIpcHandlers();
    
    // Get the search handler function
    const searchHandler = handlers['search'];
    expect(searchHandler).toBeDefined();
    
    // Call the handler with test data
    const result = await searchHandler({}, 'test query', 5);
    
    // Verify the handler returns error response
    expect(result).toHaveProperty('success', false);
    expect(result).toHaveProperty('error', 'Search failed');
  });
}); 