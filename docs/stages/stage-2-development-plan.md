# Stage 2: Core Interaction - Search & Basic User Interface

**Overall Goal:** Build upon the Stage 1 foundation by implementing semantic search functionality and developing the initial cross-platform desktop application UI using Electron. This stage focuses on enabling users to retrieve and interact with their stored knowledge.

**Key Sections from `plan.md`:** 4.C (Search & Retrieval), parts of 4.E (User Interface & Experience)

---

## I. Electron Application Shell Setup

1.  **Electron Project Initialization:**
    *   Rule: Set up a new Electron project.
    *   Rule: Configure `package.json` with necessary scripts for development and building.
    *   Rule: Create the basic main process (`main.js`) and renderer process (`renderer.js` or equivalent) structure.
2.  **Frontend Framework (Optional but Recommended):**
    *   Rule: If using a UI framework (React, Vue, Svelte), integrate it into the Electron renderer process.
    *   Rule: Set up basic components structure.
3.  **Inter-Process Communication (IPC):**
    *   Rule: Establish basic IPC mechanisms (e.g., `ipcMain`, `ipcRenderer`) for communication between the main and renderer processes. This will be crucial for UI actions to trigger backend logic developed in Stage 1.

---

## II. Semantic Search Implementation (Backend & IPC)

1.  **Search Query Input:**
    *   Rule: Define an IPC channel for the renderer process to send a natural language search query to the main process.
2.  **Query Embedding:**
    *   Rule: In the main process, when a query is received, generate a vector embedding for the search query using the same sentence transformer model from Stage 1.
3.  **Vector Database Search:**
    *   Rule: Implement logic to perform a similarity search (e.g., k-nearest neighbors) in the vector database using the query embedding against the stored `embeddings` of `text_chunks`.
    *   Rule: The search should return the top N most relevant `text_chunks` along with their parent item IDs and metadata.
4.  **Result Formatting:**
    *   Rule: Format the search results into a structured list, including:
        *   The relevant text chunk (snippet).
        *   Reference to the parent item (e.g., item ID, title, source_identifier).
        *   Similarity score (if available from the DB).
5.  **Return Results to Renderer:**
    *   Rule: Define an IPC channel for the main process to send the formatted search results back to the renderer process for display.

---

## III. User Interface Development (Electron Renderer Process)

**A. Main Application Layout:**

1.  **Window Structure:**
    *   Rule: Design a basic application window layout (e.g., sidebar for navigation/actions, main content area).
2.  **Core UI Components (Initial Stubs):**
    *   Rule: Create placeholder components for:
        *   Content Ingestion Panel/Modal
        *   Main Library View
        *   Search Bar
        *   Results Display Area
        *   Content Viewing Area

**B. Content Ingestion UI:**

1.  **"Add Content" Panel/Modal:**
    *   Rule: Design a UI form with fields/buttons for:
        *   Adding a PDF file (file picker).
        *   Adding a web URL (text input).
        *   Adding a YouTube URL (text input).
    *   Rule: Implement logic to trigger IPC calls to the main process, invoking the respective Stage 1 ingestion backend functions.
    *   Rule: Provide user feedback (e.g., loading indicators, success/error messages) during and after ingestion.

**C. Knowledge Library View:**

1.  **List View:**
    *   Rule: Implement a UI component to display a list of all stored knowledge items.
    *   Rule: Each item in the list should display key metadata (e.g., title, source type, date added).
    *   Rule: Fetch this list from the main process (which queries the DB) via IPC.
2.  **Item Selection:**
    *   Rule: Allow users to select an item from the list to view its details.

**D. Content Viewing Area:**

1.  **Display Full Text:**
    *   Rule: When an item is selected in the library view or from search results, display its full `extracted_text` in this area.
    *   Rule: Fetch the full text content from the main process (which queries the DB by item ID) via IPC.
2.  **Metadata Display:**
    *   Rule: Also display relevant metadata (source, title, etc.) for the selected item.

**E. Search Interface & Results:**

1.  **Search Bar:**
    *   Rule: Implement a prominent search bar UI element.
    *   Rule: On submitting a query (e.g., pressing Enter), send the query text to the main process via IPC for semantic search (as defined in II.1).
2.  **Results Display:**
    *   Rule: When search results are received from the main process, display them in a clear, scrollable list.
    *   Rule: Each result should show the relevant snippet and a clear link/identifier to its source item.
    *   Rule: Clicking a search result should load the full content of its source item into the Content Viewing Area.

**F. Item Management UI:**

1.  **Delete Item:**
    *   Rule: Provide a UI mechanism (e.g., button in library view or content view) to delete a selected item.
    *   Rule: This action should trigger an IPC call to the main process to invoke the Stage 1 item deletion backend function.
    *   Rule: Update the UI (e.g., remove item from list) upon successful deletion.

---

## IV. Testing & Validation for Stage 2

1.  **UI Component Tests (if applicable with chosen framework):**
    *   Rule: Test individual UI components for rendering and basic interactions.
2.  **IPC Integration Tests:**
    *   Rule: Verify that UI actions correctly trigger main process logic via IPC and that data flows correctly in both directions for:
        *   Content ingestion.
        *   Listing library items.
        *   Viewing item details.
        *   Performing searches and displaying results.
        *   Deleting items.
3.  **End-to-End User Scenario Tests:**
    *   Rule: Test the full user flow:
        *   Add a PDF, a web page, and a YouTube video.
        *   Verify they appear in the library view.
        *   Search for content within one of the ingested items using a natural language query.
        *   Verify relevant snippets are returned.
        *   Click a search result to view the full content.
        *   Delete an item and verify it's removed.
4.  **Basic Usability Testing:**
    *   Rule: Perform informal usability checks to ensure the UI is understandable and functional.

---

**Definition of Done for Stage 2:**
*   Electron application shell is set up and functional.
*   Semantic search backend logic is implemented and integrated via IPC.
*   Core UI elements are implemented:
    *   Content ingestion panel allows adding PDFs, web URLs, and YouTube URLs.
    *   Library view lists all stored knowledge items.
    *   Content viewing area displays full text and metadata of selected items.
    *   Search bar allows users to input queries.
    *   Results display area shows relevant snippets from search.
    *   Users can delete items from the knowledge base via the UI.
*   IPC communication between renderer and main processes is reliable for all core features.
*   Basic UI and integration tests validate the functionality.
*   The application provides a basic but complete cycle of content ingestion, storage, search, and retrieval. 