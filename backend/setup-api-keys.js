/**
 * Setup API Keys for Knowledge Store
 * 
 * This script helps to check and configure your API keys for OpenAI and Google.
 * Run it with: node setup-api-keys.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to .env file
const envPath = path.join(__dirname, '.env');

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to check if .env file exists
function checkEnvFile() {
  try {
    if (fs.existsSync(envPath)) {
      console.log(`Found .env file at: ${envPath}`);
      return true;
    } else {
      console.log(`No .env file found at: ${envPath}`);
      return false;
    }
  } catch (err) {
    console.error('Error checking .env file:', err);
    return false;
  }
}

// Function to read existing .env content
function readEnvFile() {
  try {
    if (fs.existsSync(envPath)) {
      return fs.readFileSync(envPath, 'utf8');
    }
    return '';
  } catch (err) {
    console.error('Error reading .env file:', err);
    return '';
  }
}

// Parse environment variables from .env content
function parseEnvVars(content) {
  const envVars = {};
  if (!content) return envVars;
  
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    
    const match = trimmedLine.match(/^([^=]+)=(.*)/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if they exist
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      envVars[key] = value;
    }
  }
  
  return envVars;
}

// Function to write updated .env file
function writeEnvFile(envVars) {
  try {
    let content = '';
    for (const [key, value] of Object.entries(envVars)) {
      content += `${key}=${value}\n`;
    }
    
    fs.writeFileSync(envPath, content);
    console.log(`Successfully wrote .env file to: ${envPath}`);
    return true;
  } catch (err) {
    console.error('Error writing .env file:', err);
    return false;
  }
}

// Main function
async function main() {
  console.log('\n=== Knowledge Store API Key Setup ===\n');
  
  // Check for existing .env file
  const envFileExists = checkEnvFile();
  
  // Read and parse existing .env if it exists
  const existingContent = readEnvFile();
  const envVars = parseEnvVars(existingContent);
  
  console.log('\nCurrent API Keys:');
  console.log('----------------');
  console.log(`OPENAI_API_KEY: ${envVars.OPENAI_API_KEY ? '***' + envVars.OPENAI_API_KEY.substring(envVars.OPENAI_API_KEY.length - 4) : 'Not set'}`);
  console.log(`GOOGLE_API_KEY: ${envVars.GOOGLE_API_KEY ? '***' + envVars.GOOGLE_API_KEY.substring(envVars.GOOGLE_API_KEY.length - 4) : 'Not set'}`);
  console.log(`EMBEDDING_MODEL: ${envVars.EMBEDDING_MODEL || 'Not set (will use default: text-embedding-3-small)'}`);
  console.log(`LLM_MODEL: ${envVars.LLM_MODEL || 'Not set (will use default: gemini-2.0-flash)'}`);
  console.log('');
  
  // Ask user if they want to update keys
  const updateKeys = await prompt('Do you want to update these API keys? (y/n): ');
  
  if (updateKeys.toLowerCase() === 'y' || updateKeys.toLowerCase() === 'yes') {
    // OpenAI API Key
    const openaiKey = await prompt('Enter your OpenAI API Key (press Enter to keep existing or leave blank): ');
    if (openaiKey) {
      envVars.OPENAI_API_KEY = openaiKey;
      console.log('OpenAI API Key updated.');
    }
    
    // Google API Key
    const googleKey = await prompt('Enter your Google API Key (press Enter to keep existing or leave blank): ');
    if (googleKey) {
      envVars.GOOGLE_API_KEY = googleKey;
      console.log('Google API Key updated.');
    }
    
    // Embedding Model
    const embeddingModel = await prompt('Enter embedding model (text-embedding-3-small or text-embedding-3-large): ');
    if (embeddingModel) {
      envVars.EMBEDDING_MODEL = embeddingModel;
      console.log('Embedding model updated.');
    } else if (!envVars.EMBEDDING_MODEL) {
      envVars.EMBEDDING_MODEL = 'text-embedding-3-small';
      console.log('Embedding model set to default: text-embedding-3-small');
    }
    
    // LLM Model
    const llmModel = await prompt('Enter LLM model (gemini-2.0-flash recommended): ');
    if (llmModel) {
      envVars.LLM_MODEL = llmModel;
      console.log('LLM model updated.');
    } else if (!envVars.LLM_MODEL) {
      envVars.LLM_MODEL = 'gemini-2.0-flash';
      console.log('LLM model set to default: gemini-2.0-flash');
    }
    
    // Write updated .env file
    if (writeEnvFile(envVars)) {
      console.log('\nAPI Keys have been successfully configured!');
      console.log('\nYou can now restart your application to use the new API keys.');
    }
  } else {
    console.log('No changes made to API keys.');
  }
  
  // Test OpenAI API Key
  if (envVars.OPENAI_API_KEY) {
    console.log('\nTesting OpenAI API Key...');
    try {
      // Simple check to see if the API key is readable from the file
      const fileContent = fs.readFileSync(envPath, 'utf8');
      const apiKeyMatch = fileContent.match(/OPENAI_API_KEY=(.+)/);
      if (apiKeyMatch && apiKeyMatch[1].trim() === envVars.OPENAI_API_KEY) {
        console.log('✅ OpenAI API Key is readable from the .env file.');
      } else {
        console.log('❌ OpenAI API Key may not be correctly saved in the .env file.');
      }
    } catch (err) {
      console.error('Error testing OpenAI API Key:', err);
    }
  }
  
  rl.close();
}

// Run the script
main().catch(err => {
  console.error('An error occurred:', err);
  rl.close();
}); 