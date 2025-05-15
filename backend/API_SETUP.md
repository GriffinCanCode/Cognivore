# Setting Up Google Gemini API Key

This application requires a valid Google API key to access the Gemini AI models. Follow these instructions to set up your API key.

## Getting a Google Gemini API Key

1. Visit the Google AI Studio: https://ai.google.dev/
2. Sign in with your Google account
3. Click on "Get API key" in the top right corner
4. Create a new API key or use an existing one
5. Copy your API key (it should be a long string)

## Setting Up Your API Key

You have multiple options to add your API key to the application:

### Option 1: Add to `.env` file (Recommended)

1. Navigate to the `backend` directory
2. Create a file named `.env` if it doesn't exist
3. Add the following line to the file, replacing `YOUR_API_KEY` with your actual key:
   ```
   GOOGLE_API_KEY=YOUR_API_KEY
   ```

### Option 2: Update `config.json`

1. Navigate to the `backend` directory
2. Open the `config.json` file
3. Replace the value for `"googleApiKey"` with your actual API key:
   ```json
   {
     "googleApiKey": "YOUR_ACTUAL_API_KEY_HERE",
     ...
   }
   ```

### Option 3: Set Environment Variable

Set the `GOOGLE_API_KEY` environment variable in your system:

**Windows (Command Prompt):**
```
set GOOGLE_API_KEY=YOUR_API_KEY
```

**macOS/Linux:**
```
export GOOGLE_API_KEY=YOUR_API_KEY
```

## Verifying Your API Key

To verify your API key is working correctly:

1. Navigate to the `backend` directory
2. Run the verification script:
   ```
   node verify-api-key.js
   ```

If your key is valid, you'll see a success message. If not, follow the instructions provided by the script to fix any issues.

## Troubleshooting

If you encounter errors related to the API key:

1. **Invalid API Key**: Make sure you've copied the key correctly without any extra spaces
2. **Permission Denied**: Ensure the Gemini API is enabled in your Google Cloud project
3. **Rate Limiting**: Google may limit your API usage based on your plan
4. **Network Issues**: Check your internet connection if you get timeout errors

For more help, visit the [Google AI Studio documentation](https://ai.google.dev/docs) or check the error messages in the application logs. 