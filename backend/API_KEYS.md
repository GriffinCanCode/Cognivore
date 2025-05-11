# API Keys Setup for Knowledge Store

## Overview

Knowledge Store uses two primary API keys:

1. **OpenAI API Key** - Used for generating embeddings (vector representations) of your content
2. **Google API Key** - Used for the chat functionality (Gemini AI)

This guide will help you set up and troubleshoot API key issues.

## Setup Process

### Option 1: Interactive Setup (Recommended)

1. Navigate to the `backend` directory
2. Run the setup script:
   ```
   node setup-api-keys.js
   ```
3. Follow the interactive prompts to add your API keys
4. Restart the application

### Option 2: Manual Setup

1. Create a `.env` file in the `backend` directory
2. Add the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_API_KEY=your_google_api_key_here
   EMBEDDING_MODEL=text-embedding-3-small
   LLM_MODEL=gemini-2.0-flash
   ```
3. Restart the application

## Getting API Keys

### OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in with your OpenAI account
3. Create a new API key
4. Copy the API key (it will only be shown once)

### Google API Key (for Gemini AI)

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign up or log in with your Google account
3. Go to API keys section and create a new key
4. Copy the API key

## Troubleshooting

### "Incorrect API key provided: undefined"

This error occurs when the application can't find your OpenAI API key. Solutions:

1. Run `node setup-api-keys.js` to ensure your API keys are properly set up
2. Make sure the `.env` file is in the correct location (in the `backend` directory)
3. Verify there are no spaces or quotes around your API keys in the `.env` file
4. Restart the application after making changes

### "Cannot read properties of undefined (reading 'getGenerativeModel')"

This error occurs when the application can't find your Google API key. Solutions:

1. Make sure you've added your Google API key to the `.env` file
2. Restart the application after adding your API key

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| OPENAI_API_KEY | Your OpenAI API key | (required) |
| GOOGLE_API_KEY | Your Google API key | (required) |
| EMBEDDING_MODEL | The OpenAI model for embeddings | text-embedding-3-small |
| LLM_MODEL | The model for chat functionality | gemini-2.0-flash |
| PORT | The port for the backend server | 3001 |

## Need Help?

If you're still experiencing issues with API keys, please check:

1. API key validity (test on the respective platforms)
2. Make sure the `.env` file is saved without special encoding
3. Restart the application completely after making changes 