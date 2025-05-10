/**
 * Tests for IPC communication
 * Focuses on ensuring IPC channels are correctly set up
 */

const { expect } = require('chai');
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

    // Create the electron mock with proper structure
    const electronMock = {
      ipcMain: ipcMainStub
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
    expect(ipcMainStub.handle.callCount).to.be.at.least(5);
    
    // Check for specific channel registrations
    const registeredChannels = Object.keys(handlers);
    
    // Core functionality channels
    expect(registeredChannels).to.include('process-pdf');
    expect(registeredChannels).to.include('process-url');
    expect(registeredChannels).to.include('process-youtube');
    expect(registeredChannels).to.include('delete-item');
    expect(registeredChannels).to.include('list-items');
    
    // Search channel
    expect(registeredChannels).to.include('search');
  });
  
  it('should call the search service with proper parameters', async () => {
    // Mock the electron module to test IPC setup
    const loggerStub = { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub() };
    const createLoggerStub = sinon.stub().returns(loggerStub);

    // Create the electron mock with proper structure
    const electronMock = {
      ipcMain: ipcMainStub
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
    expect(searchHandler).to.exist;
    
    // Call the handler with test data
    const result = await searchHandler({}, 'test query', 5);
    
    // Verify the service was called with proper args
    expect(searchServiceStub.semanticSearch.calledOnce).to.be.true;
    expect(searchServiceStub.semanticSearch.firstCall.args[0]).to.equal('test query');
    expect(searchServiceStub.semanticSearch.firstCall.args[1]).to.equal(5);
    
    // Verify the handler returns the expected response structure
    expect(result).to.have.property('success', true);
    expect(result).to.have.property('results').that.is.an('array');
  });
  
  it('should handle search errors properly', async () => {
    // Setup search service to throw an error
    searchServiceStub.semanticSearch.rejects(new Error('Search failed'));
    
    // Mock the electron module to test IPC setup
    const loggerStub = { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub() };
    const createLoggerStub = sinon.stub().returns(loggerStub);

    // Create the electron mock with proper structure
    const electronMock = {
      ipcMain: ipcMainStub
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
    expect(searchHandler).to.exist;
    
    // Call the handler with test data
    const result = await searchHandler({}, 'test query', 5);
    
    // Verify the handler returns error response
    expect(result).to.have.property('success', false);
    expect(result).to.have.property('error', 'Search failed');
  });
}); 