# dbfordevs Release Notes

Quick reference for dbfordevs releases. For detailed changes, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v0.2.1

**Release Date**: December 26, 2025

### What's New

This release enhances AI Query Assistant with OpenAI integration, visual query optimization, and significantly improves PostgreSQL query handling and multi-statement support.

#### Highlights

🧠 **OpenAI Provider Integration**
- Support for **OpenAI GPT** models (GPT-5.2, GPT-5 Mini, GPT-5.2 Pro)
- Third major AI provider alongside Anthropic Claude and Google Gemini
- Provider switcher in settings with model selection
- Unified API key management across all providers

📊 **Query Optimization Diff View**
- Visual comparison of original and optimized SQL queries
- Color-coded diff showing additions (green), removals (red), and changes
- Change summary highlighting specific performance improvements
- One-click Apply or Copy functionality for quick integration
- Side-by-side comparison view for detailed analysis

⚡ **Enhanced PostgreSQL Support**
- **Comprehensive Type Handling**: Support for all PostgreSQL data types including:
  - Binary data (BYTEA) with Base64 encoding
  - Arrays, Intervals, Money types
  - Network types (IP addresses, MAC addresses)
  - All date/time representations (chrono and time crate)
  - JSON/JSONB native support
  - Bit vectors and custom composite types
- **Multi-Statement Execution**: Execute multiple SQL statements in a single query:
  - Intelligent SQL splitting with quote and comment handling
  - Transaction-based execution for atomicity
  - Proper error handling with automatic rollback on failure
- **Expanded SQLx Features**: Added support for additional database types

🎯 **Improved AI Context**
- Current query from editor now included in AI context
- Better understanding of user intent when asking about "this query"
- Support for query variants (multiple approaches in single response)
- Enhanced error handling with clearer streaming message updates

### Key Features Added Since v0.2.0

| Feature | Category | Impact |
|---------|----------|--------|
| OpenAI Provider Support | AI | High |
| Query Optimization Diff | AI | High |
| PostgreSQL Multi-Statement | Database | High |
| Comprehensive Type Handling | Database | Medium |
| Enhanced AI Context | AI | Medium |

### Downloads & Installation

Visit the [GitHub Releases Page](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.2.1) to download v0.2.1 for your platform:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` installer (Intel & Apple Silicon)
- **Linux**: `.AppImage` or `.deb` package

### System Requirements

- **RAM**: 512 MB minimum (4+ GB recommended for AI features)
- **Storage**: 150 MB free space
- **Network**: Internet connection required for AI features

---

## Previous Releases

### v0.2.0

**Release Date**: December 25, 2025

This release introduces the **AI Query Assistant**, transforming dbfordevs into an intelligent database development partner. Generate SQL, explain queries, and get database-specific advice using industry-leading AI models.

#### Highlights

🤖 **AI-Powered Query Assistant**
- Generate SQL from natural language descriptions
- Explain complex queries step-by-step
- Optimize existing SQL with AI-driven suggestions
- Context-aware generation using your database schema

🌐 **Multi-Provider AI Support**
- Support for **Anthropic Claude** (Opus, Sonnet, Haiku)
- Support for **Google Gemini** (Pro, Flash)
- Bypasses CORS restrictions via Tauri HTTP proxy
- Secure API key management

💬 **Persistent Chat History**
- Save and organize AI conversations locally
- Chat history persistence across sessions
- Session favorites and quick renaming
- Auto-cleanup settings for history management

🎯 **Intelligent Context**
- Automatic schema context enrichment
- `@` mentions for tables and columns in prompts
- Database-specific query generation (PG, MySQL, etc.)

### v0.1.2

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
| [v0.2.1](#latest-release-v021) | Dec 26, 2025 | Minor | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.2.1) |
| [v0.2.0](#previous-releases-v020) | Dec 25, 2025 | Minor | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.2.0) |
| [v0.1.2](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2) | Dec 21, 2025 | Minor | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2) |
| [v0.1.0](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0) | Dec 15, 2025 | Initial | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0) |

---

## Update Guide

### Updating to v0.2.0

**No Breaking Changes** - Your existing setup will continue to work:

1. **Download** the latest installer from [GitHub Releases](https://github.com/danielss-dev/dbfordevs/releases)
2. **Install** following the platform-specific instructions
3. **Launch** dbfordevs and configure your AI API key in Settings if you wish to use the new Assistant features.

### Updating from v0.1.0 to v0.1.2

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

**Last Updated**: December 25, 2025
