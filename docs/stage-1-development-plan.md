# Stage 1: Foundation - Content Ingestion & Storage Backbone

**Overall Goal:** Establish the core ability to ingest content from various sources, process it (extract text, generate embeddings), and store it reliably in a local vector database. This stage focuses on the backend systems and data pipeline.

**Key Sections from `plan.md`:** 4.A (Content Ingestion & Processing), 4.B (Knowledge Storage & Management)

---

## I. Project Setup & Core Dependencies

1.  **Initialize Project:**
    *   Rule: Set up a new Node.js or Python project environment.
    *   Rule: Initialize version control (Git).
2.  **Install Core Libraries:**
    *   **Vector Database:**
        *   Rule: Select and install one local/embeddable vector database (e.g., ChromaDB, Qdrant, LanceDB).
        *   Rule: Verify basic database creation, connection, and collection management.
    *   **Text Extraction:**
        *   Rule: Install `pdf-parse` (or chosen equivalent) for PDF text extraction.
        *   Rule: Install `Mozilla Readability` (or chosen equivalent) for web page content extraction.
        *   Rule: Install `youtube-transcript` (or chosen equivalent) for fetching YouTube transcripts.
    *   **Embedding Model:**
        *   Rule: Select and install a sentence transformer library (e.g., Hugging Face's `transformers` if using Python, or a JavaScript alternative).
        *   Rule: Download the chosen pre-trained model (e.g., `all-MiniLM-L6-v2`).
        *   Rule: Test local embedding generation for sample sentences.
3.  **Configuration Management:**
    *   Rule: Set up a basic configuration system for paths, model names, etc.

---

## II. Vector Database Setup & Schema

1.  **Database Initialization:**
    *   Rule: Write script/module to initialize the chosen vector database on application startup if it doesn't exist.
    *   Rule: Ensure the database is configured for local persistence.
2.  **Define Collection/Table Schema:**
    *   Rule: Define the structure for storing knowledge items. This must include:
        *   `id`: Unique identifier for each item.
        *   `source_type`: (e.g., 'pdf', 'url', 'youtube').
        *   `source_identifier`: (e.g., file path for PDF, URL for web page/YouTube).
        *   `title`: Extracted or user-provided title.
        *   `original_content_path`: If applicable (e.g., path to original PDF file).
        *   `extracted_text`: The main text content extracted from the source.
        *   `text_chunks`: List of smaller text segments from `extracted_text` (for finer-grained search).
        *   `embeddings`: List of vector embeddings, one for each `text_chunk`.
        *   `metadata`: Other relevant info (e.g., author, creation_date, ingestion_date).
    *   Rule: Create the main collection/table in the vector DB based on this schema.

---

## III. Content Ingestion Pipeline

**A. PDF Document Processing:**

1.  **File Input:**
    *   Rule: Develop a backend function that accepts a local PDF file path as input.
2.  **Text Extraction:**
    *   Rule: Use the chosen PDF library to extract raw text content from the PDF.
    *   Rule: Implement error handling for corrupted or unreadable PDFs.
3.  **Text Pre-processing & Chunking:**
    *   Rule: Clean the extracted text (remove excessive whitespace, special characters if needed).
    *   Rule: Implement a text chunking strategy (e.g., by paragraph, fixed token size) to create `text_chunks`.
4.  **Embedding Generation:**
    *   Rule: For each `text_chunk`, generate a vector embedding using the selected sentence transformer model.
5.  **Data Storage:**
    *   Rule: Store the `id`, `source_type` ('pdf'), `source_identifier` (file path), `title` (e.g., filename or extracted), `original_content_path` (file path), `extracted_text`, `text_chunks`, `embeddings`, and `metadata` into the vector database.

**B. Web Page (URL) Processing:**

1.  **URL Input:**
    *   Rule: Develop a backend function that accepts a web URL as input.
2.  **Content Fetching & Extraction:**
    *   Rule: Fetch the HTML content of the URL.
    *   Rule: Use the chosen library (e.g., Readability) to extract the main article text, stripping away boilerplate (ads, navigation).
    *   Rule: Extract the page title.
    *   Rule: Implement error handling for invalid URLs or fetch failures.
3.  **Text Pre-processing & Chunking:** (Same as PDF: III.A.3)
4.  **Embedding Generation:** (Same as PDF: III.A.4)
5.  **Data Storage:**
    *   Rule: Store the `id`, `source_type` ('url'), `source_identifier` (URL), `title`, `extracted_text`, `text_chunks`, `embeddings`, and `metadata` into the vector database.

**C. YouTube Video (URL) Processing:**

1.  **URL Input:**
    *   Rule: Develop a backend function that accepts a YouTube video URL as input.
2.  **Transcript Fetching:**
    *   Rule: Use the chosen library to fetch available transcripts for the video.
    *   Rule: Extract the video title.
    *   Rule: Handle cases where transcripts are unavailable or an error occurs.
3.  **Text Pre-processing & Chunking:** (Same as PDF: III.A.3, using transcript as text)
4.  **Embedding Generation:** (Same as PDF: III.A.4)
5.  **Data Storage:**
    *   Rule: Store the `id`, `source_type` ('youtube'), `source_identifier` (URL), `title`, `extracted_text` (transcript), `text_chunks`, `embeddings`, and `metadata` into the vector database.

---

## IV. Basic Data Management (Backend Logic)

1.  **Item Deletion:**
    *   Rule: Implement a backend function to delete an item (and its associated embeddings/chunks) from the vector database by its `id`.
2.  **Item Listing (for testing):**
    *   Rule: Implement a basic backend function to list all items or a subset (e.g., titles, IDs) for verification during development.

---

## V. Testing & Validation for Stage 1

1.  **Unit Tests:**
    *   Rule: Write unit tests for text extraction modules (PDF, URL, YouTube).
    *   Rule: Write unit tests for the embedding generation function.
    *   Rule: Write unit tests for text chunking logic.
2.  **Integration Tests:**
    *   Rule: Test the end-to-end ingestion pipeline for each content type:
        *   Input a sample file/URL.
        *   Verify correct text extraction.
        *   Verify successful embedding generation.
        *   Verify data is correctly stored in the vector database with all required fields.
    *   Rule: Test the item deletion functionality.
3.  **Database Integrity:**
    *   Rule: Manually inspect the database to confirm schema adherence and data integrity after several ingestions.

---

**Definition of Done for Stage 1:**
*   All core libraries are installed and functional.
*   Vector database is set up, and the schema is defined and implemented.
*   Content ingestion pipelines for PDF, Web URL, and YouTube URL are functional:
    *   Text can be reliably extracted.
    *   Text is chunked appropriately.
    *   Embeddings are generated for text chunks.
    *   All relevant data (text, embeddings, metadata) is stored in the vector database.
*   Backend logic for deleting items is implemented.
*   Basic unit and integration tests are in place for core ingestion functionalities.
*   The system is ready for the development of search capabilities and UI in Stage 2. 