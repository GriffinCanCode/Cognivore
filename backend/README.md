# Knowledge Store Backend

## Environment Setup

This backend requires a Google API key for Gemini AI functionality. Follow these steps to set up your environment:

1. Create a `.env` file in the `backend` directory with the following content:

```
# Google Generative AI Configuration
GOOGLE_API_KEY=your-google-api-key-here

# LLM Model Configuration
LLM_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=embedding-001

# Server Configuration
PORT=3001
NODE_ENV=development
```

2. Replace `your-google-api-key-here` with your actual Google API key.
   - You can get a key from [Google AI Studio](https://makersuite.google.com/)
   - Sign up or log in with your Google account
   - Go to API keys and create a new key or use an existing one

3. Make sure to use `gemini-2.0-flash` as the model name, as `gemini-2.5-flash` is not yet available for public use.

## Running the Backend

Start the backend server:

```bash
npm run server
```

## Common Issues

1. **API Key Not Valid**: Check that your Google API key is correct and has access to the Gemini API.

2. **Model Not Found**: If you see an error about a model not being found, make sure the `LLM_MODEL` in your `.env` file is set to a supported model like `gemini-2.0-flash`.

3. **Connection Issues**: If the frontend cannot connect to the backend, ensure the backend is running on port 3001 and that there are no firewall or network issues. 