/**
 * Google API Key Verification Script
 * Tests if the provided API key can successfully connect to Google Generative AI
 * 
 * Usage:
 * node verify-api-key.js [API_KEY]
 * 
 * If API_KEY is not provided as an argument, it will try to read from:
 * 1. process.env.GOOGLE_API_KEY
 * 2. .env file
 * 3. config.json
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Get API key
let apiKey = process.argv[2]; // Check command line argument first

if (!apiKey) {
  // Try environment variable
  apiKey = process.env.GOOGLE_API_KEY;
  
  // Try reading from .env file manually as a backup
  if (!apiKey) {
    try {
      if (fs.existsSync('./.env')) {
        const envContent = fs.readFileSync('./.env', 'utf8');
        const match = envContent.match(/GOOGLE_API_KEY=["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          apiKey = match[1].trim();
          console.log('Found API key in .env file');
        }
      }
    } catch (e) {
      console.log('Error reading .env file:', e.message);
    }
  }
  
  // Try config.json as a last resort
  if (!apiKey) {
    try {
      if (fs.existsSync('./config.json')) {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        if (config.googleApiKey) {
          apiKey = config.googleApiKey;
          console.log('Found API key in config.json');
        }
      }
    } catch (e) {
      console.log('Error reading config.json:', e.message);
    }
  }
}

// Verify API key
if (!apiKey) {
  console.error('❌ ERROR: No API key found!');
  console.error('Please provide your API key in one of these ways:');
  console.error('1. As a command line argument: node verify-api-key.js YOUR_API_KEY');
  console.error('2. In .env file: GOOGLE_API_KEY=YOUR_API_KEY');
  console.error('3. In config.json file: {"googleApiKey": "YOUR_API_KEY"}');
  process.exit(1);
}

console.log('Testing API key...');

// Test the API key
async function testApiKey() {
  try {
    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try to get a model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Try simple generation to verify API key works
    console.log('Sending a simple test request...');
    const result = await model.generateContent('Hello, this is a test message to verify my API key works.');
    const text = result.response.text();
    
    console.log('\n✅ SUCCESS! Your API key is valid and working correctly.\n');
    console.log('Model response:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    
    console.log('\nYou can now use this API key in your application.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR: API key validation failed!');
    console.error('Error message:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.error('\nYour API key appears to be invalid. Please check it and try again.');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('\nYour API key is missing required permissions. Please check your Google Cloud console.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      console.error('\nNetwork error. Please check your internet connection.');
    }
    
    console.error('\nMake sure you:');
    console.error('1. Have created an API key at https://ai.google.dev/');
    console.error('2. Have enabled the Gemini API in your Google Cloud project');
    console.error('3. Are using the correct key format (it should be a long string)');
    
    process.exit(1);
  }
}

testApiKey(); 