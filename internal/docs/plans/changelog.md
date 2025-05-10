## [0.1.1] - 2025-05-10

### Added
- Unified logging system with Winston (backend) and electron-log (frontend)
- Context-based logging with different severity levels
- Log rotation with daily file cycling
- Colorized console output
- HTTP request logging middleware

### New Files
- `backend/src/utils/logger.js`: Winston-based logger implementation
- `backend/src/utils/httpLogger.js`: Morgan HTTP logging middleware
- `frontend/src/utils/logger.js`: Electron-log implementation 
- Tests for both frontend and backend loggers

### Changed
- Updated backend and frontend entry points to use structured logging
- Added preload API for renderer process logging
- Extended config with logging settings
- Refactored services to use contextual loggers
