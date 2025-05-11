# Knowledge Store

A personal knowledge management system that ingests content from various sources, processes it, and makes it searchable through vector embeddings. Now featuring a powerful chat interface powered by Gemini 2.5 Flash.

## Project Structure

- `frontend/`: Contains the Electron-based user interface
- `backend/`: Contains the core logic for content processing and vector database management

## Features

- Content ingestion from multiple sources:
  - PDF documents
  - Web pages (URLs)
  - YouTube videos (transcripts)
- Text extraction and processing
- Vector embeddings generation
- Local vector database storage
- **NEW:** Chat interface with Gemini 2.5 Flash LLM integration

## Setup

1. Install dependencies for all components:
   ```
   npm run install-all
   ```

2. Configure the backend:
   - Edit the `.env` file in the backend directory to add your Google API key:
     ```
     GOOGLE_API_KEY=your_api_key_here
     ```
   
3. Run the application:
   - Start everything with one command:
     ```
     npm run start:all
     ```
   
   - Or run components separately:
     ```
     # Start just the backend
     npm run backend
     
     # Start just the frontend
     npm run frontend
     ```

## Development

You can run the application in development mode:
```
npm run dev:all
```

This project is being developed in stages:

- Stage 1: Content Ingestion & Storage Backbone
- Stage 2: Search Capabilities & Basic UI
- Stage 3: Advanced Features & LLM Integration

See the `internal/docs/plans/` directory for detailed development plans.

## Troubleshooting

If the chat feature displays an error about the backend server not being available:
1. Make sure the backend server is running
2. Check that your Google API key is valid
3. Verify that the `.env` file in the backend directory is correctly configured

## License

[Specify license] 