# Step-by-Step Plan for Stage 1: Content Ingestion & Storage Backbone

## 1. Project Setup
- [ ] Initialize Node.js/Python project and Git repository
- [ ] Install vector database (ChromaDB, Qdrant, or LanceDB)
- [ ] Install text extraction libraries (pdf-parse, Mozilla Readability, youtube-transcript)
- [ ] Install embedding model library and download pre-trained model
- [ ] Create configuration system for paths and settings

## 2. Electron Application Shell Setup
- [ ] Set up new Electron project with necessary scripts
- [ ] Create basic main process and renderer process structure
- [ ] Integrate UI framework (React, Vue, or Svelte) if desired
- [ ] Establish IPC mechanisms for main/renderer process communication

## 3. Vector Database Implementation
- [ ] Write database initialization script with local persistence
- [ ] Define collection schema with required fields:
  - id, source_type, source_identifier, title, original_content_path
  - extracted_text, text_chunks, embeddings, metadata
- [ ] Create main collection in vector DB based on schema

## 4. Content Processing Pipelines
- [ ] Implement PDF processing:
  - [ ] Create function for accepting file path
  - [ ] Extract and clean text from PDF
  - [ ] Split text into chunks
  - [ ] Generate embeddings for text chunks
  - [ ] Store all data in vector database

- [ ] Implement Web URL processing:
  - [ ] Create function for accepting URL
  - [ ] Fetch HTML and extract main content using Readability
  - [ ] Process text (cleaning and chunking)
  - [ ] Generate embeddings
  - [ ] Store data in vector database

- [ ] Implement YouTube processing:
  - [ ] Create function for accepting YouTube URL
  - [ ] Fetch transcript and video title
  - [ ] Process transcript (cleaning and chunking)
  - [ ] Generate embeddings
  - [ ] Store data in vector database

## 5. Data Management Functions
- [ ] Implement item deletion by ID
- [ ] Create function to list stored items for verification

## 6. Testing
- [ ] Write unit tests for text extraction, chunking, and embedding generation
- [ ] Create integration tests for each content pipeline
- [ ] Verify database integrity with manual inspection
