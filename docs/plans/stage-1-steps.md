# Step-by-Step Plan for Stage 1: Content Ingestion & Storage Backbone

## 1. Project Setup
- [x] Initialize Node.js/Python project and Git repository
- [x] Install vector database (ChromaDB, Qdrant, or LanceDB)
- [x] Install text extraction libraries (pdf-parse, Mozilla Readability, youtube-transcript)
- [x] Install embedding model library and download pre-trained model
- [x] Create configuration system for paths and settings

## 2. Electron Application Shell Setup
- [x] Set up new Electron project with necessary scripts
- [x] Create basic main process and renderer process structure
- [x] Integrate UI framework (React, Vue, or Svelte) if desired
- [x] Establish IPC mechanisms for main/renderer process communication

## 3. Vector Database Implementation
- [x] Write database initialization script with local persistence
- [x] Define collection schema with required fields:
  - id, source_type, source_identifier, title, original_content_path
  - extracted_text, text_chunks, embeddings, metadata
- [x] Create main collection in vector DB based on schema

## 4. Content Processing Pipelines
- [x] Implement PDF processing:
  - [x] Create function for accepting file path
  - [x] Extract and clean text from PDF
  - [x] Split text into chunks
  - [x] Generate embeddings for text chunks
  - [x] Store all data in vector database

- [x] Implement Web URL processing:
  - [x] Create function for accepting URL
  - [x] Fetch HTML and extract main content using Readability
  - [x] Process text (cleaning and chunking)
  - [x] Generate embeddings
  - [x] Store data in vector database

- [x] Implement YouTube processing:
  - [x] Create function for accepting YouTube URL
  - [x] Fetch transcript and video title
  - [x] Process transcript (cleaning and chunking)
  - [x] Generate embeddings
  - [x] Store data in vector database

## 5. Data Management Functions
- [x] Implement item deletion by ID
- [x] Create function to list stored items for verification

## 6. Testing
- [x] Write unit tests for text extraction, chunking, and embedding generation
- [x] Create integration tests for each content pipeline
- [x] Verify database integrity with manual inspection
