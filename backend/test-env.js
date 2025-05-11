// Test if dotenv is correctly loading environment variables
require('dotenv').config();
console.log('Environment variables:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Key is set (hidden for security)' : 'Key is NOT set');
console.log('EMBEDDING_MODEL:', process.env.EMBEDDING_MODEL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check where .env file is being looked for
const path = require('path');
console.log('\nCurrent working directory:', process.cwd());
console.log('Expected .env location:', path.resolve(process.cwd(), '.env'));

// Try to read the .env file directly
const fs = require('fs');
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n.env file exists and contains:');
  console.log(envContent.split('\n').map(line => 
    line.startsWith('OPENAI_API_KEY=') ? 'OPENAI_API_KEY=[HIDDEN]' : line
  ).join('\n'));
} catch (err) {
  console.error('\nError reading .env file:', err.message);
} 