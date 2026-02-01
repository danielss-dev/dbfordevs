# dbfordevs Documentation

Welcome to **dbfordevs**, a lightweight, cross-platform database management application designed for developers. This documentation provides everything you need to get started and make the most of the application.

## What is dbfordevs?

dbfordevs is a modern database client that allows developers to connect to multiple database systems from a single, intuitive interface. Built with Tauri and React, it combines the power of a desktop application with the flexibility and speed of modern web technologies.

**Key Highlights:**
- 🚀 **Lightweight**: Minimal resource usage compared to traditional database clients
- 🔗 **Multi-Database Support**: Connect to PostgreSQL, MySQL, SQLite, SQL Server, Oracle, MongoDB, Redis, and more
- 💻 **Cross-Platform**: Works seamlessly on Windows, macOS, and Linux
- ⚡ **Developer-Focused**: Optimized for developers with modern UI/UX patterns
- 🎨 **Customizable**: Multiple themes and appearance modes

## Documentation Structure

### [Getting Started](./GETTING_STARTED.md)
Learn how to install dbfordevs, create your first connection, and execute your first query.

### [Features Guide](./FEATURES.md)
Comprehensive guide to all features including:
- Connection Management
- Query Editor
- Data Grid & Editing
- Schema Visualization
- Data Change Management
- Settings & Customization

### [User Guide](./USER_GUIDE.md)
In-depth documentation on using the application, including:
- Detailed feature explanations
- Keyboard shortcuts
- Tips and best practices
- Troubleshooting

### [Keyboard Shortcuts](./KEYBOARD_SHORTCUTS.md)
Complete reference for all keyboard shortcuts:
- General navigation
- SQL editor shortcuts
- Data grid operations
- Quick reference card

### [SSL/TLS Testing](./ssl-tls-testing.md)
Guide to testing secure database connections, including:
- SSL mode configuration
- Certificate setup
- Docker test environment
- Troubleshooting SSL issues

### [Graphite Workflow](./GRAPHITE.md)
Guide for developers on using Graphite for stacked pull requests in this project.

## Quick Links

- **GitHub**: Source code and issue tracking

## Supported Databases

dbfordevs supports a wide range of database systems:

| Database | Status | Notes |
|----------|--------|-------|
| PostgreSQL | ✅ Fully Supported | Including connection pooling |
| MySQL | ✅ Fully Supported | MySQL 5.7+ and 8.0+ |
| MariaDB | ✅ Fully Supported | Compatible with MySQL drivers |
| SQLite | ✅ Fully Supported | File-based databases |
| Microsoft SQL Server | ✅ Fully Supported | 2012+ |
| Oracle | ✅ Supported | Enterprise databases |
| MongoDB | ✅ Supported | Document databases |
| Redis | ✅ Supported | In-memory data structures |
| CockroachDB | ✅ Supported | Distributed databases |
| Cassandra | ✅ Fully Supported | NoSQL databases |

## Getting Help

### Common Tasks

**Connecting to a Database**
1. Click "New Connection" in the connections panel
2. Select your database type
3. Enter connection details
4. Test the connection
5. Save and connect

**Executing a Query**
1. Open the query editor
2. Write your SQL query
3. Press `Ctrl+Enter` (or `Cmd+Enter` on macOS)
4. View results in the data grid

**Editing Data**
1. Right-click a row or click the edit icon
2. Modify values in the side panel
3. Review changes in the diff view
4. Commit or discard changes

**Viewing Schema**
1. Select a table in the sidebar
2. Click "Properties" to see columns and constraints
3. Click "Diagram" to visualize relationships

## System Requirements

### Minimum Requirements
- **RAM**: 512 MB
- **Disk**: 100 MB free space
- **Display**: 1024x768 resolution

### Recommended Requirements
- **RAM**: 2+ GB
- **Disk**: 500 MB free space
- **Display**: 1920x1080 resolution
- **OS**: Recent versions of Windows, macOS, or Linux

## Platform Support

- **Windows**: 10 and later
- **macOS**: 10.13 and later
- **Linux**: Ubuntu 18.04+, Fedora 30+, and other modern distributions

## Tips & Best Practices

1. **Connection Strings**: Paste connection strings in the New Connection dialog to auto-fill fields
2. **Keyboard Shortcuts**: Learn keyboard shortcuts to work faster (see Features Guide)
3. **Multiple Connections**: Keep multiple database connections open simultaneously
4. **Data Review**: Always review changes in the diff view before committing
5. **Query History**: Use query tabs to organize your work

## Features at a Glance

| Feature | Description |
|---------|-------------|
| **Connection Management** | Save, test, and manage multiple database connections with groups and tags |
| **SQL Editor** | Monaco-based editor with syntax highlighting, code completion, and formatting |
| **Data Grid** | High-performance grid with sorting, pagination, filtering, and global search |
| **Schema Tools** | View table properties, relationships, and DDL |
| **Schema Diff** | Compare schemas between databases to identify differences |
| **Visual Diagrams** | See table relationships at a glance |
| **Data Editing** | Insert, update, and delete records with validation |
| **Diff View** | Review all pending changes before committing |
| **Query Bookmarks** | Save and organize frequently used queries |
| **AI Assistant** | Generate, explain, and optimize SQL with AI (Claude, GPT, Gemini) |
| **Themes** | Light, Dark, Nordic, Solarized, and System themes |

## Keyboard Shortcuts

- **`Ctrl/Cmd + Enter`**: Execute query
- **`Ctrl/Cmd + K`**: Create new connection
- **`Ctrl/Cmd + T`**: Open new query tab
- **`Ctrl/Cmd + ,`**: Open settings
- **`Alt + ↑/↓`**: Navigate between query results

See [Features Guide](./FEATURES.md) for complete list of shortcuts.

## Feedback & Support

If you encounter issues or have suggestions:

1. Check the troubleshooting section in [User Guide](./USER_GUIDE.md)
2. Review existing issues on GitHub
3. Report new issues with detailed steps to reproduce
4. Include your database system and dbfordevs version

## License

dbfordevs is available under an open-source license.

---

**Need more help?** Start with the [Getting Started](./GETTING_STARTED.md) guide for a step-by-step introduction to the application.
