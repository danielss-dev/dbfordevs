# dbfordevs Documentation

A cross-platform database management application built with Tauri 2.0 and React 18, providing a unified interface for PostgreSQL, MySQL, SQLite, Oracle, MSSQL, MongoDB, Redis, Cassandra, and CockroachDB with AI-powered query assistance.

**Version**: 0.7.0
**License**: MIT
**Platforms**: macOS, Windows, Linux

---

## Table of Contents

- [Getting Started](#getting-started)
- [Using the Application](#using-the-application)
- [Database Connections](#database-connections)
- [Query Editor](#query-editor)
- [Data Grid](#data-grid)
- [AI Assistant](#ai-assistant)
- [Bookmarks & Templates](#bookmarks--templates)
- [Schema Diff & Data Comparison](#schema-diff--data-comparison)
- [Import & Export](#import--export)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Themes & Appearance](#themes--appearance)
- [Security & Privacy](#security--privacy)
- [Architecture Overview](#architecture-overview)
- [Known Concerns & Recommendations](#known-concerns--recommendations)

---

## Getting Started

### Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Rust** (stable) | Install via [rustup](https://rustup.rs/) |
| **Bun** | Package manager and runtime — [bun.sh](https://bun.sh/) |
| **Git** | Version control |
| **C compiler** | Required by some native Rust dependencies |

**Platform-specific requirements:**

- **macOS**: Xcode command line tools (`xcode-select --install`)
- **Windows**: Visual Studio Build Tools with MSVC C++ toolchain
- **Linux**: System libraries:
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### Installation

```bash
# Clone the repository
git clone https://github.com/danielss-dev/dbfordevs.git
cd dbfordevs

# Install frontend dependencies
bun install
```

### Running in Development

```bash
# Full app (Tauri backend + Vite frontend)
bun tauri dev

# Frontend only (for UI development without the Tauri backend)
bun dev
```

The development server starts on `http://localhost:1420`. Hot reload is enabled for frontend changes. Rust backend changes trigger an automatic recompile.

### Building for Production

```bash
# Build the frontend
bun run build

# Build the full application (platform-specific installer)
bun tauri build
```

Production artifacts are output to `src-tauri/target/release/bundle/` as platform-specific installers (`.dmg` on macOS, `.msi` on Windows, `.AppImage` on Linux).

### Running Tests

```bash
bun test          # Watch mode
bun test:run      # Single run
bun test:coverage # With coverage report
```

### Version Bumping

```bash
bun scripts/bump-version.ts patch   # 0.7.0 -> 0.7.1
bun scripts/bump-version.ts minor   # 0.7.0 -> 0.8.0
bun scripts/bump-version.ts major   # 0.7.0 -> 1.0.0
```

This updates `package.json`, `Cargo.toml`, `tauri.conf.json`, and `CHANGELOG.md`.

---

## Using the Application

### Interface Layout

The application has five main areas:

1. **Sidebar** (left) — Database connection tree with schemas, tables, views, procedures, functions, triggers, indexes, and sequences. Right-click items for context menus.
2. **Main Content** (center) — Query editor tabs and result grid. Each tab has its own editor and results.
3. **Side Panel** (right, toggleable) — Row editor for inline data editing, pending changes diff, field inspection, and the AI assistant.
4. **Right Activity Bar** (far right) — Icon buttons to toggle side panel tabs: Fields, Changes, Preview, Explain, AI, Schema Search.
5. **Status Bar** (bottom) — Query execution time, row count, connection status, and sync indicators.

---

## Database Connections

### Supported Databases

| Database | Driver | Connection Method |
|----------|--------|-------------------|
| PostgreSQL | sqlx (async) | Host/port, SSL/TLS, SSH tunnel |
| MySQL / MariaDB | sqlx (async) | Host/port, SSL/TLS, SSH tunnel |
| SQLite | sqlx (async) | Local file path |
| MSSQL / SQL Server | tiberius | Host/port (named instances supported), SSL |
| Oracle | oracle crate | Host/port, Oracle Wallet |
| MongoDB | mongodb driver | Connection string, SSL |
| Redis | redis crate | Host/port, SSL/TLS |
| Cassandra / ScyllaDB | scylla driver | Host/port, cluster connections |
| CockroachDB | sqlx (PostgreSQL wire) | Host/port, SSL/TLS |

### Creating a Connection

1. Click the **+** button in the sidebar or press `Mod+N`.
2. Select the database type.
3. Fill in connection details (host, port, database name, credentials).
4. Optionally configure:
   - **SSL/TLS**: Modes include disable, prefer, require, verify-ca, verify-full. Supports CA cert, client cert, and client key paths.
   - **SSH Tunnel**: Password or private key authentication. The app verifies host keys against `~/.ssh/known_hosts`.
   - **Oracle Wallet**: For Oracle databases using wallet-based authentication.
5. Click **Test Connection** to verify settings.
6. Click **Save** to store the connection.

### Connection String Support

You can paste a database connection string (e.g., `postgresql://user:pass@host:5432/dbname`) and the app will parse it into individual fields.

### Organizing Connections

- **Groups**: Create groups to organize connections by project, environment, etc.
- **Tags**: Apply custom tags for flexible categorization.
- **Filters**: Filter connections by group, tag, or search text in the sidebar.

---

## Query Editor

### Writing Queries

The editor is powered by Monaco (the same engine as VS Code) with:

- **SQL syntax highlighting** for all supported database dialects
- **Schema-aware autocomplete** — suggests table names, column names, views, procedures, and functions based on the active connection
- **SQL keyword completion** — all standard SQL keywords
- **Multi-tab support** — open multiple query tabs per connection

### Executing Queries

- Press `Mod+Enter` (Ctrl+Enter / Cmd+Enter) to execute the current query.
- Results appear in the data grid below the editor.
- Execution time and row count are shown in the status bar.

### SQL Formatting

Press `Shift+Alt+F` to format your SQL. Formatting options are configurable in Settings:

- Keyword case (UPPER, lower, Capitalize)
- Tab width and indent style
- Dense operators mode

### Query History

- Every executed query is saved to history per connection.
- Access history from the sidebar or query panel.
- Search, filter, and favorite queries.
- Auto-cleanup of old entries is configurable.
- Export history as JSON or CSV.

### Execution Plans (EXPLAIN)

Run EXPLAIN on your queries to see interactive tree-view execution plans with cost analysis. Access via the **Explain** tab in the right panel.

---

## Data Grid

### Viewing Results

Query results are displayed in a high-performance data grid (TanStack Table) with:

- **Sortable columns** — click column headers
- **Column filtering** — click filter icon on column headers
- **Pagination** — configurable page size
- **Column visibility** — show/hide columns
- **Column pinning** — freeze columns to the left
- **Type-aware rendering** — appropriate display for each data type with type icons
- **Null value display** — customizable null representation
- **Binary/blob preview** — preview binary data in a dialog

### Editing Data

- Click a cell to select it. Use the side panel for detailed field editing.
- The **Changes** tab shows a diff of all pending modifications.
- Supports insert, update, and delete operations.
- Changes are batched and applied together.

### Find & Replace

Press `Ctrl+H` to open the find & replace bar for searching across all columns in the result set.

### Conditional Formatting

Set up rules to highlight cells based on their values (e.g., highlight negative numbers in red).

### Column Statistics

Right-click a column header to view statistics: COUNT, NULL count, MIN, MAX, and more.

---

## AI Assistant

### Overview

The built-in AI assistant helps you write, explain, and optimize SQL queries. It is context-aware and understands your database schema.

### Supported AI Providers

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude (various models) |
| **OpenAI** | GPT models |
| **Google** | Gemini models |

### Setup

1. Open **Settings** > **AI** (or click the AI icon in the right activity bar).
2. Select your preferred provider.
3. Enter your API key for the selected provider.
4. Optionally configure: model, temperature, max tokens.

### Using the AI

- Open the **AI** tab in the right panel.
- Type your question or use slash commands:

| Command | Description |
|---------|-------------|
| `/select` | Generate SELECT queries |
| `/insert` | Generate INSERT statements |
| `/update` | Generate UPDATE statements |
| `/delete` | Generate DELETE statements |
| `/join` | Generate JOIN queries |
| `/create` | Generate CREATE TABLE statements |
| `/describe` | Describe table structures |
| `/mongodb` | MongoDB-specific commands |
| `/redis` | Redis-specific commands |

### Table References

Use `@table_name` or `@schema.table_name` in your messages to automatically include the table's schema as context. The AI will use this to generate accurate queries.

### Context Management

The AI Context Panel lets you configure what database information is sent to the AI provider. You can manually add or remove tables and queries from the context.

### Token Usage & Cost

The AI panel shows token usage and estimated cost per message and per session.

### Chat History

- Sessions are stored locally (up to 20 sessions, 20 messages each).
- Browse previous sessions in the Chat History panel.
- Export conversations via the Chat Export dialog.

---

## Bookmarks & Templates

### Saving Bookmarks

1. Write a query in the editor.
2. Press `Mod+Shift+B` or click the bookmark icon.
3. Name the bookmark, assign a folder, and optionally mark as favorite.

### Template Variables

Bookmarks support template variables using `@variable` syntax. When executing a bookmarked query with variables, a dialog prompts for values.

### Built-in Templates

Pre-made templates are available for common operations like connection status, table statistics, user/role queries, and performance analysis.

### Import & Export

Export all bookmarks as JSON for backup. Import from file with merge or replace options.

---

## Schema Diff & Data Comparison

### Schema Diff

Compare database schemas between:
- Two different connections
- Specific tables
- Saved snapshots (point-in-time comparisons)

The diff viewer shows structural differences and can generate migration SQL scripts.

### Data Comparison

Compare row-level data between queries or tables with visual highlighting of differences.

---

## Import & Export

### Data Import

Supports CSV, JSON, and SQL INSERT file formats with a multi-step wizard:

1. **Upload** — Select file (format auto-detected)
2. **Column Mapping** — Auto-detection with manual override
3. **Options** — Duplicate handling (skip, update, insert), batch size
4. **Progress** — Real-time progress with cancellation support
5. **Summary** — Import completion report

### Data Export

Export query results as:
- **CSV** — with configurable delimiters
- **JSON** — prettified format
- **SQL INSERT** — ready-to-execute statements
- **Clipboard** — copy formatted data

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Mod+K` | Open Command Palette |
| `Mod+N` | New connection |
| `Mod+T` | New query tab |
| `Mod+Enter` | Execute query |
| `Shift+Alt+F` | Format SQL |
| `Mod+Shift+B` | Bookmark manager |
| `Ctrl+H` | Find & replace in results |
| `Mod+Z` | Undo change |
| `F1` | Help |
| `F11` | Toggle fullscreen |

### Customization

All keyboard shortcuts can be customized in **Settings** > **Keybindings**.

### Command Palette

Press `Mod+K` to open the command palette. Search for any command by name, see its keybinding, and execute it.

---

## Themes & Appearance

### Built-in Themes

| Theme | Type |
|-------|------|
| Light | Light |
| Dark | Dark |
| System | Auto (follows OS) |
| Classic Light | Light |
| Classic Dark | Dark |
| Nordic Dark | Dark |
| Nordic Light | Light |
| Solarized Dark | Dark |
| Solarized Light | Light |
| One Dark | Dark |
| High Contrast | Dark |

### Custom Themes

Custom themes are supported via CSS custom properties. The theme system uses HSL-based color variables.

### Editor Appearance

Configurable in **Settings** > **Editor**:

- Font family (default: JetBrains Mono)
- Font size (default: 14px)
- Tab size
- Line numbers
- Word wrap
- Show invisibles

---

## Security & Privacy

### How Credentials Are Stored

#### Database Credentials (Backend — Rust)

Database connection credentials are stored as **plain-text JSON** in the user's application data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/dbfordevs/connections.json` |
| Linux | `~/.local/share/dbfordevs/connections.json` |
| Windows | `%APPDATA%\dbfordevs\connections.json` |

**What is stored in plain text:**
- Database passwords
- SSH tunnel passwords
- SSH private key passphrases
- Oracle Wallet configuration paths
- SSL certificate file paths
- Hostnames, usernames, ports, and database names

**There is no encryption** applied to the stored credentials file. Any user or process with file system access to the application data directory can read all saved passwords.

#### AI API Keys (Frontend — localStorage)

AI provider API keys (Anthropic, OpenAI, Google Gemini) are stored in the browser's `localStorage` under the key `dbfordevs-ai-assistant`. This means:

- API keys are visible in the Tauri webview's developer tools (Application > LocalStorage)
- Keys persist across app sessions
- Keys remain in localStorage even after the app is closed
- Keys are accessible to any code running in the webview context

### Connection Security (In Transit)

#### SSL/TLS

The app has strong support for encrypted connections:

- **PostgreSQL**: Full sslmode support (disable, prefer, require, verify-ca, verify-full) with CA cert, client cert, and client key
- **MySQL**: Full sslmode support (DISABLED, PREFERRED, REQUIRED, VERIFY_CA, VERIFY_IDENTITY) with certificate support
- **MSSQL**: Encrypt flag with TrustServerCertificate option
- **Redis**: TLS via rustls
- **MongoDB**: Native SSL/TLS support
- **CockroachDB**: PostgreSQL-compatible SSL

All TLS implementations use **rustls** (a pure-Rust TLS library) rather than OpenSSL, reducing the attack surface.

#### SSH Tunneling

- Supports password and private key authentication
- **Host key verification** against `~/.ssh/known_hosts` — rejects unknown hosts and warns about changed keys (MITM protection)
- Tunnels bind to `127.0.0.1` on a random local port

### AI Data Handling

#### What Data Is Sent to AI Providers

When you use the AI assistant, the following data may be sent to the selected AI provider's API:

- Your chat messages and prompts
- Table schemas for any `@referenced` tables (column names, types, constraints)
- The database type and dialect
- Any manually added context (queries, table structures)

#### What Data Is NOT Sent

- Database passwords or connection credentials
- Actual row data from your tables (unless you paste it into the chat)
- Your API keys are sent only as HTTP Authorization headers to the respective provider's API endpoint

#### Where AI Data Is Stored Locally

- Chat history: `localStorage` (up to 20 sessions, 20 messages each)
- AI settings and API keys: `localStorage`
- Token usage statistics: `localStorage`

All AI API calls are made over HTTPS directly from the app to the provider's endpoint using Tauri's HTTP plugin.

### Application Security Configuration

#### Content Security Policy

The app currently has **no Content Security Policy (CSP)** configured (`"csp": null` in `tauri.conf.json`). This means:

- The webview does not restrict script sources
- React's built-in XSS protections (JSX escaping) are the primary defense against injection

#### macOS Sandbox

The macOS app sandbox is **disabled** (`com.apple.security.app-sandbox: false` in `entitlements.plist`). The app has:

- Full file system access
- Unrestricted network access
- Hardened runtime enabled

#### Code Signing

- macOS: Uses ad-hoc signing by default (`signingIdentity: "-"`); release builds use a proper Apple Developer certificate
- Auto-updater: Signed with a Tauri signing key; the public key is embedded in `tauri.conf.json`

### Connection Pool Management

- Connection pools are held in memory using a `RwLock<ConnectionManager>` in the Rust backend
- Connection strings (which embed credentials) remain in memory while pools are active
- No secure memory erasure (zeroize) is performed when connections are closed
- Pool limits: PostgreSQL/MySQL allow up to 20 concurrent connections; SQLite allows 5

### SQL Injection Protection

Database queries executed through the application use the respective driver's parameterized query support (sqlx, tiberius, oracle, mongodb, redis, scylla), which prevents SQL injection at the driver level.

---

## Architecture Overview

### Frontend (React 18 + TypeScript)

```
src/
  App.tsx              # Application shell
  stores/              # Zustand state management (connections, UI, queries, CRUD, etc.)
  components/
    layout/            # Sidebar, MainContent, SidePanel, StatusBar
    connections/       # Connection modal, organization, SSL/SSH dialogs
    editor/            # Monaco SQL editor, autocomplete provider
    data-grid/         # Result grid, cell editing, import/export
    ai/                # AI panel, settings, chat history
    bookmarks/         # Bookmark manager, templates
    diff/              # Schema diff viewer
    settings/          # Settings dialog (editor, themes, keybindings)
    command-palette/   # Command palette (Mod+K)
    ui/                # Radix UI primitives (buttons, dialogs, menus)
  hooks/
    useDatabase.ts     # Central hook wrapping all Tauri invoke() calls
    useKeyboardShortcuts.ts
  lib/
    ai/                # AI SDK integration (providers, context, validation)
    commands/          # Command registry and default commands
```

### Backend (Rust + Tauri 2.0)

```
src-tauri/
  src/
    lib.rs             # Tauri entry point, command registration
    commands/          # Tauri IPC handlers (connections, queries, tables, etc.)
    db/
      manager.rs       # Connection pool management
      postgres.rs      # PostgreSQL driver
      mysql.rs         # MySQL/MariaDB driver
      sqlite.rs        # SQLite driver
      mssql.rs         # MSSQL/SQL Server driver
      oracle.rs        # Oracle driver
      mongodb.rs       # MongoDB driver
      redis.rs         # Redis driver
      cassandra.rs     # Cassandra/ScyllaDB driver
    ssh/
      tunnel.rs        # SSH tunnel implementation
    storage/
      mod.rs           # Credential storage (JSON file)
  tauri.conf.json      # App configuration
  Cargo.toml           # Rust dependencies
```

### Data Flow

```
User Action (React)
  -> Zustand Store (state update)
  -> useDatabase hook
  -> Tauri invoke() IPC
  -> Rust Command Handler
  -> Database Driver (sqlx / tiberius / oracle / etc.)
  -> Database Server
  -> Response flows back through the same path
```

### State Persistence

| Store | Storage | What's Persisted |
|-------|---------|-----------------|
| Connections | localStorage + backend JSON file | Connection configs, groups, tags |
| UI | localStorage | Theme, sidebar width, editor settings |
| Query | localStorage | Open tabs, history, active tab |
| Bookmarks | localStorage | All bookmarks, folders, favorites |
| AI | localStorage | API keys, chat history, settings |
| Grid | localStorage | Column visibility, formatting rules |

---

## Known Concerns & Recommendations

### Critical

| Concern | Description | Recommendation |
|---------|-------------|----------------|
| **Plain-text credential storage** | Database passwords, SSH passwords, and SSH key passphrases are stored unencrypted in a JSON file on disk. | Use the OS credential store (macOS Keychain, Windows DPAPI, Linux Secret Service) to encrypt sensitive credentials at rest. |
| **API keys in localStorage** | AI provider API keys are stored in browser localStorage with no encryption. | Move API key storage to the Rust backend using the OS keychain or an encrypted storage mechanism. |

### High

| Concern | Description | Recommendation |
|---------|-------------|----------------|
| **No Content Security Policy** | CSP is set to `null`, leaving the webview without script source restrictions. | Configure a restrictive CSP (e.g., `default-src 'self'`) in `tauri.conf.json`. |
| **macOS sandbox disabled** | The app runs without sandboxing, granting full file system and network access. | Enable the app sandbox in `entitlements.plist` and use fine-grained entitlements. |

### Medium

| Concern | Description | Recommendation |
|---------|-------------|----------------|
| **No secure memory erasure** | Connection strings containing passwords remain in memory after pool disposal. | Use the `zeroize` Rust crate to clear sensitive strings after use. |
| **Connection strings embed passwords** | Credentials are embedded in connection URL strings (e.g., `postgresql://user:pass@host/db`). | Build connections using driver-specific parameter APIs rather than URL embedding where possible. |
| **AI context sends schema data externally** | Table schemas (column names, types, constraints) are sent to third-party AI APIs. | Clearly communicate to users what data is shared. Consider a local/self-hosted AI option. |

### Positive Security Features

- SSH host key verification against `~/.ssh/known_hosts` (MITM protection)
- Full SSL/TLS support with certificate verification for all database types
- rustls used instead of OpenSSL (smaller attack surface)
- Parameterized queries via all database drivers (SQL injection protection)
- React's built-in XSS protection via JSX escaping
- Auto-updater with cryptographic signature verification
- Hardened runtime enabled on macOS
- SSH private keys are loaded from disk on demand, not stored in the connection config
