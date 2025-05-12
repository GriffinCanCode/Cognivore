## [0.3.32] - New Chat Button and Header Fix

### Fixed
- Fixed New Chat button not working in the chat interface
  - Added callback connection between ChatHeader and ChatUI components
  - Implemented proper event listener for New Chat button
  - Added setNewChatCallback method to ChatHeader.js
  - Updated ChatUI to connect with ChatHeader
  - Enhanced UI feedback with notifications on new chat creation
- Fixed duplicate header issue
  - Removed duplicate header rendering in ChatUI component
  - Added setHeaderComponent method to connect to existing header
  - Modified component architecture to maintain proper header ownership
  - Updated App.js to connect ChatUI with the application header

## [0.3.31] - Database Storage Location Fix

### Fixed
- Fixed database creating duplicate storage in the frontend directory
  - Updated database path configuration to use proper application data directory
  - Added explicit storage path configuration in config/index.js
  - Created consistent data directory structure with absolute paths
  - Modified main.js to properly pass user data path to backend
  - Added environment variable APP_USER_DATA_PATH for consistent paths
  - Enhanced database.js to use explicit storage paths without fallbacks
  - Unified storage location to userData directory for proper persistence

## [0.3.30] - Sieve Component UI Refinements

### Changed
- Enhanced Sieve component with streamlined UI and improved visual effects
  - Removed card reflection effect for cleaner appearance
  - Replaced "View" button with "Flip" button for more intuitive interaction
  - Enhanced title styling with animated letter effects similar to Mnemosyne
  - Added particle and glow effects to title for visual consistency
  - Improved card flipping animation with smoother transitions

## [0.3.29] - YouTube Video Thumbnail Preview and Link

### Added
- Enhanced YouTube video handling with thumbnail preview and direct video links
  - Added thumbnail extraction and storage in database.js
  - Implemented thumbnail display in Sieve component with play button overlay
  - Added direct "Watch" button to YouTube items in Sieve component
  - Created clickable thumbnails that open YouTube videos in a new tab
  - Implemented YouTube link display on video cards

## [0.3.28] - Sieve Component UI Enhancements

### Changed
- Enhanced Sieve component with modern UI details and visual improvements
  - Added subtle gradient and pattern overlay to component background
  - Improved header with animated accent line and title glow effect
  - Enhanced refresh button with shine animation and interactive feedback
  - Added depth to filter section with subtle shadows and backdrop blur
  - Improved filter buttons with animated underline indicators
  - Enhanced card styling with better shadows, gradients and hover effects
  - Improved micro-interactions and transition animations throughout
  - Optimized card flip animations with better timing functions
  - Added subtle particles and glow effects for modern aesthetic

## [0.3.27] - Removed Deprecated Sidebar Navigation Items

### Changed
- Removed deprecated "Search" and "Categories" buttons from sidebar
  - Removed items from navItems array in Sidebar.js
  - Updated CSS animation delays in sidebar.css to match fewer navigation items
  - These features have been replaced by agent and Mnemosyne functionality
  - 
## [0.3.26] - Advanced Memory Management for Embedding Operations

### Added
- Enhanced memory management system for handling large embedding operations
  - Added `backend/src/memory/batchOptimizer.js`: Specialized batch optimizer for embedding operations
  - Implemented improved memory pressure detection and handling
  - Added embedding-specific batch size calculation with dynamic adjustment
  - Created batch tracking system to monitor active processing operations
  - Added delayed garbage collection strategy for more effective memory reclamation

### Changed
- Updated DbMemoryManager with more robust memory pressure handling
  - Added staged garbage collection with cooldown periods to prevent excessive GC
  - Implemented critical memory pressure detection and emergency actions
  - Added memory pressure state tracking for better cross-component coordination
  - Enhanced cache clearing strategy with immediate effect during high memory usage
- Enhanced MemoryManager with embedding-specific optimizations
  - Added specialized batch size calculation for embedding operations
  - Implemented batch tracking with automatic memory reclamation
  - Added support for handling embedding vectors with optimized size calculation
  - Improved garbage collection strategy with multi-phase approach
  - Enhanced memory monitoring with more detailed statistics

### Fixed
- Fixed memory pressure issues during large YouTube content processing
  - Resolved issue where memory usage remained high even after cache clearing
  - Fixed ineffective garbage collection during embedding operations
  - Added safeguards to prevent processing excessive batch sizes under memory pressure
  - Implemented automatic batch size reduction for large documents
  - Added document size detection to prevent memory exhaustion

## [0.3.25] - Enhanced Mnemosyne Dark Theme UI

### Changed
- Enhanced Mnemosyne card UI with darker, more visually striking design
  - Updated card backgrounds with deeper, richer dark tones
  - Added subtle particle effects and enhanced glow animations
  - Improved button hover effects with dynamic glowing animations
  - Enhanced card headers with gradient backgrounds for visual depth
  - Added card-specific particle effects for visual interest on hover
  - Updated input styling for better contrast and visibility
  - Enhanced title and text effects with improved shadows
  - Implemented consistent dark theme variables for better theme cohesion
  - Added subtle glow pulse animations to cards for modern aesthetic

## [0.3.24] - Sieve Component Loading Spinner Removal

### Changed
- Removed loading spinner from Sieve component to prevent UI blocking
  - Eliminated loading state logic to ensure items are always displayed
  - Bypassed loading and error states that were preventing content visibility
  - Simplified item display logic for more consistent rendering
  - Fixed race conditions in item rendering
  - Removed shouldUpdate check to always refresh content
  - Ensured direct rendering of content without intermediate loading states

## [0.3.23] - Sieve Component Memoization Fix

### Fixed
- Fixed Sieve component getting stuck in loading state after adding memoization
  - Implemented a proper memoization system with cache clearing capability
  - Created centralized memoization management with named caches
  - Added explicit loading state management with proper state tracking
  - Enhanced loading and error states with better DOM management
  - Added additional logging to improve debugging
  - Implemented short delay for DOM updates to ensure rendering completes
  - Fixed race conditions in loading state management
  - Added proper timeout handling for backend requests

## [0.3.22] - Sieve Component Loading State Fix

### Fixed
- Fixed critical issue where Sieve component would get stuck in loading state
  - Added timeout handling to prevent infinite loading
  - Improved error handling for malformed API responses
  - Added proper state cleanup to prevent stale data
  - Enhanced shouldUpdate method with better null checking
  - Fixed memoization cache clearing during refresh
  - Added safety checks for invalid data throughout rendering process
  - Added graceful error recovery to ensure UI is always responsive

## [0.3.21] - Sieve Component Performance and Animation Enhancements

### Added
- Added enhanced delete animation for Sieve component items
  - Implemented multi-step keyframe animation for smoother deletion effect
  - Added scale, shadow, and translation effects for more visual feedback
  - Synchronized animation timing with component cleanup for smoother transitions

### Improved
- Optimized Sieve component performance with memoization techniques
  - Added memoization for expensive rendering functions to reduce CPU usage
  - Implemented shouldUpdate method to prevent unnecessary re-renders
  - Added memoized cache for component-wide optimization
  - Improved item removal with smarter DOM manipulation
  - Reduced render cycles with component update checking
  - Enhanced display logic to only redraw changed items
  - Added render count tracking for debugging performance issues

## [0.3.20] - Sieve Component Delete Button Fix

### Fixed
- Fixed deletion functionality in Sieve component
  - Added visual indication during deletion to prevent multiple clicks
  - Prevented aggressive page reloads by throttling refreshes after deletion
  - Implemented optimistic UI updates - removing items locally before server refresh
  - Added cleanup for smooth animation when deleting items from the grid
  - Enhanced error handling for better resilience when deletion fails
  - Improved backend database `deleteItem` function with better logging and error handling
  - Added safety checks to prevent duplicate deletion requests
  - Fixed styling for delete button disabled state during deletion

## [0.3.19] - Sieve Component View Button Fix

### Fixed
- Fixed View button functionality in Sieve component
  - Updated database.js to include preview text in listItems response for proper content display
  - Enhanced createItemCard with better ID handling to prevent errors with null/undefined IDs
  - Improved handleCardFlip with better validation and error logging
  - Fixed retry button in error state to properly use event handler instead of inline onclick
  - Added fallback ID generation for items without IDs to prevent rendering issues
  - Fixed card flip animation by adding proper 3D transform properties and z-index handling
  - Added debug logging for card flip operations to help troubleshoot flipping issues
  - Increased preview content length for better card information display
  - Added setTimeout to ensure DOM updates before applying flip class

## [0.3.18] - Database Schema Field Handling Fix

### Fixed
- Fixed database insertion errors by adding proper field handling
  - Added handling for required fields in database schema that were missing:
    - `text_chunks`: Added creation from extracted_text or a placeholder for empty content
    - `summary`: Added placeholder summary generation from title or default text
    - `transcript`: Added proper handling for video content vs non-video content
    - `compressed`: Added default false value to the compressed flag field
  - Enhanced error handling in database operations with better logging
  - Improved database compatibility with vectordb schema requirements

## [0.3.17] - Improved API Key Handling

### Added
- Added `setup-api-keys.js` tool for easy API key configuration
- Created detailed API_KEYS.md documentation for troubleshooting and setup
- Improved .env file detection in embedding service to find and load OpenAI API keys from multiple locations

### Fixed
- Fixed OpenAI embedding service to properly detect and load API keys from .env files
- Enhanced error handling when API keys are missing or invalid
- Made OpenAI embedding generation more robust with better error handling

## [0.3.16] - Switched Embedding Service to OpenAI

### Changed
- Updated embedding service to use OpenAI instead of Google Vertex AI
  - Removed Google Vertex AI embedding implementation
  - Removed `google-auth-library` dependency
  - Modified `backend/src/services/embedding.js` to use OpenAI exclusively
  - Updated getOpenAIEmbedding function to support text-embedding-3-small and text-embedding-3-large models
  - Added dimensions parameter support for OpenAI text-embedding-3 models
  - Enhanced payload creation with model-specific options
  - Maintained all existing functionality including caching, batching, and fallback

## [0.3.15] - Enhanced File Storage System and Embedding Integration

### Added
- Implemented comprehensive file storage system for knowledge management
  - Added file storage capabilities to database service for PDFs, websites, and videos
  - Enhanced database schema with file paths, sizes, and compression information
  - Created transcript storage with lossless compression for YouTube videos
  - Added automatic file management with cleanup on item deletion
- Upgraded embedding service with professional model integration
  - Integrated actual embedding model via environment variable EMBEDDING_MODEL=embedding-005
  - Added embedding caching to reduce API calls and improve performance
  - Implemented fallback mechanism for offline embedding generation
  - Enhanced memory efficiency with optimized vector handling
  - Added Google Vertex AI authentication with Application Default Credentials
  - Implemented rate limiting with exponential backoff for API calls
  - Added smart batch processing with dynamic adjustment based on text length
  - Improved error handling and retry logic for embedding generation
  - Added Google Vertex AI embedding model support for text-embedding-005
  - Implemented automatic provider selection based on model name
  - Added GCP authentication for Vertex AI API access
  - Fixed Vertex AI authentication using Google Auth Library and ADC
  - Added field name normalization for database compatibility (camelCase to snake_case)
  - Improved error handling during authentication and database operations
- Improved Mnemosyne component with enhanced file storage integration
  - Updated file processing with options for storing original files
  - Added file size information display in content summary
  - Enhanced YouTube processing with transcript preservation

### Changed
- Optimized database operations for better performance
  - Added intelligent compression for text content using zlib
  - Enhanced memory management during vector operations
  - Improved file storage with type-specific organization
  - Added file existence checking to prevent duplicate storage
- Enhanced content processing workflow
  - Improved PDF processing with original file preservation
  - Enhanced web content storage with screenshots and HTML content
  - Added comprehensive metadata storage for all content types
  - Improved error handling during file operations

### Fixed
- Fixed missing file handling in document retrieval process
- Improved content processing feedback with detailed success notifications
- Enhanced error reporting during file operations with specific error messages
- Database field naming compatibility (camelCase to snake_case conversion)
- Embedding service authentication with Google Vertex AI
- Rate limit handling for embedding generation API calls
- Type compatibility issue in embedding batch processor (fixed "textChunks.reduce is not a function" error)
- Improved handling of single string inputs in batch embedding functions

### Improved
- Memory management during embedding generation
- Reliability of batch processing with timeout handling
- Optimized batch sizing based on content length

## [0.3.14] - Card Flip Content Viewing

### Added
- Implemented card flip animation for viewing content details
  - Content now displayed by flipping cards in place instead of opening a separate viewer
  - Each knowledge card can be flipped to reveal detailed content on the back
  - Added smooth transitions and animations for a premium user experience

### Changed
- Removed reliance on separate ContentViewer component for Sieve
- Enhanced metadata display with better formatting and organization
- Added copy and export functionality directly on flipped cards
- Improved scroll behavior with hidden scrollbars while maintaining scrollability

### Fixed
- Fixed layout issues when viewing content on different screen sizes
- Improved content preview truncation to avoid layout shifts

## [0.3.13] - UI Enhancements for Knowledge Management

### Changed
- Improved scrolling behavior with hidden scrollbars for cleaner interface
  - Updated Sieve component to support scrolling without visible scrollbars
  - Applied consistent scrolling behavior across all content areas
- Enhanced ContentViewer design with modern glass morphism UI
  - Added animations for a more polished user experience
  - Improved information hierarchy with clearer typography

## [0.3.12] - Sieve Knowledge Management Component

### Added
- Created new Sieve component for enhanced knowledge management
  - Implemented `frontend/src/components/Sieve.js`: Modern UI for filtering and browsing knowledge items
  - Added `frontend/public/styles/components/sieve.css`: Dedicated responsive styling for Sieve component 
  - Created card-based grid layout for better content visualization
  - Implemented filtering by content type (PDF, Web, Video)
  - Added search functionality for finding specific knowledge items
  - Enhanced item preview with better text truncation
  - Added smooth loading states and animations
  - Integrated with existing document management system
- Updated Sidebar with Sieve navigation item
  - Added Sieve to the Library section of the sidebar
  - Used wave icon to represent the filtering nature of Sieve
- Integrated Sieve component with main App.js
  - Added proper initialization and cleanup for component lifecycle
  - Ensured content updates flow properly to Sieve component

### Changed
- Enhanced content navigation with more specialized components
  - Added explicit component for knowledge organization and filtering
  - Enhanced document management workflow with multiple view options

## [0.3.11] - Sidebar UI Improvement

### Changed
- Improved sidebar collapsed state UI
  - Hid user avatar in collapsed state for better visual consistency
  - Centered toggle button in sidebar footer when collapsed
  - Fixed spacing issues in collapsed sidebar state
  - Completely hidden logo when sidebar is collapsed for cleaner minimal interface

## [0.3.10] - Navigation and Rendering Fix

### Fixed
- Fixed UI navigation and rendering glitches
  - Added throttling to prevent excessive IPC calls
  - Fixed sidebar active item state when viewing the Mnemosyne page
  - Removed circular update triggers between components
  - Prevented repeated list refreshes causing UI instability
  - Resolved Cognivore remaining selected when on Mnemosyne page

## [0.3.10] - Dark Mode UI Update

### Changed
- Modified theme handling to use dark mode only
  - Removed light/dark mode toggle from UI
  - Updated ThemeSwitcher component to always use dark mode
  - Fixed theme implementation to prevent accidental light mode switching

### Fixed
- Fixed alignment between sidebar collapse button and chat input container for better visual consistency
- Improved sidebar footer positioning to stay fixed at the bottom of the sidebar

## [0.3.9] - UI Enhancements

### Changed
- Updated UI components for better user experience
  - Modified sidebar to start in collapsed state by default
  - Removed scrollbars from the application for cleaner interface
  - Renamed "Documents" page to "Mnemosyne" in sidebar navigation
  - Renamed "AI Assistant" to "Cognivore" throughout the application

## [0.3.8] - IPC Handler Registration Fix

### Fixed
- Fixed critical IPC handler registration conflict causing chat and document functionality to fail
  - Modified `backend/src/ipcHandlers.js` to safely register handlers without conflicts
  - Added handler collision detection to prevent duplicate registrations
  - Implemented fallback handling to skip already registered handlers instead of failing
  - Enhanced error reporting for initialization issues
  - Fixed "No handler registered for 'chat'" error that was preventing chat function
  - Fixed "No handler registered for 'list-items'" error that was preventing document listing
  - Fixed "No handler registered for 'process-pdf'" error that was preventing document uploads

## [0.3.7] - Gemini System Role Compatibility Fix

### Fixed
- Fixed critical "Content with system role is not supported" error with Gemini models
  - Updated `frontend/src/services/LlmService.js` to convert system prompts to user messages with special formatting
  - Modified system prompt integration to be compatible with Gemini 2.0 Flash
  - Enhanced `backend/src/services/llm.js` to properly handle role conversion for Gemini API
  - Added better error handling for system role issues
  - Ensured proper conversation flow when converting system instructions to user messages

## [0.3.6] - Centralized Tool Definitions

### Added
- Created centralized tool definition system for frontend and backend
  - Implemented `frontend/src/services/tools/sharedToolDefinitions.js`: Single source of truth for all tools
  - Added `backend/src/utils/toolDefinitionsAdapter.js`: Backend adapter for shared definitions
  - Implemented tool validation to ensure consistency across codebase
  - Added location-based filtering to manage tool availability (frontend/backend/both)
  - Created utility functions for accessing and working with tool definitions

### Changed
- Refactored tools system for unified definitions
  - Updated `frontend/src/services/systemPrompt.js` to use shared tool definitions
  - Modified `frontend/src/services/tools/index.js` to support shared definitions
  - Updated `backend/src/services/tools.js` to validate against shared definitions
  - Added backward compatibility notes to `frontend/src/services/tools/toolRegistry.json`
  - Improved tool registration and validation process in backend
  - Enhanced error handling for missing tool implementations

### Fixed
- Fixed module compatibility issues between frontend and backend
  - Resolved "Unexpected token 'export'" error in shared tool definitions
  - Updated backend tools service to properly initialize logger before use
  - Simplified toolDefinitionsAdapter to use embedded definitions rather than dynamic imports
  - Fixed ES module/CommonJS compatibility in frontend module exports
  - Improved handling of module loading across different environments
  - Added cross-environment support for both Electron renderer and Node.js contexts

## [0.3.5] - System Prompt Integration

### Added
- Created modular system prompt management for agent configuration
  - Implemented `frontend/src/services/systemPrompt.js`: Defines agent purpose and available tools
  - Added configurable system prompt functions with user personalization
  - Created minimal system prompt option for lightweight interactions
  - Implemented tool definition standardization for consistent schema
- Enhanced LLM service with system prompt integration
  - Updated `frontend/src/services/LlmService.js` to use system prompts
  - Added automatic system prompt insertion for chat history
  - Created helper methods for generating different system prompt types
  - Improved chat handling with proper system message integration

### Changed
- Refactored tool definitions to use centralized system
  - Moved tool definitions from LlmService to systemPrompt module
  - Enhanced consistency between frontend and backend tool definitions
  - Improved organization of tool-related code
- Updated chat processing pipeline
  - Added formatChatHistoryWithSystemPrompt for automatic system prompt insertion
  - Enhanced sendMessage method to use configured system prompts
  - Improved chat initialization with proper system context

## [0.3.4] - Retrieval Augmented Generation (RAG) System

### Added
- Implemented Retrieval Augmented Generation (RAG) system for LLM integration
  - Added semanticSearch function to database.js for optimized RAG queries
  - Added getItemById function to database.js for efficient content retrieval
  - Created backend LLM service (llm.js) for Gemini model interactions
  - Added RAG tools to tools.js (searchKnowledgeBase, getItemContent, recommendRelatedContent)
  - Enhanced IPC handlers to support LLM chat, embedding generation, and tool execution
  - Implemented memory-optimized content processing with token counting

### Changed

### Fixed

## [0.3.3] - Chat Message Freezing Fix

### Fixed
- Fixed critical issue with chat messages freezing when sent
  - Enhanced ChatInput with improved error handling and explicit console logging for debugging
  - Added timeout protection to prevent infinite loading states
  - Fixed event binding issues in ChatInput to ensure handleSubmit is properly called
  - Added more robust server port detection to prevent conflicts
  - Improved preload.js IPC bridge with timeout handling and better error recovery
  - Enhanced error reporting to provide more helpful feedback to users
  - Added explicit loading state management in ChatUI component

## [0.3.2] - Message Handling and Backend Connection Fix

### Fixed
- Fixed critical issues with message handling in chat interface
  - Enhanced ChatUI.handleSubmit() with more robust error handling and connection checks
  - Added timeout handling for backend connections to prevent hangs
  - Improved error reporting with specific, user-friendly error messages
  - Added forceFullRerender() method to recover from DOM detachment issues
  - Fixed UI update process to ensure messages are always displayed
- Improved backend server port handling and connection stability
  - Enhanced port conflict detection and resolution in server.js
  - Added more comprehensive error handling for server startup
  - Improved port availability checking with timeout protection
  - Added automatic process termination for stuck ports
  - Extended retry mechanism for finding available ports
- Enhanced LlmService with better connectivity handling
  - Added timeout protection for backend health checks
  - Implemented progressive retry with increasing timeout windows
  - Added detailed error reporting for different failure scenarios
  - Improved connection retry logic with better error classification

## [0.3.1] - Mnemosyne Document Processing UI

### Added
- Created new Mnemosyne component for centralized document processing
  - Implemented `frontend/src/components/Mnemosyne.js`: Visual component for document processing workflow
  - Added `frontend/public/mnemosyne.css`: Dedicated styling for the Mnemosyne component
  - Created card-based interface with three content types (PDF, Web URL, YouTube)
  - Implemented modern, visually appealing document processing UI
  - Added responsive design with mobile support
  - Integrated with existing DocProcessor service for backend communication
  - Added content list with type badges and actions (view, delete)
- Enhanced document processing experience
  - Implemented file name display for selected PDF files
  - Added content preview with truncated text display
  - Created consistent color-coding for different content types
  - Added hover states and subtle animations for interactive elements
  - Implemented content type icons using SVG data URIs

### Changed
- Refactored document processing logic
  - Replaced separate ContentInput and ContentList components with unified Mnemosyne component
  - Updated App.js to use the new Mnemosyne component
  - Modified document display with improved styling
  - Enhanced application theme integration with CSS variables
  - Improved document management workflow with unified interface

## [0.3.0] - ChatUI DOM Connection Fix

### Fixed
- Fixed DOM connection issue in ChatUI component
  - Fixed error "Main container is not connected to DOM!" when initializing ChatUI
  - Added DOM connection checks in initialize() method to handle cases where container isn't ready
  - Improved showBackendUnavailableMessage() to handle cases where container isn't connected
  - Added short delay in initialization sequence to ensure DOM is fully updated
  - Enhanced updateUI() method to robustly handle DOM connection issues

## [0.3.0] - Advanced Type Validation System

### Added
- Implemented Pydantic-like validation system with strong type safety
  - Created `frontend/src/services/tools/validation/SchemaValidator.js`: Robust schema validation utility
  - Added `frontend/src/services/tools/validation/Model.js`: Type-safe data models with validation
  - Implemented field definitions with strong typing and validation rules
  - Added automatic type conversion and validation for all data types
  - Created comprehensive validation error reporting
- Enhanced summary generation with type-safe models
  - Added `frontend/src/services/tools/summaryGenerator/models.js`: Type models for summary parameters and results
  - Implemented SummaryParams, SummaryResult, and SummaryError models
  - Added validation rules specific to summary generation
  - Enhanced error handling with custom validation
- Improved Gemini function calling with validation
  - Updated GeminiFunctionCaller to handle validation errors
  - Added FunctionCallResult for consistent error handling
  - Enhanced tool execution with parameter validation
  - Implemented more robust error reporting

### Changed
- Enhanced tool parameters with JSON Schema validation
  - Updated tool registry to use schema validation
  - Improved parameter validation for all tools
  - Enhanced error handling with detailed validation errors
- Improved type safety across the codebase
  - Implemented validation before processing
  - Added automatic type conversion where appropriate
  - Enhanced error handling with validation context

## [0.2.9] - Modular Tools System

### Added
- Created extensible tools system for document processing
  - Implemented `backend/src/services/tools.js`: Main service for managing and executing tools
  - Created `frontend/src/services/tools/` directory structure for modular tools
  - Added `frontend/src/services/tools/registry.js`: Tool registry for managing available tools
  - Created `frontend/src/services/tools/summaryGenerator/`: Document summary generation tool
  - Added `frontend/src/services/tools/toolRegistry.json`: JSON configuration for available tools
  - Created `frontend/src/services/tools/GeminiFunctionCaller.js`: Utility for Gemini function calling
- Implemented document summary generation tool
  - Added backend summary generation with text analysis
  - Created frontend fallback for summary generation
  - Implemented key points extraction from document text
  - Added client/server execution capabilities
- Enhanced ApiService with tools functionality
  - Added methods for tool discovery and execution
  - Implemented tool-specific API methods
  - Enhanced error handling for tools

### Changed
- Updated IPC handlers to support tools functionality
  - Added get-available-tools, execute-tool and generate-summary handlers
  - Improved error handling for tool execution
  - Enhanced backend initialization to include tools service

## [0.2.9] - Frontend Logger Fix

### Fixed
- Fixed critical "process is not defined" error in frontend logger
  - Updated `frontend/src/utils/logger.js` to properly detect browser environment
  - Completely rewrote logger implementation to use pure browser-compatible code
  - Removed all Node.js dependencies (electron-log, require, process) from browser code
  - Used CommonJS module exports pattern for compatibility with Electron
  - Enhanced environment detection to avoid process reference in browser context
  - Fixed error that was preventing ThinkingVisualization component from loading

## [0.2.8] - Chat Input Fix

### Fixed
- Fixed critical issue with chat input not properly sending messages
  - Added proper method binding in ChatInput.js to prevent context loss 
  - Improved Enter key handling with better input validation
  - Fixed binding issues between App.js and ChatUI.js components
  - Enhanced error handling in message submission process
  - Added direct button click handler for better mobile support
  - Created separated submitMessage method for cleaner code structure
  - Fixed input state management after message submission
  - Added proper validation of message content before submission

## [0.2.7] - Backend Communication Fix

### Fixed
- Fixed critical backend communication issues preventing chat from functioning
  - Added proper IPC handlers in `backend/server.js` to handle direct communication with frontend
  - Updated `frontend/src/preload.js` to prioritize IPC communication over HTTP fallback
  - Enhanced error handling for backend connection issues with better user feedback
  - Fixed "Electron net module is not available" error by implementing proper IPC channels
  - Added direct IPC handlers for health check, config, chat, and tool execution
  - Improved `frontend/src/main.js` to initialize backend server and set up IPC handlers
  - Added basic IPC handlers directly in the main process as a fallback
  - Created robust failover from IPC to HTTP when needed
  - Enhanced error reporting with specific error messages for connection issues

### Added
- Added better backend server integration with Electron
  - Implemented proper backend server initialization in the main process
  - Added IPC bridge between frontend and backend services
  - Created direct communication channel between renderer process and backend

### Changed
- Improved communication architecture between frontend and backend
  - Changed from HTTP-only to IPC-first with HTTP fallback approach
  - Enhanced error handling for backend connectivity issues
  - Improved logging for backend connection status

## [0.2.6] - Chat Implementation Optimization

### Fixed
- Fixed duplicate header creation in ChatUI component
- Resolved conflict between App component and ChatUI for header and footer management
- Fixed chat layout issues with proper container hierarchy
- Eliminated input container duplication issues
- Improved component cleanup to ensure proper removal of all elements
- Fixed focus issues in chat input when rendering component

### Added
- Added chat-container-wrapper component for better structure
- Created proper separation between shared app structure and chat-specific components
- Improved header integration with consistent styling

### Changed
- Moved header creation responsibilities to App component
- Updated ChatUI component to focus on chat functionality only
- Improved component lifecycles to prevent memory leaks
- Enhanced input field management with proper focus handling
- Added better component cleanup when navigating between sections

## [0.2.5] - Frontend CSS Optimization

### Fixed
- Resolved duplicate CSP (Content Security Policy) definitions in index.html
- Removed duplicate bundle.js script tag from index.html
- Fixed conflicting CSS animation definitions between main.css and component stylesheets
- Eliminated multiple implementations of the same UI components (header/footer)

### Added
- Created shared animations.css file for consistent animations across all components
- Improved CSS organization with proper import hierarchy
- Enhanced style maintainability through better component isolation

### Changed
- Optimized CSS import structure for better performance
- Consolidated animations into a shared file to reduce duplication
- Improved component styling organization for better maintainability

## [0.2.4] - Modern Dark Theme Redesign

### Added
- Implemented modern dark-themed UI throughout the application
- Added responsive header with navigation menu
- Enhanced footer with links and copyright information
- Added new UI animations and transitions
- Implemented improved loading states for search
- Added content actions (copy, export) to ContentViewer
- Improved error handling and empty state displays

### Changed
- Completely redesigned the color scheme with dark palette
- Enhanced typography with better contrast and readability
- Improved component layouts for better user experience
- Updated UI components with modern styling
- Enhanced button styles with hover and active states
- Added custom scrollbar styling for better integration
- Improved responsive design for mobile devices

### New Components/Features
- Added navigation system for app sections

### Fixed
- Fixed TypeError in getSourceColor methods by adding null checks for undefined sourceType values
  - Updated Dashboard.js, SearchSection.js, ContentList.js, and renderer.js to handle undefined source types
  - Prevented "Cannot read properties of undefined (reading 'toLowerCase')" error that was breaking dashboard initialization
- Fixed Content Security Policy issues with webpack bundling
  - Modified webpack.config.js to use 'inline-source-map' instead of eval-based sourcemaps
  - Added Content-Security-Policy meta tag in HtmlWebpackPlugin configuration
  - Disabled webSecurity in Electron for development environments

## [0.2.3] - Memory Management and Database Fixes

### Fixed
- Fixed memory manager batch size calculation to properly adjust for item size
  - Updated `backend/src/memory/memoryManager.js` to ensure smaller items get larger batch sizes and larger items get smaller batch sizes
  - Added logic to prevent large items from using maximum batch size, ensuring proper differentiation in batch sizing
- Fixed search service database initialization issues in tests
  - Updated `backend/test/search.test.js` to properly mock database collection
  - Enhanced `backend/src/services/database.js` vectorSearch function to handle test environments better
  - Added global.testCollection support for improved test reliability
  - Fixed error message expectations in tests to match actual error messages
- Fixed test framework incompatibilities
  - Updated `backend/test/search.test.js` to use Jest's `beforeAll`/`afterAll` instead of Mocha's `before`/`after`
  - Fixed Electron IPC mocking in `backend/test/ipc.test.js` by using proper getter methods for ipcMain
  - Enhanced test stability for cross-framework compatibility
- Fixed IPC handler initialization in main process
  - Updated `frontend/src/main.js` to correctly call `initializeIpcHandlers` instead of non-existent `setupIpcHandlers` function
  - Added database initialization to the main Electron process to ensure database is ready before IPC handlers are initialized
  - Modified `backend/src/services/database.js` to use raw database connection when memory-managed connection is missing methods
  - Resolved "Error: Database not initialized" error in listItems handler
  - Fixed "Error: No handler registered for 'list-items'" error that was preventing database items from being listed
- Enhanced memory manager to preserve all database connection methods
  - Updated `backend/src/memory/dbMemoryManager.js` to wrap all methods from original connection objects
  - Added intelligent handling for both async and sync database methods
  - Expanded monitoring to include database-specific operations like `createTable` and `openTable`
  - Improved method detection for proper async/sync handling
  - Fixed "monitoredDb.createTable is not a function" error during database initialization

## [0.2.2] - Enhanced Memory Management System

### Added
- Created comprehensive, modular memory management system
  - Implemented `backend/src/memory/memoryManager.js`: Core class-based memory monitoring and optimization utility
  - Created `backend/src/memory/heapAnalyzer.js`: Advanced heap analysis and memory issue detection
  - Added `backend/src/memory/batchOptimizer.js`: Memory-optimized batch processing utility
  - Created `backend/src/memory/index.js`: Unified module for accessing all memory management components
  - Added `backend/src/memory/README.md`: Documentation for the memory management system

### Enhanced
- Improved memory monitoring capabilities
  - Added memory trend analysis to detect potential memory leaks
  - Implemented memory issue detection with comprehensive alerts and recommendations
  - Added detailed memory statistics with heap usage analysis
  - Created memory snapshot tracking for analyzing usage patterns over time
- Extended batch processing with advanced memory optimization
  - Added automatic process function optimization with memory monitoring
  - Implemented operation-specific memory tracking for targeted optimization
  - Enhanced adaptive batch sizing with dynamic adjustment based on memory conditions
  - Added batch statistics and recommendations for performance tuning
  - Improved automatic garbage collection triggering under memory pressure

### Changed
- Refactored existing memory utilities for better organization and extensibility
  - Updated `backend/src/utils/batchers/batchProcessor.js` to use the new memory management system
  - Enhanced `backend/src/utils/processors/documentProcessor.js` with advanced memory management features
  - Restructured memory-related code into a dedicated module for reusability
  - Added backward compatibility layer for existing code
- Improved test suite with comprehensive memory management testing
  - Added `backend/test/memory/memoryManager.test.js` for testing memory management components
  - Updated `backend/test/utils/batchProcessing.test.js` to test with the new memory system

### Fixed
- Improved memory handling for large document processing
- Enhanced memory optimization for batch operations with varying data sizes
- Added more sophisticated memory monitoring to detect and address potential issues
- Implemented better garbage collection optimization to reduce memory pressure

## [0.2.1] - Memory Management Improvements

### Added
- Implemented advanced memory management system
  - Created `backend/src/utils/memoryManager.js`: Utility for memory monitoring and dynamic batch sizing
  - Added adaptive batch size calculation based on document/text size
  - Implemented memory usage tracking and reporting
  - Added garbage collection triggering for improved resource management
  - Enhanced memory utilization by automatically scaling batch sizes for large documents
  
### Changed
- Enhanced BatchProcessor with dynamic batch sizing capabilities
  - Updated `backend/src/utils/batchers/batchProcessor.js` with memory-aware processing
  - Added memory monitoring during batch processing
  - Implemented automatic garbage collection between batch sets
  - Improved batch sizing adaption for varying document sizes
- Enhanced document processing pipeline with memory optimization
  - Updated document processor to auto-detect large document sets and enable memory optimization
  - Added memory state tracking and reporting throughout the processing pipeline
  - Updated batch options to support memory-aware parameters
- Improved test suite with memory management testing

### Fixed
- Fixed memory issues in PDF processing by implementing dynamic batch sizing
- Prevented memory leaks in batch processing by cleaning up resources between batches
- Improved processing of large document sets by automatically adjusting batch sizes
- Enhanced memory monitoring to identify and address high memory usage patterns

## [0.2.0] - Stage 2 Initial Implementation

### Added
- Implemented semantic search functionality
  - Created `backend/src/services/search.js`: Service for performing vector-based semantic searches
  - Added search query embedding generation
  - Implemented vector similarity search against stored text chunks
  - Added result formatting with relevant metadata and text snippets
- Created centralized IPC communication system
  - Added `backend/src/ipcHandlers.js`: Module to centralize all IPC channel definitions
  - Implemented search IPC channel for query input and result retrieval
  - Refactored existing IPC handlers for better organization
- Enhanced UI with search functionality
  - Added search interface with query input and results display
  - Implemented content viewing area for displaying search results
  - Added interactive search results with click-to-view functionality
  - Improved CSS styling with grid layout for better component organization
- Added comprehensive testing
  - Created `backend/test/search.test.js`: Tests for semantic search functionality
  - Added `backend/test/ipc.test.js`: Tests for IPC communication
  - Implemented tests for error handling and edge cases

### Changed
- Refactored frontend/src/main.js to use centralized IPC handlers
- Updated frontend UI layout to accommodate search and content viewing components
- Enhanced CSS with grid layout and improved component styling
- Improved error handling in IPC communication

### Fixed
- Increased Node.js memory limit for tests to prevent "JavaScript heap out of memory" errors
- Fixed database test mocks to match actual implementation, removing non-existent `query()` method reference that was causing memory leaks
- Ensured test mocks properly reflect the vectordb v0.4.3 API limitations
- Optimized Jest configuration to use less memory during testing with `--runInBand` and reduced workers
- Implemented proper mock cleanup to prevent memory accumulation during tests
- Simplified test mocks to avoid circular references which were causing excessive memory usage
- Added Babel transformation for Chai to handle ESM export syntax issues
- Configured Jest to skip problematic database.test.js until further optimizations can be made

## [0.1.4]

### Added
- Created `backend/src/utils/tempFileManager.js`: Modular utility for managing temporary files
  - Provides consistent temp file path handling
  - Includes safe file deletion with error handling
  - Features TempFileHandler class for complex file patterns
  - Supports fallback locations for files created outside temp directory
  - Handles cleanup of temporary files automatically
- Implemented batch processing system for efficient document processing and embedding
  - Created `backend/src/utils/batchers/batchProcessor.js`: Generic batch processing utility with concurrency control
  - Created `backend/src/utils/batchers/chunkerBatch.js`: Batch processing for text chunking operations
  - Created `backend/src/utils/batchers/embeddingBatch.js`: Batch processing for embedding generation
  - Created `backend/src/utils/documentProcessor.js`: End-to-end document processing pipeline
  - Added comprehensive test suite for batch processing utilities
  - Enhanced embedding service with parallel processing capabilities
  - Added cosine similarity calculation functionality
- Implemented unified document processing system
  - Created `backend/src/utils/processors/processorFactory.js`: Produces configurable processor instances with consistent interfaces
  - Integrated batch processing into PDF processor for multi-document handling
  - Added PDFProcessor class for specialized PDF document handling
  - Restructured processing pipeline with improved separation of concerns 
  - Enhanced PDF extraction with multi-file batch processing
  - Added robust error handling for batch document operations

### Fixed
- Fixed logger configuration in frontend/src/utils/logger.js to use an array for levels instead of an object, resolving "this.levels.includes is not a function" error.
- Fixed console transport format in frontend logger to handle undefined date property, resolving "Cannot read properties of undefined (reading 'toISOString')" error.
- Replaced custom format function with electron-log's standard format string to resolve "data.reduce is not a function" error in style transformation.
- Updated deprecated `archiveLog` to `archiveLogFn` in file transport configuration to resolve deprecation warning.
- Fixed preload script issues by removing dependency on path module and simplifying logger initialization in sandboxed context.
- Modified logger.js to improve compatibility with Electron's preload script sandboxing restrictions.
- Implemented inline logger in preload.js to avoid CommonJS module dependencies, addressing sandbox restrictions in Electron 20+.
- Fixed "items.forEach is not a function" error in displayItems by properly handling the response object structure from IPC calls.
- Fixed YouTube transcription handling to properly locate caption files in the temp directory
- Resolved issue with YouTube caption processing creating files in the wrong location
- Fixed incorrect logger import paths in batchers and processors modules to properly reference logger.js from the utils directory
- Fixed test issues:
  - Addressed PDF processor test mocking by using proper Sinon stubs instead of Jest mocks
  - Fixed IPC handlers test by properly mocking the electron module and service dependencies
  - Improved mocking for test compatibility between Jest and Sinon
  - Fixed test dependency install issues by using legacy-peer-deps flag for compatibility

## [0.1.3]

### Enhanced
- Improved backend logger with millisecond timestamp precision for detailed debugging
- Enhanced context handling by passing it as metadata for better log filtering
- Added circular reference detection to prevent logger crashes
- Enhanced HTTP logger with intelligent log level selection based on response status and time
- Added user-agent summary tracking to HTTP logger for better request identification
- Improved sensitive data redaction to handle nested objects
- Added generic log method for interface compatibility
- Exported log levels for reference in other parts of the application

## [0.1.2]

### Changed
- Integrated proper contextual logging across all backend services
- Standardized error handling with detailed error logging
- Enhanced debug information for text processing and embeddings
- Implemented trace-level logging for fine-grained debugging
- Improved metadata in log entries for better debugging and monitoring
- Updated config bootstrapping with temporary logger

## [0.1.1]

### Added
- Unified logging system with Winston (backend) and electron-log (frontend)
- Context-based logging with different severity levels
- Log rotation with daily file cycling
- Colorized console output
- HTTP request logging middleware

### New Files
- `backend/src/utils/logger.js`: Winston-based logger implementation
- `backend/src/utils/httpLogger.js`: Morgan HTTP logging middleware
- `frontend/src/utils/logger.js`: Electron-log implementation 
- Tests for both frontend and backend loggers

### Changed
- Updated backend and frontend entry points to use structured logging
- Added preload API for renderer process logging
- Extended config with logging settings
- Refactored services to use contextual loggers

## New Features

### Special Word Renderer Component
- Added `SpecialWordRenderer.js` component that detects and applies special styling to the words "Mnemosyne" and "Cognivore" in chat messages
- Created `special-words.css` for styling special words with gradient text, subtle animations, and hover effects
- Integrated with ChatMessages and ChatUI components
- Words are rendered at the same size as surrounding text but with special visual treatment to dramatize their importance
- Added informative tooltips that appear on hover
- Created demo page at `special-words-demo.html` for testing and demonstration

## [Unreleased]

### Added
- **Anthology Feature**: 
  - Added "Anthology" navigation item to the sidebar (`frontend/src/components/Sidebar.js`).
  - Created new `Anthology.js` component (`frontend/src/components/Anthology.js`) to display story chapters.
  - Added corresponding CSS for the Anthology component (`frontend/public/styles/components/anthology.css`).
  - Integrated `Anthology` component into `App.js` (`frontend/src/components/App.js`) for navigation and rendering.
  - Mocked chapter data loading in `Anthology.js` for frontend display of files from `backend/@story/`.

### Changed

### Fixed

## Build System Improvements

- Fixed Electron build process to properly handle main.js entry point
- Added a temporary workaround for electron-builder asar issues
- Created documentation for electron-builder setup and troubleshooting
- Added direct main.js entry point in root directory to fix entry point issues

## App Name and Branding

- Fixed issues with application display name on macOS
- Consolidated electron-builder configuration to ensure "Cognivore" appears in all UI elements
- Added proper Info.plist template for macOS builds
- Enhanced app metadata and about panel information

## macOS Menu Bar Branding Fix

- Fixed macOS menu bar still showing "Electron" instead of "Cognivore"
- Added dedicated script to patch Electron.app Info.plist for development mode
- Enhanced app menu construction to correctly show Cognivore in menu items
- Added proper CFBundleName and CFBundleDisplayName in Info.plist templates

## Enhanced macOS Menu Bar Branding Fix

- Added multiple approaches to ensure proper app name in macOS menu bar:
  - Environmental variable approach (ELECTRON_APP_NAME) in npm scripts
  - Early application name setter module that runs before Electron loads
  - Root main.js entry point environment variable setting
  - Enhanced menu customization with direct manipulation

## macOS Dock Name Fix

- Fixed the application name in the macOS dock by:
  - Creating a dedicated fix-dock-name.js script that modifies the Electron.app bundle
  - Using the app.dock API to set the dock menu with correct name
  - Adding mac-specific npm scripts that run the dock fix before launch
  - Directly renaming the Electron binary to Cognivore and updating CFBundleExecutable
  - Configuring empty-first-item menu template to replace "Electron" in menu bar

## macOS Dock and Menu Enhancement

- Improved macOS app branding with enhanced fixes:
  - Added bold formatting to Cognivore menu item for better visibility
  - Created dedicated fix-dock-icon script with multiple approaches for stubborn dock naming issues
  - Added PlistBuddy direct editing for more reliable property setting
  - Enhanced binary renaming approach with symbolic links for compatibility
  - Added app bundle touching to force macOS to refresh bundle cache
  - Implemented explicit app.dock.setName call in app.whenReady handler
  - Added automated scripts to fix both dock icon and menu names before launch

## Checked sidebar image usage; `logo-transparent.png` is correctly implemented in `Sidebar.js`.

## [0.3.32] - Sidebar Logo Fix

### Fixed
- Corrected sidebar logo to use `logo-png.png` to resolve broken image issue.

## [0.3.33] - Sidebar Logo Reverted to Transparent

### Fixed
- Reverted sidebar logo to use `logo-transparent.png` as per user preference.

## [0.3.34] - Anthology Component UI Enhancement

### Changed
- Enhanced Anthology component with interactive storytelling features
  - Redesigned character display with interactive cards and custom icons
  - Added expandable concept boxes with click-to-reveal details
  - Implemented visual timeline for plot points with numbered markers
  - Added subtle animations including title gradient effects
  - Improved visual hierarchy with better typography and spacing
  - Enhanced navigation with hover effects and improved transitions
  - Added card-flip interactions for character descriptions
  - Removed themes section for cleaner focused presentation
  - Improved overall readability with better contrast and spacing

## [0.3.35] - Anthology Component Layout Refinements

### Changed
- Refined Anthology component layout for better visual balance
  - Reduced padding between elements for more compact presentation
  - Improved character cards with centered layout and bottom-aligned content
  - Centered all section titles and headers for better visual flow
  - Added fixed width to character cards for consistent sizing
  - Improved concept boxes with centered layout and better spacing
  - Enhanced readability with optimized margins and padding
  - Adjusted plot point timeline for better visual hierarchy
  - Improved section underlines with centered positioning

## [0.3.36] - Anthology Character Card Design Enhancement

### Changed
- Enhanced character card design in Anthology component for better visual consistency
  - Fixed layout issues with cards to ensure consistent heights and spacing
  - Added subtle design improvements including soft radial gradients on hover
  - Improved card proportions with adjusted width and height parameters
  - Enhanced visual hierarchy with better icon-to-text ratio
  - Added subtle border details and enhanced shadow effects
  - Improved text positioning within cards for better readability
  - Fixed alignment issues with character role descriptions
  - Added better visual cues for interactive elements
  - Enhanced hover states with more pronounced visual feedback

### [Current]
- Added special word rendering for "Griffin" with red text styling
- Updated system prompt with guidelines for emphasizing special characters
- Enhanced special words styling in CSS with Griffin-specific visual elements
- Added special styling for expletives with gold/orange gradient and animation effects
- Updated system prompt to guide AI in using profanity as divine emphasis
- Enhanced SpecialWordRenderer to detect and emphasize common expletives
- Added support for markdown-style text emphasis with double asterisks (**text**)
- Implemented purple gradient styling for emphasized text with subtle animations
- Updated system prompt with guidelines for using emphasis for key concepts