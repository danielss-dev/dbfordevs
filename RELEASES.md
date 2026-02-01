# dbfordevs Release Notes

Quick reference for dbfordevs releases. For detailed changes, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v0.5.3

**Release Date**: January 27, 2026

### What's New in v0.5.x

The v0.5.x series delivers major advances in schema tooling, NoSQL support, and database management capabilities.

#### Highlights

**Schema Diff & Migration** (v0.5.0)
- Compare schemas across connections, tables, or point-in-time snapshots
- Visual diff with color-coded changes (added/removed/modified)
- Database-specific migration SQL generation for PostgreSQL, MySQL, SQLite, Oracle, MSSQL
- Destructive operation warnings and selective migration export

**Cassandra Support** (v0.4.0+)
- Full driver implementation using `scylla` crate
- Keyspace and table management with CQL Shell
- Server info dashboard with cluster and node details
- Consistency level configuration

**MSSQL Enhancements** (v0.5.2-v0.5.3)
- SQL Server Browser query for named instance port resolution
- Database create and delete functionality

**Additional v0.5.x Features**
- Global schema search with fuzzy matching (Ctrl+Shift+F)
- Enhanced sidebar with Cassandra browser integration
- Classic themes and updated Monaco editor themes

### Downloads & Installation

Visit the [GitHub Releases Page](https://github.com/danielss-dev/dbfordevs/releases) to download the latest version for your platform:
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
- Connection string parsing for multiple formats
- Beautiful, modern UI

**Downloads**: [v0.1.0 Releases](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0)

**System Requirements**:
- RAM: 512 MB minimum
- Storage: 100 MB free
- Windows 10+, macOS 10.13+, Ubuntu 18.04+

---

## Version History

| Version | Release Date | Highlights | Downloads |
|---------|--------------|------------|-----------|
| [v0.5.3](#latest-release-v053) | Jan 27, 2026 | MSSQL create/delete database | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.5.3) |
| v0.5.2 | Jan 26, 2026 | MSSQL named instance port resolution | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.5.2) |
| v0.5.1 | Jan 24, 2026 | Classic themes, Monaco editor updates | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.5.1) |
| v0.5.0 | Jan 24, 2026 | Schema Diff, Cassandra search integration | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.5.0) |
| v0.4.0 | Jan 20, 2026 | Oracle Wallet, SSL/TLS testing, Cassandra | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.4.0) |
| v0.3.x | Jan 12-19, 2026 | MongoDB, Redis, views, indexes, users, data grid | [GitHub](https://github.com/danielss-dev/dbfordevs/releases) |
| v0.2.1 | Dec 26, 2025 | OpenAI integration, PostgreSQL enhancements | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.2.1) |
| v0.2.0 | Dec 25, 2025 | AI Query Assistant | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.2.0) |
| v0.1.2 | Dec 21, 2025 | Schema diagrams, table properties | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.2) |
| v0.1.0 | Dec 15, 2025 | Initial release | [GitHub](https://github.com/danielss-dev/dbfordevs/releases/tag/v0.1.0) |

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

**Last Updated**: February 1, 2026
