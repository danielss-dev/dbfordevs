# Changelog

All notable changes to dbfordevs are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.1] - 2025-12-26

### Added

#### AI Query Assistant
- **OpenAI Provider Integration**: Added support for OpenAI GPT models including GPT-5.2, GPT-5 Mini, and GPT-5.2 Pro
- **Query Optimization Diff View**: New visual component for comparing original and optimized SQL queries with:
  - Side-by-side diff view with color-coded changes
  - Change summary highlighting specific improvements
  - Copy and Apply functionality for quick integration
- **Enhanced AI Context**: Improved context management including current query from editor for better understanding
- **Query Variants**: Support for multiple alternative query approaches in single AI response

#### PostgreSQL Enhancements
- **Comprehensive Value Handling**: Expanded PostgresDriver to handle all PostgreSQL data types including:
  - Binary data (BYTEA) encoded as Base64
  - Complex types: Arrays, Intervals, Money, Networks (IP/MAC)
  - All date/time types (chrono and time crate representations)
  - JSON/JSONB with native support
  - Bit vectors and custom composite types
- **Multi-Statement Execution**: Implemented SQL statement splitting with support for:
  - Proper handling of quotes (single, double, backticks)
  - Comment handling (single-line `--` and block `/* */`)
  - Escaped quote detection for PostgreSQL string literals
- **Transaction Support**: Multiple SQL statements now execute within a transaction for atomicity
- **Expanded SQLx Features**: Added support for additional database types in Cargo.toml

### Changed
- **AI Error Handling**: Enhanced error reporting with improved streaming message error management
- **Session Management**: Chat sessions now re-fetch after potential session creation to ensure consistency
- **Sidebar UI**: Removed version display from sidebar for cleaner interface
- **Model ID Handling**: Automatic migration of buggy model IDs from v0.2.0 early builds

### Fixed
- Fixed AI model ID inconsistencies from v0.2.0 early builds (haiku and gemini model IDs)
- Improved error display in streaming AI messages
- Fixed chat session synchronization issues

---

## [0.2.0] - 2025-12-25

### Added

#### AI Query Assistant
- **AI-Powered Chat Interface**: Introduced a dedicated AI panel for natural language interaction with your database
- **Multi-Provider Support**:
  - Integrated **Anthropic Claude** (supporting Claude 4.5 models)
  - Integrated **Google Gemini** (supporting Gemini 3 models)
- **SQL Generation**: Generate complex SQL queries from natural language descriptions with engine-specific syntax
- **Query Explanation**: Step-by-step breakdown of SQL logic, performance, and best practices
- **Context-Awareness**:
  - Automatic schema context enrichment for better AI understanding
  - Implemented `@` mentions for tables and columns in chat prompts
- **Chat Management**:
  - Persistent local storage for AI conversations
  - Chat history session management (create, rename, delete, favorite)
  - Configurable auto-cleanup for history sessions
- **Secure Infrastructure**:
  - Native Tauri HTTP proxy for AI API calls to bypass CORS restrictions
  - Secure local storage for API keys

#### UI & Experience
- **Sidebar Integration**: Added sparkles icon to the main sidebar for quick AI access
- **AI Settings**: Dedicated settings section for provider configuration and API key management
- **Enhanced Code Blocks**: SQL code blocks in AI chat now include "Copy to Editor" and "Execute" actions

### Changed
- **Tauri Integration**: Updated internal networking to leverage Tauri's native capabilities for AI features
- **Project Structure**: Organized AI logic into modular extension structure under `src/extensions/ai`

### Fixed
- Fixed various minor UI inconsistencies in sidebar layouts

---

## [0.1.2] - 2025-12-21


### Added

#### Schema & Data Visualization
- **Schema Diagram Viewing**: Added context menu option in the Sidebar to view schema diagrams directly from the schema list
- **Enhanced Table Diagrams**:
  - Integrated search functionality in TableDiagramTab for quick table lookup and navigation
  - Implemented compact view mode for diagrams, optimizing layout for larger schemas
  - Added loading progress indicators for improved user feedback during table operations

#### Connection Management
- **Connection Operations**:
  - Introduced `RenameConnectionDialog` for renaming and duplicating connections with validation
  - Added `CreateSchemaDialog` for creating new database schemas with error handling
  - Enhanced `ConnectionItem` context menu with options for renaming and creating schemas
  - Implemented connection list refresh after duplication to ensure sidebar consistency

#### Table Management
- **Table Operations**:
  - Introduced `RenameTableDialog` for renaming tables with validation and error handling
  - Added `TablePropertiesTab` to display detailed table properties and constraints
  - Added `TableDiagramTab` for visualizing table relationships and DDL
  - Enhanced table properties display with schema and column information

#### Data Grid & UI Improvements
- **Data Grid Enhancements**:
  - Added `whitespace-nowrap` class to DataGrid cell rendering for improved text handling
  - Implemented minimum width (100px) for header and cells to ensure layout consistency
  - Implemented horizontal scrolling functionality in MainContent with navigation arrow buttons
  - Added dropdown select for active tabs, improving experience when managing multiple tabs

#### Clipboard Operations
- **Enhanced Clipboard Functionality**:
  - Implemented unified `copyToClipboard` utility function using Tauri for reliable clipboard access
  - Added `readFromClipboard` utility for reading clipboard content
  - Integrated DDL copying capability across ConnectionPropertiesDialog, TableDiagramTab, and TablePropertiesTab
  - Added comprehensive error handling and user feedback for clipboard operations

#### SQL Editor Enhancements
- **Editor Improvements**:
  - Updated CSS for better font handling in developer styles
  - Added new theme properties for editor gutter and folding controls
  - Enabled code folding features for improved code organization and readability
  - Enhanced Monaco editor theme customization

#### Application Infrastructure
- **Version Management**:
  - Created automated version bump script (`scripts/bump-version.ts`) for consistent versioning across all files
  - Updated version to 0.1.2 across package.json, Cargo.toml, and tauri.conf.json
  - Implemented dynamic version display in StatusBar and SettingsDialog

- **Developer Support**:
  - Added @types/node as development dependency for enhanced TypeScript support
  - Improved build tooling and TypeScript configuration

#### Documentation
- **Comprehensive Documentation Suite**:
  - Created [Architecture Guide](./docs/ARCHITECTURE.md) detailing technical structure and technology stack
  - Created [Features Guide](./docs/FEATURES.md) with overview of all application capabilities
  - Created [Getting Started Guide](./docs/GETTING_STARTED.md) for installation and first-time setup
  - Created [User Guide](./docs/USER_GUIDE.md) with in-depth usage instructions and best practices
  - Updated [README](./docs/README.md) with improved navigation and feature overview
  - Added links to documentation and GitHub in SettingsDialog for user convenience

### Changed

#### Code Quality & Maintenance
- **Error Handling**:
  - Simplified error handling in `CreateSchemaDialog` by removing unnecessary result error checks
  - Enhanced error handling throughout clipboard operations with user-friendly feedback

- **State Management**:
  - Refactored `useDatabase` hook to improve state management and reduce redundancy
  - Updated hook to clear cached tables for deleted connections, preventing memory leaks
  - Refactored `ConnectionItem` component to improve state management efficiency
  - Refactored `useUIStore` hook to support new connection management features

- **Code Cleanup**:
  - Removed redundant text from context menu items for copying and pasting
  - Removed unused `executeQuery` function from `useDatabase` hook usage in `ConnectionItem`

#### Layout & Positioning
- **Diagram Layout Algorithms**:
  - Refactored layout algorithms for improved table positioning in diagrams
  - Optimized spacing in both detailed and compact diagram views

### Fixed

- Fixed sidebar update consistency after connection duplication
- Improved table loading logic in `ConnectionItem` component to prevent redundant operations
- Enhanced memory management by clearing cached tables when connections are deleted

### Dependencies

- Updated Cargo.lock for consistency across Rust dependencies
- Updated bun.lock for Node.js dependency consistency
- Added capability and permission configurations for enhanced Tauri functionality
- Updated Tauri-related permissions for improved security and functionality

### Technical Details

#### Database Support
The following databases continue to be fully supported:
- PostgreSQL (with connection pooling)
- MySQL 5.7+
- MariaDB
- SQLite (file-based)
- Microsoft SQL Server 2012+
- Oracle
- MongoDB
- Redis
- CockroachDB
- Cassandra

#### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Rust, Tauri 2.x
- **Database Drivers**: SQLx (async SQL support)
- **UI Components**: Radix UI, Lucide React icons
- **Editor**: Monaco Editor (VS Code core)
- **State Management**: Zustand

#### Browser Support
The application supports all modern platforms:
- Windows 10+
- macOS 10.13+
- Linux (Ubuntu 18.04+, Fedora 30+, and other modern distributions)

### Known Limitations

- Table diagrams may be memory-intensive for databases with hundreds of tables
- Some advanced database-specific features may require additional setup
- Plugin system foundation is in place but not yet fully exposed to users

---

## [0.1.0] - 2025-12-15

### Added

#### Core Features
- **Three-panel Layout**: Sidebar for connections/schema, main content area for queries/data, collapsible side panel for details
- **Virtualized Scrolling**: Efficient rendering of large datasets with smooth scrolling
- **Theme Support**: Light and dark theme modes with system theme detection

#### SQL Editor
- **Monaco Editor Integration**: VS Code-powered editor with rich editing capabilities
- **Code Intelligence**:
  - SQL keyword autocomplete
  - IntelliSense support
  - Custom syntax highlighting with theme-aware styling
  - Multi-line query support

#### Database Connectivity
- **Multi-Database Support**:
  - PostgreSQL
  - MySQL/MariaDB
  - SQLite
  - And foundation for additional databases
- **Connection Management**:
  - Save and manage multiple database connections
  - Connection testing and validation
  - Secure credential handling

#### Data Visualization & Management
- **Data Grid**: High-performance grid component with:
  - Sorting capabilities
  - Pagination support
  - Virtualized rendering for large datasets
- **Schema Tools**: View table structures and relationships
- **DDL Viewing**: Display CREATE TABLE statements

#### Extensibility
- **Plugin Architecture**: Foundation for extending functionality
- **Plugin Marketplace UI**: Browse and manage plugins
- **Connection String Validators**:
  - C# connection string validator
  - Node.js connection string validator
  - Python connection string validator

#### User Interface
- **Modern Design**: Clean, developer-friendly interface
- **Responsive Layout**: Adapts to different screen sizes
- **Context Menus**: Right-click menus for common operations

### Technical Details

#### Architecture
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite with React plugin
- **Styling**: TailwindCSS with shadcn/ui components
- **Desktop Framework**: Tauri 2.x (Rust backend)
- **Database Access**: SQLx with async support
- **State Management**: Zustand for lightweight state

#### Key Dependencies
- @monaco-editor/react: ^4.6.0
- @tauri-apps/api: ^2.1.1
- @tauri-apps/cli: ^2.1.0
- @tanstack/react-table: ^8.20.5
- React: ^18.3.1
- TypeScript: ~5.6.3
- TailwindCSS: ^3.4.16
- Vite: ^6.0.1

#### Platform Support
- **Windows**: 10 and later
- **macOS**: 10.13 and later
- **Linux**: Ubuntu 18.04+, Fedora 30+, and other modern distributions

### System Requirements

#### Minimum
- RAM: 512 MB
- Disk Space: 100 MB free
- Display Resolution: 1024x768

#### Recommended
- RAM: 2+ GB
- Disk Space: 500 MB free
- Display Resolution: 1920x1080
- Recent OS versions

### Initial Release Notes

This is the inaugural release of dbfordevs, a lightweight database client built for developers. The application is designed with simplicity and performance in mind, providing a modern alternative to traditional, heavyweight database management tools.

**Design Philosophy**:
- Lightweight and fast
- Developer-first features
- Cross-platform compatibility
- Extensible architecture
- Beautiful and intuitive UI

**Use Cases**:
- Quick database exploration and querying
- Development environment database management
- Learning SQL and database concepts
- Testing queries before production execution
- Data inspection and validation

---

## Versioning

dbfordevs follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes (0.x.x currently indicates early development)
- **MINOR**: New features in a backwards-compatible manner
- **PATCH**: Bug fixes and maintenance

## Contributing

Contributions are welcome! Please see the [Architecture Guide](./docs/ARCHITECTURE.md) for development setup and guidelines.

## License

dbfordevs is available under the MIT License with support for community plugins and commercially licensed extensions.
