# Knowledge Store

A personal knowledge management system that ingests content from various sources, processes it, and makes it searchable through vector embeddings.

## Project Structure

- `frontend/`: Contains the Electron-based user interface
- `backend/`: Contains the core logic for content processing and vector database management

## Features (Stage 1)

- Content ingestion from multiple sources:
  - PDF documents
  - Web pages (URLs)
  - YouTube videos (transcripts)
- Text extraction and processing
- Vector embeddings generation
- Local vector database storage

## Setup

1. Install dependencies:
   ```
   cd backend && npm install
   cd frontend && npm install
   ```

2. Configure the application (see Configuration section)

3. Run the application (instructions coming soon)

## Development

This project is being developed in stages:

- Stage 1: Content Ingestion & Storage Backbone
- Stage 2: Search Capabilities & Basic UI
- Stage 3: Advanced Features & Refinement

See the `docs/` directory for detailed development plans.

## License

[Specify license] 