# Knowledge Store Backend

## Environment Setup

This backend requires API keys for OpenAI (embeddings) and Google (Gemini AI for chat functionality). Follow these steps to set up your environment:

1. Create a `.env` file in the `backend` directory with the following content:

```
# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=your-openai-api-key-here

# Google Generative AI Configuration (for chat)
GOOGLE_API_KEY=your-google-api-key-here

# LLM Model Configuration
LLM_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=text-embedding-3-small

# Server Configuration
PORT=3001
NODE_ENV=development
```

2. Replace `your-openai-api-key-here` with your actual OpenAI API key.
   - You can get a key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Sign up or log in with your OpenAI account
   - Create a new API key

3. Replace `your-google-api-key-here` with your actual Google API key.
   - You can get a key from [Google AI Studio](https://makersuite.google.com/)
   - Sign up or log in with your Google account
   - Go to API keys and create a new key or use an existing one

4. Make sure to use `gemini-2.0-flash` as the model name, as `gemini-2.5-flash` is not yet available for public use.

## Running the Backend

Start the backend server:

```bash
npm run server
```

## Common Issues

1. **API Keys Not Valid**: Check that your API keys are correct and have access to their respective APIs.

2. **Model Not Found**: If you see an error about a model not being found, make sure the `LLM_MODEL` and `EMBEDDING_MODEL` in your `.env` file are set to supported models.

3. **Connection Issues**: If the frontend cannot connect to the backend, ensure the backend is running on port 3001 and that there are no firewall or network issues. 