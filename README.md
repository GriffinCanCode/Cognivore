# Cognivore

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

# Gemini 2.0-flash-001 Fine-tuning Dataset

This repository contains a JSONL training dataset for fine-tuning the Gemini 2.0-flash-001 model on Google Cloud Vertex AI.

## Dataset Overview

The dataset (`training_data.jsonl`) is formatted according to Google Cloud's specifications for supervised fine-tuning. It contains examples that teach the model to:

1. Embody the personality of "Cognivore," a divine entity that serves as an information-gathering agent for the goddess Mnemosyne
2. Use various knowledge management tools effectively
3. Maintain a distinctive speech pattern that mixes formal/archaic language with profanity
4. Incorporate the mythology and backstory from the program's narrative

## Format

Each example follows the required format for Gemini fine-tuning:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "User query"
    },
    {
      "role": "model",
      "content": "Desired model response"
    }
  ]
}
```

## Dataset Content Types

The dataset includes several types of examples:

1. **Mythological background**: Examples explaining Mnemosyne, Cognivore, Griffin, and the Sieve
2. **Tool usage**: Examples demonstrating proper use of tools like `searchKnowledgeBase`, `getItemContent`, etc.
3. **Character voice**: Examples reinforcing the unique speech pattern and personality
4. **RAG functionality**: Examples showing how to perform retrieval augmented generation tasks

## Usage Instructions

To use this dataset for fine-tuning:

1. Ensure it's properly formatted as a JSONL file (each line is a complete JSON object)
2. Upload to a Google Cloud Storage bucket
3. Create a supervised fine-tuning job in Vertex AI using the Gemini 2.0-flash-001 model
4. Set appropriate hyperparameters for your fine-tuning task
5. Monitor the training metrics through the Vertex AI console

## Tool Definitions

The model is trained to use the following tools:

- `searchKnowledgeBase`: Search for relevant information in the knowledge base
- `getItemContent`: Retrieve full content of a specific item
- `summarizeContent`: Generate a concise summary of provided content
- `recommendRelatedContent`: Find related content based on a query or item
- `listAllFiles`: List all files in the knowledge base
- `listFilesByType`: List files of a specific type
- `listFilesWithContent`: Find files containing specific content
- `listRecentFiles`: List recently added files

## Notes

This dataset is designed to reduce the need for lengthy system prompts by baking the character's personality and mythology directly into the model's tuned weights.

## Dataset Format for Gemini Fine-tuning

The training and validation datasets have been converted from the ChatCompletions format to the GenerateContent format required by Google's Gemini models:

### Original Format (ChatCompletions)
```json
{
  "messages": [
    {
      "role": "user",
      "content": "User query"
    },
    {
      "role": "model",
      "content": "Model response"
    }
  ]
}
```

### Correct Format for Gemini Fine-tuning
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "User query"
        }
      ]
    },
    {
      "role": "model",
      "parts": [
        {
          "text": "Model response"
        }
      ]
    }
  ]
}
```

This format follows Gemini's conversation format with "role" and "parts" fields, where each message has a role (user or model) and parts containing the text content.

### Important JSONL Formatting Requirements

When uploading JSONL files to Google Cloud Storage for Gemini fine-tuning:

1. Each line must be a complete, valid JSON object
2. No trailing commas should be present between objects
3. No line breaks within individual JSON objects (all objects must be on a single line)
4. The file must use UTF-8 encoding
5. Each example must conform to the Gemini API's expected format with the `contents` field
6. Each message must have `role` and `parts` fields properly structured

Improper formatting can result in errors like:
- `End of input at line 1 column 16 path $.instances[0]`
- `Missing required 'contents' field`

This conversion allows the datasets to be used directly with Google's Vertex AI platform for fine-tuning Gemini models. 