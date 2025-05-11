const express = require('express');
const path = require('path');
const app = express();

// Enable more detailed logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Route for model test page
app.get('/model-test.html', (req, res) => {
  console.log('Model test page requested');
  res.sendFile(path.join(__dirname, 'frontend/public/model-test.html'));
});

// Add specific route for the model file to debug any issues
app.get('/assets/models/sea_angel_gltf/scene.gltf', (req, res) => {
  console.log('Model GLTF file requested');
  res.sendFile(path.join(__dirname, 'frontend/public/assets/models/sea_angel_gltf/scene.gltf'));
});

// Default route for the main app
app.get('/', (req, res) => {
  console.log('Main app page requested');
  res.sendFile(path.join(__dirname, 'frontend/public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`To view model test: http://localhost:${PORT}/model-test.html`);
}); 