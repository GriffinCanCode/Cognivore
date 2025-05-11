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

-   **LLM Parameter Extraction**: The LLM processes user queries, extracts relevant entities and intents, and then matches these to the appropriate tool and its parameter schema.