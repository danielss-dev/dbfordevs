# dbfordevs v0.1.2 Release Notes

**Version**: 0.1.2
**Release Date**: December 21, 2025
**Status**: Production Release

---

## Overview

v0.1.2 focuses on enhancing data visualization capabilities, improving connection management workflows, and enriching the user experience through better table management and comprehensive documentation. This release builds on the solid foundation of v0.1.0 with meaningful improvements to core features users interact with daily.

---

## Key Features & Enhancements

### 🔍 Schema Visualization Improvements

#### Schema Diagram Viewing
- **New Context Menu**: Right-click on schemas in the sidebar to open diagram view
- **Better Navigation**: Quickly visualize your entire database schema at a glance
- **Table Search**: Built-in search functionality to find tables within large schemas
- **Compact Mode**: Optimized layout for schemas with many tables
- **Loading Indicators**: Visual feedback while diagrams load

**Use Case**: Understand database structure without manually navigating table by table

---

### 🔌 Connection Management Enhancements

#### Connection Operations
- **Rename Connections**: Easily rename saved connections to match your naming conventions
- **Duplicate Connections**: Clone connection profiles with one click - perfect for similar database instances
- **Create Schemas**: Add new schemas directly from the connection context menu
- **Improved Consistency**: Fixed sidebar update issues after operations

**Workflow Example**:
```
1. Right-click a connection → "Rename" → Update connection name
2. Right-click a connection → "Duplicate" → Create similar connection
3. Right-click a connection → "Create Schema" → Add new schema
```

**Benefit**: Reduce repetitive configuration when managing multiple database environments

---

### 📊 Table Management Features

#### Table Operations Dialog
- **Rename Tables**: Change table names with validation
- **Properties View**: See detailed table structure including:
  - Column definitions
  - Data types
  - Constraints and indexes
  - Primary/Foreign keys

#### Table Visualization
- **Relationship Diagrams**: Visual representation of table relationships
- **DDL Display**: View CREATE TABLE statements
- **Copy DDL**: One-click copy of DDL to clipboard for version control

**Use Case**: Understand table structure and relationships before executing queries

---

### ⚡ User Interface Improvements

#### Data Grid Enhancements
- **Better Text Handling**: Improved text rendering in grid cells
- **Consistent Sizing**: All cells now have minimum width of 100px for better readability
- **Horizontal Scrolling**: Navigate wide result sets with arrow buttons
- **Tab Management**: New dropdown selector for quick tab switching when working with many queries

#### Editor Improvements
- **Code Folding**: Fold/collapse code blocks in the SQL editor for better readability
- **Theme Updates**: Enhanced editor theme with improved gutter and folding controls
- **Better Font Handling**: Refined CSS for developer styles and icon rendering

**Impact**: Work more efficiently with large datasets and complex queries

---

### 📋 Comprehensive Documentation

New documentation guides help users get the most from dbfordevs:

#### [Getting Started Guide](./GETTING_STARTED.md)
- Installation instructions for all platforms
- First connection setup
- Running your first query
- Understanding the interface

#### [Features Guide](./FEATURES.md)
- Detailed feature explanations
- Step-by-step tutorials
- Keyboard shortcuts reference
- Tips and tricks

#### [User Guide](./USER_GUIDE.md)
- In-depth feature documentation
- Common workflows
- Advanced usage patterns
- Troubleshooting guide

#### [Architecture Guide](./ARCHITECTURE.md)
- Technical architecture overview
- Technology stack details
- Codebase structure
- Extension development guide

---

### 🔧 Infrastructure & Tooling

#### Version Management
- **Automated Version Bumping**: New script for consistent versioning across files
- **Version Display**: Application version now shows in StatusBar and SettingsDialog
- **Consistency**: Version synchronized across:
  - package.json (frontend)
  - Cargo.toml (backend)
  - tauri.conf.json (desktop config)

#### Developer Improvements
- **Better TypeScript Support**: Added @types/node for improved type checking
- **Build Tooling**: Enhanced build configuration
- **Permissions**: Improved Tauri permissions configuration

---

## Technical Changes

### Code Quality Improvements

#### Error Handling
- Simplified error handling in schema creation dialog
- Enhanced clipboard operation error feedback
- Better user-facing error messages

#### State Management Refactoring
- Improved `useDatabase` hook for better performance
- Optimized `ConnectionItem` component state handling
- Enhanced `useUIStore` for new features
- Fixed memory leaks by clearing cached tables on connection deletion

#### Layout Optimization
- Refactored diagram layout algorithms
- Better table positioning in schemas
- Improved spacing in both detailed and compact views

---

## Dependencies & Versions

### Core Dependencies
- **React**: 18.3.1
- **TypeScript**: ~5.6.3
- **Tauri**: 2.x
- **Vite**: 6.0.1
- **TailwindCSS**: 3.4.16
- **Monaco Editor**: 4.6.0

### UI Components
- **Radix UI**: Various components (buttons, dialogs, menus, etc.)
- **shadcn/ui**: Component library built on Radix UI
- **Lucide React**: Icon library

### Database Access
- **SQLx**: Async SQL toolkit with compile-time checked queries

---

## Bug Fixes

✅ Fixed sidebar consistency after connection duplication
✅ Improved table loading logic to prevent redundant operations
✅ Enhanced memory management for large schemas
✅ Fixed context menu text redundancy issues
✅ Improved error handling in connection operations

---

## Database Support

Verified support for:
- ✅ **PostgreSQL** (including connection pooling)
- ✅ **MySQL** 5.7+
- ✅ **MariaDB**
- ✅ **SQLite** (file-based)
- ✅ **Microsoft SQL Server** 2012+
- ✅ **Oracle**
- ✅ **MongoDB**
- ✅ **Redis**
- ✅ **CockroachDB**
- ✅ **Cassandra**

---

## Platform Support

### Supported Operating Systems

| OS | Version | Status |
|----|---------|--------|
| Windows | 10 and later | ✅ Fully Supported |
| macOS | 10.13 and later | ✅ Fully Supported |
| Linux | Ubuntu 18.04+, Fedora 30+ | ✅ Fully Supported |

### System Requirements

**Minimum**:
- RAM: 512 MB
- Storage: 100 MB free
- Display: 1024×768 resolution

**Recommended**:
- RAM: 2+ GB
- Storage: 500 MB free
- Display: 1920×1080 resolution
- Modern OS versions

---

## Breaking Changes

**None** - v0.1.2 is fully backward compatible with v0.1.0

### What This Means
- ✅ All saved connections continue to work
- ✅ All settings and preferences are preserved
- ✅ No database schema migrations required
- ✅ Direct upgrade path from v0.1.0 to v0.1.2

---

## Migration Guide

### Upgrading from v0.1.0

1. **Download** the v0.1.2 installer from [GitHub Releases](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2)

2. **Install** following your platform's instructions:
   - **Windows**: Run the `.msi` installer
   - **macOS**: Drag app to Applications folder
   - **Linux**: Install the `.deb` or run `.AppImage`

3. **Launch** dbfordevs - your connections and settings are automatically migrated

4. **Enjoy** the new features - no additional configuration needed!

### Data Preservation

All user data is automatically preserved:
- ✅ Saved connections
- ✅ Preferences and settings
- ✅ Query history (if applicable)
- ✅ Custom themes

---

## Known Issues

- **Large Schemas**: Diagrams with 100+ tables may consume more memory. Consider filtering schemas for better performance.
- **Plugin System**: Foundation is in place but not yet exposed to end users for custom plugin creation
- **Advanced Features**: Some advanced database-specific features may require additional configuration

---

## Performance Improvements

- **Memory Management**: Better handling of cached data for large schemas
- **Rendering**: Improved virtualized scrolling performance in data grids
- **Diagram Layout**: Optimized algorithms for faster diagram rendering

---

## Security Enhancements

- Improved Tauri permissions configuration
- Better credential handling in connection management
- Enhanced clipboard operation security

---

## What's Next (v0.1.3 Preview)

Planned features for upcoming releases:

- 🔲 User plugin installation and management
- 🔲 Advanced query history with templates
- 🔲 Database comparison tools
- 🔲 Batch operations for data management
- 🔲 Performance improvements for ultra-large datasets
- 🔲 Custom connection profiles and templates
- 🔲 Enhanced query autocomplete

---

## Download & Installation

### Direct Downloads

Visit [GitHub Releases v0.1.2](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2) to download for your platform:

- **Windows**: `dbfordevs_0.1.2_x64_en-US.msi`
- **macOS**: `dbfordevs_0.1.2_aarch64.dmg` (Apple Silicon) or `dbfordevs_0.1.2_x64.dmg` (Intel)
- **Linux**: `dbfordevs_0.1.2_amd64.AppImage` or `dbfordevs_0.1.2_amd64.deb`

### Installation Instructions

**Windows**
1. Download the `.msi` installer
2. Double-click to run the installer
3. Follow the setup wizard
4. Launch dbfordevs from the Start menu

**macOS**
1. Download the `.dmg` file
2. Double-click to open
3. Drag the app to the Applications folder
4. Launch from Applications or Launchpad

**Linux**
- **AppImage**: Download, make executable (`chmod +x`), and run
- **deb**: `sudo apt install ./dbfordevs_0.1.2_amd64.deb`

---

## Support & Feedback

### Getting Help

- 📖 **Documentation**: Check [docs/README.md](./README.md)
- 🆘 **Troubleshooting**: See [User Guide](./USER_GUIDE.md)
- 💬 **Questions**: File an issue or discussion on GitHub

### Report Issues

Found a bug? Help us improve:
1. Go to [GitHub Issues](https://github.com/danielss-dev/dbfordevs/issues)
2. Click "New Issue"
3. Include:
   - Clear description
   - Steps to reproduce
   - Your OS and dbfordevs version
   - Error messages or screenshots

### Feature Requests

Have an idea? Share it:
1. Check existing [GitHub Issues](https://github.com/danielss-dev/dbfordevs/issues)
2. Create a new issue with "Feature Request:" prefix
3. Describe the use case and expected behavior

---

## Changelog Summary

### Added
- Schema diagram viewing from sidebar
- Table search in diagrams
- Connection rename and duplicate features
- Schema creation dialog
- Table rename and properties viewing
- DDL copying across components
- Clipboard utility functions
- Comprehensive documentation suite
- Automated version bump script
- Code folding in SQL editor

### Changed
- Improved error handling throughout
- Refactored state management
- Enhanced diagram layout algorithms
- Better text handling in data grids
- Improved tab management UI

### Fixed
- Sidebar consistency after operations
- Memory management for cached data
- Context menu redundancy
- Diagram positioning

---

## Contributors & Acknowledgments

Special thanks to all who contributed to making v0.1.2 possible.

---

## About dbfordevs

dbfordevs is a lightweight, cross-platform database management application built specifically for developers. It combines the simplicity of modern web technologies (React, TypeScript) with the power of a native desktop application (Tauri) to provide a fast, beautiful, and intuitive database client.

**Philosophy**: Simple, fast, and built for developers - by developers.

---

## License

dbfordevs is available under the MIT License with support for community plugins and commercially licensed extensions.

---

**Version**: 0.1.2
**Released**: December 21, 2025
**Status**: Production Ready

For the latest updates, visit: [GitHub Repository](https://github.com/danielss-dev/dbfordevs)
