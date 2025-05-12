# Knowledge Store Frontend

A modular Electron-based frontend for the Knowledge Store application.

## Project Structure

```
frontend/
├── src/
│   ├── components/          # UI components
│   │   ├── App.js           # Main application component
│   │   ├── Header.js        # Page header
│   │   ├── Footer.js        # Page footer
│   │   ├── SearchSection.js # Search functionality
│   │   ├── ContentInput.js  # Content input forms
│   │   ├── ContentList.js   # Content list display
│   │   └── ContentViewer.js # Content viewer
│   ├── services/            # Service modules
│   │   ├── ApiService.js    # API communication
│   │   └── NotificationService.js # UI notifications
│   ├── utils/               # Utility functions
│   │   └── logger.js        # Logging utility
│   ├── main.js              # Electron main process
│   ├── preload.js           # Electron preload script
│   └── index.js             # Renderer process entry point
├── public/
│   ├── index.html           # HTML template
│   └── styles/              # CSS styles
│       ├── main.css         # Main stylesheet
│       └── components/      # Component-specific styles
├── scripts/
│   └── build.js             # Custom build script
├── webpack.config.js        # Webpack configuration
└── package.json             # Project dependencies
```

## Development

### Prerequisites

- Node.js (v14+)
- npm (v6+)

### Installation

```bash
# Install dependencies
npm install
```

### Development Server

```bash
# Start the Electron app in dev mode
npm run dev
```

This will start the Electron app with devtools enabled.

### Building for Production

```bash
# Build for production
cd frontend && npm run build && cd ..

# Build for macOS
npx electron-builder build --mac dmg --config=electron-builder.json
```

This will create optimized files in the `dist` directory.

## Architecture

The frontend uses a hybrid architecture combining Electron with modular components:

1. **Electron Integration**:
   - `main.js`: Electron main process, manages the application lifecycle
   - `preload.js`: Securely exposes IPC APIs to the renderer process
   - IPC communication with the backend for data operations

2. **Component-Based Structure**:
   - Each UI element is a separate component with its own logic
   - Components communicate via events and services
   - Clean separation of concerns for better maintainability

3. **Modular CSS**:
   - Component-specific CSS files for better style organization
   - Responsive design with CSS Grid layout
   - Consistent theming across components

This architecture combines the power of Electron for desktop integration with the maintainability of a modular component structure. 