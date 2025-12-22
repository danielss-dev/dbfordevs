# dbfordevs Release Notes

Quick reference for dbfordevs releases. For detailed changes, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v0.1.2

**Release Date**: December 21, 2025

### What's New

This release focuses on enhancing schema visualization, improving connection management, and refining the user experience with better table management and diagram capabilities.

#### Highlights

🔍 **Enhanced Schema Visualization**
- View schema diagrams directly from the sidebar
- Search functionality in table diagrams for quick navigation
- Compact view mode for handling large schemas efficiently
- Loading indicators for better user feedback

🔌 **Improved Connection Management**
- Rename existing connections
- Duplicate connections with one click
- Create new schemas directly from the connection menu
- Better state management and consistency

📊 **Better Table Management**
- Rename tables with validation
- View detailed table properties
- Visualize relationships with enhanced diagrams
- Copy DDL statements to clipboard

⚡ **UI/UX Improvements**
- Horizontal scrolling in tab management
- Dropdown selector for quick tab switching
- Better text handling in data grids
- Improved editor features with code folding

📋 **Comprehensive Documentation**
- Architecture guide for developers
- Features guide for users
- Getting started guide for new users
- User guide with tips and best practices

### Key Features Added Since v0.1.0

| Feature | Category | Impact |
|---------|----------|--------|
| Schema diagram viewing | Visualization | High |
| Connection rename/duplicate | Management | High |
| Create schema dialog | Management | High |
| Table rename dialog | Management | High |
| DDL copying | Clipboard | Medium |
| Tab dropdown selector | UI | Medium |
| Horizontal scrolling | Navigation | Medium |
| Code folding in editor | Editor | Low |
| Comprehensive docs | Documentation | High |

### Downloads & Installation

Visit the [GitHub Releases Page](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2) to download v0.1.2 for your platform:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` installer (Intel & Apple Silicon)
- **Linux**: `.AppImage` or `.deb` package

### System Requirements

- **RAM**: 512 MB minimum (2+ GB recommended)
- **Storage**: 100 MB free space
- **Display**: 1024×768 minimum (1920×1080 recommended)

**Supported Platforms**:
- Windows 10 and later
- macOS 10.13 and later
- Linux (Ubuntu 18.04+, Fedora 30+, others)

### Upgrade Path

If you're using v0.1.0, upgrading to v0.1.2 is straightforward:
1. Download the installer for your platform
2. Install over your existing installation
3. All your saved connections and settings will be preserved
4. No database schema changes required

### Bug Fixes & Improvements

- Fixed sidebar consistency issues after connection duplication
- Improved memory management for large schemas
- Enhanced error handling across clipboard operations
- Better layout algorithms for diagram positioning
- Improved state management in connection operations

### Known Issues

- Large schemas with 100+ tables may require more memory for diagram visualization
- Some advanced database-specific features require initial setup
- Plugin system is available for development but not yet exposed to end users

### What's Coming in v0.1.3

Planned features for the next release:
- [ ] User plugin installation and management
- [ ] Advanced query history and templates
- [ ] Database comparison tools
- [ ] Batch operations for data management
- [ ] Performance improvements for large datasets

### Feedback & Support

- **Report Issues**: [GitHub Issues](https://github.com/danielss-dev/dbfordevs/issues)
- **Documentation**: See [docs/README.md](./docs/README.md)
- **Questions**: Check the [User Guide](./docs/USER_GUIDE.md)

---

## Previous Releases

### v0.1.0 - Initial Release

**Release Date**: December 15, 2025

The inaugural release of dbfordevs - a lightweight, cross-platform database client for developers.

**Key Features**:
- Multi-database support (PostgreSQL, MySQL, SQLite)
- Monaco-based SQL editor with autocomplete
- High-performance data grid with virtualization
- Light/dark theme support
- Connection string validators for multiple languages
- Plugin architecture foundation
- Beautiful, modern UI

**Downloads**: [v0.1.0 Releases](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0)

**System Requirements**:
- RAM: 512 MB minimum
- Storage: 100 MB free
- Windows 10+, macOS 10.13+, Ubuntu 18.04+

---

## Version History

| Version | Release Date | Type | Downloads |
|---------|--------------|------|-----------|
| [v0.1.2](#latest-release-v012) | Dec 21, 2025 | Minor | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2) |
| [v0.1.0](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0) | Dec 15, 2025 | Initial | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0) |

---

## Update Guide

### Updating from v0.1.0 to v0.1.2

**No Breaking Changes** - Your existing setup will continue to work:

1. **Download** the latest installer from [GitHub Releases](https://github.com/danielss-dev/dbfordevs/releases)
2. **Install** following the platform-specific instructions
3. **Launch** dbfordevs and enjoy the new features
4. **Existing Connections** will automatically load - no reconfiguration needed

### Rollback

If you need to revert to v0.1.0:
1. Uninstall v0.1.2
2. Download v0.1.0 from [GitHub Releases](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0)
3. Install v0.1.0
4. All your connections and settings are preserved

---

## Getting Help

### New to dbfordevs?
Start with the [Getting Started Guide](./docs/GETTING_STARTED.md)

### Using dbfordevs?
Check the [User Guide](./docs/USER_GUIDE.md) for features, shortcuts, and tips

### Developing with dbfordevs?
See the [Architecture Guide](./docs/ARCHITECTURE.md) for technical details

### Found an Issue?
Report it on [GitHub Issues](https://github.com/danielss-dev/dbfordevs/issues) with:
- Clear description of the problem
- Steps to reproduce
- Your OS and dbfordevs version
- Error messages or screenshots

---

## Additional Resources

- **GitHub Repository**: [danielss-dev/dbfordevs](https://github.com/danielss-dev/dbfordevs)
- **Documentation**: [docs/README.md](./docs/README.md)
- **Issue Tracker**: [GitHub Issues](https://github.com/danielss-dev/dbfordevs/issues)
- **License**: MIT

---

**Last Updated**: December 21, 2025
