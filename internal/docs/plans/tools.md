# Jiritsu Oracle Agent Tool System Overview

This document outlines the architecture and workflow of the tool system used by the Jiritsu Oracle agent.

## 1. LLM Tool Usage (Gemini 1.5 Flash & `backend/services/tools.js`)

The core of the LLM's ability to use tools resides in `backend/services/tools.js`, which defines the `ToolsService` class. This service acts as a registry and execution environment for all callable functions available to the Gemini 1.5 Flash model.

-   **Tool Definition**: Each tool is an object within the `ToolsService.availableTools` map. A tool definition includes:
    -   `description`: A natural language description for the LLM to understand the tool's purpose and when to use it.
    -   `parameters`: A JSON schema defining the expected input parameters, their types, and whether they are required. This allows the LLM to correctly format its requests.
    -   `handler`: A reference to the JavaScript async function (bound to the `ToolsService` instance) that implements the tool's logic.

-   **Exposing Tools to Gemini**:
    -   The `ToolsService.getAllToolsForGemini()` method transforms the `availableTools` into an array formatted according to Gemini's function calling API requirements (typically including `name`, `description`, and `parameters` for each tool). This list is provided to the LLM during its setup or per-request.

-   **Tool Execution Trigger**:
    -   When Gemini determines a tool needs to be called, it responds with a function call request, specifying the `toolName` and the `params` (arguments).
    -   The backend application, either through `backend/services/llm.js` or directly within an API route handler (e.g., in `backend/routes/llm.js`), receives this and invokes `ToolsService.executeTool(toolName, params)`.

-   **`ToolsService.executeTool()` Logic**:
    -   This method is the central point for tool execution.
    -   It looks up the tool by `toolName` in `availableTools`.
    -   It performs pre-execution setup if necessary, such as ensuring services like `blockchain`, `ipfsService`, or `oracleService` are initialized for relevant tools (e.g., `createOracle`, `getOracleData`).
    -   It invokes the tool's registered `handler` function with the `params` provided by the LLM.
    -   It includes try-catch blocks for robust error handling, returning a standardized error object to the LLM if an issue occurs.
    -   Special logging is implemented for system and archive-related tools.
    -   The method can also handle multiple tool requests sequentially via `executeMultipleTools(toolRequests)`.

-   **Service Delegation**: Many tools in `ToolsService` act as an abstraction layer, delegating their core logic to more specialized services:
    -   `oracleService`: Handles oracle data retrieval, listing, and creation.
    -   `ipfsService`: Used for IPFS interactions, often in conjunction with `oracleService`.
    -   `blockchain`: Manages blockchain interactions, also often used by `oracleService`.
    -   `webSearchService`: Powers the `webBrowse` tool.
    -   `systemToolsService`: Manages a suite of system-level functions including chat history (`clearChat`, `getChatHistory`), preferences (`updateSystemPreferences`), data export (`exportChatData`), application state (`resetApplication`, `getSystemStatus`), and chat archiving/compression (`storeCompressedHistory`, `listCompressedHistories`, `getCompressedHistory`, `deleteCompressedHistory`, `restoreArchivedChat`).
    -   `apiFinderService`: Implements the logic for the `findApis` tool.
    -   `selectorFinderService`: Implements the logic for the `findSelectors` tool.
    -   `oracleArchitectService`: Orchestrates the multi-step guided process for the `oracleArchitect` tool.

-   **LLM Parameter Extraction**: The LLM processes user queries, extracts relevant entities and intents, and then matches these to the appropriate tool and its parameter schema.

## 2. Agent Execution Workflow

The Jiritsu Oracle agent facilitates complex operations through a coordinated workflow involving the user, the LLM, backend services, and frontend components.

### 2.1. General Flow

1.  **User Input**: The user interacts with the system via the `ChatWindow` component in the frontend.
2.  **Query Processing**: The input is sent to the backend (e.g., to an API endpoint handled by `llmService.js`).
3.  **LLM Invocation**: The backend service forwards the user query and conversation history to the Gemini 1.5 Flash model, along with the list of available tools.
4.  **Tool Decision & Call**:
    -   Gemini analyzes the query. If it decides a tool is necessary, it returns a structured function call request (tool name and arguments).
    -   If no tool is needed, Gemini returns a natural language response.
5.  **Backend Tool Execution**: If a tool call is requested, the backend's `ToolsService` executes the specified tool(s).
6.  **Result Aggregation**: The `ToolsService` returns the execution result (data or error) to the LLM.
7.  **LLM Response Generation**: Gemini processes the tool's result and generates a final natural language response for the user, or potentially decides to call another tool.
8.  **Response to Frontend**: The backend sends Gemini's final response (which may include data from tool executions) back to the `ChatWindow`.
9.  **UI Update**: The `ChatWindow` updates the message list, and if the response includes tool data, it's passed to the `ToolCanvas` for rendering.

### 2.2. Backend-Frontend Integration

-   **API Endpoints**: The primary communication channel. Frontend components like `ChatWindow.js` (via `llmService.js`) and `frontend/src/utils/tools.js` make calls to backend API endpoints (e.g., `/api/llm/execute-tool`, `/api/llm/process-query`).
-   **`llmService.js` (Frontend)**: Contains functions (`processBlockchainQuery`, `processOracleManagement`, `executeTool`, `continueOracleArchitectWorkflow`, etc.) that abstract the API calls to the backend for LLM interactions and tool executions.
-   **`tools.js` (Frontend)**: Defines client-side system tools (like `archiveChat`, `findApis`) that often wrap calls to their backend counterparts via `axios.post` to the `/api/llm/execute-tool` endpoint. It also handles backend availability checks (`checkBackendAvailability`).
-   **Data Flow**: Tool results from the backend are received by the frontend, typically processed in `ChatWindow.js`, and then used to update the `messages` state. Tool-specific data is often extracted and passed to `ToolCanvas.js`.
-   **State Management**: The `useToolCanvas` hook in `ChatWindow.js` is crucial for managing the collection of `allToolCalls` derived from messages and controlling the visibility and state of the `ToolCanvas`.

### 2.3. MetaMask Interactions

MetaMask is primarily used for on-chain operations related to oracle management, such as creating new oracles or funding them.

1.  **Initiation**:
    -   The `oracleArchitectService` (for the guided `oracleArchitect` tool) or the `createOracle` tool in `backend/services/tools.js` prepares the necessary transaction details (e.g., oracle definition, deposit amount).
    -   This information is sent to the frontend as part of a tool call result.
2.  **Frontend Trigger**:
    -   The `ToolCanvas.js` component, often through a specialized display component like `OracleArchitectDisplay` or `OracleCreatedDisplay`, receives this data.
    -   Specific UI elements (e.g., a "Create Oracle with MetaMask" button) prompt the user to initiate the transaction.
    -   The `ORACLE_DEFINITION` result type in `ToolCanvas.js` is a key trigger point, directly calling `createNewOracle`.
    -   Stage 5 of the `OracleArchitectDisplay` also triggers MetaMask interactions via `createNewOracle`.
3.  **Wallet Utilities**:
    -   `frontend/src/utils/contractUtils.js` provides functions like `createNewOracle`, `testMetaMaskConnection`, and `testMetaMaskTransaction` that use the `window.ethereum` provider (MetaMask) to interact with the blockchain.
    -   `frontend/src/utils/walletUtils.js` contains `ensureWalletConnection` to ensure the user's wallet is connected before attempting transactions.
4.  **Transaction Confirmation**: The user confirms the transaction in their MetaMask wallet.
5.  **Result Handling**: The frontend receives the transaction hash and potentially updates the UI or informs the backend.

### 2.4. Web Interactions

The system interacts with the web for data sourcing and analysis:

-   **`webBrowse` Tool**:
    -   Delegates to `webSearchService` on the backend.
    -   Fetches content (text, HTML, or full page) from a given URL.
    -   Can use an optional CSS selector to target specific content.
-   **`findApis` Tool**:
    -   Delegates to `apiFinderService` on the backend.
    -   Crawls a website or documentation page to identify API endpoints (REST, GraphQL, WebSocket).
    -   Can scan JavaScript files and include example requests/responses.
-   **`findSelectors` Tool**:
    -   Delegates to `selectorFinderService` on the backend.
    -   Analyzes a webpage to find useful CSS or JSONPath selectors for extracting specific data types (price, text, table, etc.).
-   **Data Flow**: The extracted web data (content, API details, selectors) is returned from the backend, typically as part of a tool call result, and can be displayed in the `ToolCanvas` (e.g., by `WebContentDisplay`, `ApiFinderDisplay`).

### 2.5. `oracleArchitect` Workflow

This tool provides a guided, multi-step process for creating oracles:

1.  **Initial Call**: The LLM initiates the workflow by calling the `oracleArchitect` tool with initial parameters like `source` (website/provider), `asset` (data point), and desired `frequency`.
2.  **Backend Orchestration**: `oracleArchitectService.process()` on the backend manages the workflow state.
3.  **Frontend Interaction**:
    -   The backend service returns data to the frontend, often requiring user confirmation or input for each step.
    -   These steps are typically rendered by `OracleArchitectDisplay` within `ToolCanvas.js`.
    -   `AGREEMENT_REQUEST` is a common result type used for user confirmation steps.
4.  **State Tracking**:
    -   `workflowId` and `stage` parameters are used to track the progress of the workflow across requests.
    -   `ChatWindow.js` maintains `currentWorkflowState` to store the context of the ongoing Oracle Architect process.
5.  **Continuation**:
    -   User confirmations or inputs from the frontend are sent back to the backend.
    -   `ChatWindow.js`'s `handleAgreementConfirm` function calls `llmService.continueOracleArchitectWorkflow()` or `llmService.finalizeOracleArchitectWorkflow()` to proceed to the next stage or complete the process.
6.  **Finalization**: The workflow culminates in the oracle definition being prepared, often leading to a MetaMask interaction for on-chain creation.

### 2.6. Chat Archiving

The system allows users to archive, list, load, and delete chat conversations:

1.  **Tool Definitions**: Tools like `archiveChat`, `listArchivedChats`, `loadArchivedChat`, and `deleteArchivedChat` are defined in `backend/services/tools.js` and delegate their logic to `systemToolsService`.
2.  **Frontend Triggers**:
    -   Client-side versions of these tools are defined in `frontend/src/utils/tools.js`. These make `axios` POST requests to the backend's `/api/llm/execute-tool` endpoint.
    -   Buttons or commands in `ChatWindow.js` can trigger these actions (e.g., "Archive Chat" button, "View Archived Chats" button).
3.  **Backend Processing**: `systemToolsService` handles the archiving logic. For direct message archiving, it stores chat messages along with metadata using `storageService.setCacheValue()`. For summarized history, it first performs a selective compression (keeping essential information and sampling messages based on a compression level) via its `compressChatHistory` method, and then stores the compressed data also using `storageService.setCacheValue()`. The `storageService` appears to be cache-based, as indicated by comments about more persistent storage for production environments.
4.  **Frontend Handling (`ChatWindow.js`)**:
    -   The `handleSystemToolAction` function processes the results from these backend tool calls.
    -   It interacts with `storage.indexedDB` for local caching/storage of archives (e.g., `storage.indexedDB.storeCompressedHistory`, `storage.indexedDB.getAllCompressedHistories`).
    -   The UI is updated via `setSystemToolResult`, which often involves rendering data using `SystemToolsDisplay`. For instance, `listArchivedChats` results are displayed showing a list of available archives.

## 3. Display and UI (`ToolCanvas.js`, `ChatWindow.js`, Card Containers)

The user interface provides a rich experience for interacting with the agent and viewing tool outputs.

### 3.1. `ChatWindow.js` - Main Interaction Hub

-   **Primary Interface**: The central component where users type queries and see conversation history.
-   **Message State**: Manages the `messages` array, where each message object can contain user text, AI responses, and `toolCalls` data.
-   **`useToolCanvas` Hook**: This custom hook is used to:
    -   Aggregate `allToolCalls` from the `messages` state.
    -   Manage the visibility and expanded state of the `ToolCanvas` (`isCanvasExpanded`, `hasToolCalls`).
    -   Provide functions to toggle and clear tool calls.
-   **Conditional Rendering**:
    -   The `ToolCanvas` component is rendered conditionally based on `hasToolCalls`.
    -   The overall layout of `ChatWindow.js` adjusts dynamically (e.g., class names like `chat-layout-split`, `tool-visible`, `with-tools`) when the tool panel is active.
-   **System Tool UI**: Uses the `SystemToolsDisplay` component to render results from system tools (e.g., list of archived chats, system status).
-   **Oracle Assistant Bar**: A collapsible bar providing quick actions like viewing archives, history, or clearing chat.
-   **Input Enhancements**:
    -   `ToolSuggestionDisplay`: Shows relevant tool commands or query suggestions as the user types.
    -   Handles slash commands (e.g., `/help`, `/clear`) and at-commands (e.g., `@createOracleProposal`).

### 3.2. `ToolCanvas.js` - Rendering Tool Outputs

-   **Central Display Area**: This component is responsible for rendering the visual output of all tool executions.
-   **Props**: Receives `toolCalls` (an array of tool execution details) or a single `toolCall` from `ChatWindow.js`.
-   **Dynamic Component Rendering**:
    -   The `renderToolCallResult` function is key. It iterates through the `toolCalls` and uses a `switch` statement or conditional logic based on `toolCall.result.type` to select and render the appropriate display component for each tool's output.
    -   Examples of specialized display components:
        -   `OracleDataDisplay` (for `ORACLE_DATA`)
        -   `OracleListDisplay` (for `ORACLE_LIST`)
        -   `ChartDisplay` (for `CHART`)
        -   `FormDisplay` (for `FORM`, `createOracleProposal`)
        -   `ToolListDisplay` (for `TOOL_LIST`)
        -   `OracleCreatedDisplay` (for `ORACLE_CREATED`)
        -   `OracleCreationStepsDisplay` (for `STEPS_UI`)
        -   `WebContentDisplay` (for `WEB_CONTENT`)
        -   `ApiFinderDisplay` (for `API_FINDER_RESULT`)
        -   `AgreementDisplay` (for `AGREEMENT_REQUEST`)
        -   `OracleArchitectDisplay` (for `oracleArchitect` tool calls and related workflow steps like `ORACLE_DEFINITION`).
        -   `MultipleToolsDisplay` (for `MULTIPLE_TOOLS`).
-   **Tool State Management**: Manages the expanded/collapsed state of individual tool cards within the canvas using the `expandedTools` state and `expandedToolsRef`.
-   **Layout Modes**: Supports different viewing modes:
    -   `side-by-side`: Tool canvas appears next to the chat.
    -   `docked`: (Default) Appears integrated below or within the chat flow.
    -   `floating`: Can be dragged around the screen.
-   **Scrolling**: Manages scrolling within the list of tool cards (`toolCardsContainerRef`) and provides a "scroll to bottom" button.
-   **Error Handling**: Uses a `SafeWrapper` component to gracefully handle potential rendering errors if tool data is malformed, preventing crashes. If a tool type is unrecognized or data is missing, it displays an error card.

### 3.3. Card Containers (`ToolCardContainer.js`)

-   **Standardized UI**: This component, located at `frontend/src/components/tools/ToolCardContainer.js`, wraps each individual tool's output within `ToolCanvas.js`.
-   **Features**:
    -   **Header**: Displays the tool's formatted name (using `formatToolName` from `ToolCanvas.js`) and an icon (using `getToolIcon`).
    -   **Expand/Collapse**: Allows users to toggle the visibility of the tool card's content.
    -   **Content Area**: Hosts the actual output rendered by the specific tool display component (e.g., `OracleDataDisplay`, `ChartDisplay`).
    -   Provides a consistent visual style for all tool results.

### 3.4. Styling and Dynamic Layout

-   **CSS Files**: Styling for the tool canvas and its sub-components is primarily managed by `frontend/src/styles/toolCanvas.css`. Other relevant files include `frontend/src/styles/formattedMessage.css` and `frontend/src/styles/toolSuggestionDisplay.css`.
-   **Dynamic CSS Injection**: `ChatWindow.js` programmatically injects CSS style blocks (`tool-rendering-styles`, `tool-panel-sizing-fix`, `tool-scrollbar-hide`) into the document head. This is done to:
    -   Force full-width rendering and proper box-sizing for tool content within the constrained tool panel.
    -   Address layout complexities and ensure correct positioning and sizing when the tool panel is visible and interacts with other UI elements like the "Oracle Assistant bar".
    -   Manage scrollbar visibility.
-   **Responsive Layout**: The layout of `ChatWindow.js` adapts based on whether tool calls are present and whether the tool canvas is expanded. Class names are dynamically applied to switch between a single-pane chat view and a split view with the tool panel.
-   **Animations**: `framer-motion` is used for animations in `ChatWindow.js` and `ToolCanvas.js` to enhance user experience (e.g., for message appearance, panel transitions, button visibility). 