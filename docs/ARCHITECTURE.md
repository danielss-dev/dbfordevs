# dbfordevs Architecture Guide

Technical documentation for developers wanting to understand or contribute to dbfordevs.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Abstraction Layer](#database-abstraction-layer)
7. [Plugin System](#plugin-system)
8. [State Management](#state-management)
9. [Communication Protocol](#communication-protocol)
10. [Key Design Decisions](#key-design-decisions)

## Overview

dbfordevs is built using a **Tauri-based desktop application** architecture that combines:

- **Frontend**: Modern React with TypeScript
- **Backend**: Rust async runtime
- **Desktop Framework**: Tauri 2.x for native desktop features
- **IPC**: Type-safe command-based communication between frontend and backend

```
┌─────────────────────────────────────────────────────────┐
│                  UI Layer (React/TypeScript)            │
│  Components ↔ Zustand Store ↔ Hooks                    │
└────────────────────────┬────────────────────────────────┘
                         │ Tauri IPC Commands
┌────────────────────────▼────────────────────────────────┐
│                 Backend Layer (Rust)                    │
│  Command Handlers ↔ Business Logic ↔ DB Drivers        │
└────────────────────────┬────────────────────────────────┘
                         │ Database Protocols
┌────────────────────────▼────────────────────────────────┐
│           Multiple Database Systems                     │
│  PostgreSQL │ MySQL │ SQLite │ MSSQL │ ...             │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **UI Framework** | React | 18.3+ | Component-based UI |
| **Language** | TypeScript | 5.6+ | Type safety |
| **Build Tool** | Vite | 6.0+ | Fast development and bundling |
| **Styling** | TailwindCSS | 3.4+ | Utility-first CSS |
| **Components** | shadcn/ui (Radix) | Latest | Accessible UI components |
| **State** | Zustand | Latest | Lightweight state management |
| **Tables** | TanStack React Table | Latest | High-performance data grids |
| **Editor** | Monaco Editor | Latest | SQL editor with intellisense |
| **Icons** | Lucide React | Latest | Icon library |
| **HTTP** | Fetch API | Native | Network requests |

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Language** | Rust | 2021 Edition | Systems programming, safety |
| **Async Runtime** | Tokio | Latest | Non-blocking operations |
| **Framework** | Tauri | 2.x | Desktop app framework |
| **Database Access** | SQLx | Latest | Type-safe SQL queries |
| **Connection Pool** | sqlx::Pool | Built-in | Connection management |
| **Serialization** | Serde | Latest | Type-safe serialization |
| **UUID** | uuid | Latest | Unique identifiers |
| **Clipboard** | Arboard | Latest | Clipboard access |

### Plugin System

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Core Traits** | Rust traits | Plugin interface definitions |
| **Validators** | Rust crates | Connection string validation |
| **Themes** | JSON + CSS | Theme definitions |
| **Exporters** | Rust crates | Data export functionality |

## Project Structure

```
dbfordevs/
├── src/                              # Frontend (React/TypeScript)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Connection and db tree
│   │   │   ├── MainContent.tsx      # Query editor and results
│   │   │   └── SidePanel.tsx        # Data editing panel
│   │   ├── data-grid/
│   │   │   ├── DataGrid.tsx         # High-perf table component
│   │   │   ├── GridCell.tsx         # Individual cell renderer
│   │   │   └── Pagination.tsx       # Page navigation
│   │   ├── editor/
│   │   │   ├── QueryEditor.tsx      # Monaco SQL editor
│   │   │   ├── EditorToolbar.tsx    # Execute and options
│   │   │   └── QueryTab.tsx         # Tab management
│   │   ├── connections/
│   │   │   ├── ConnectionModal.tsx  # Create/edit connection
│   │   │   ├── ConnectionTree.tsx   # Database explorer tree
│   │   │   └── ConnectionStatus.tsx # Connection indicator
│   │   ├── table/
│   │   │   ├── TableProperties.tsx  # Column info viewer
│   │   │   ├── TableDiagram.tsx     # Relationship visualizer
│   │   │   └── DDLViewer.tsx        # Show CREATE TABLE
│   │   ├── database/
│   │   │   ├── CreateTableDialog.tsx
│   │   │   └── CreateSchemaDialog.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPanel.tsx    # Settings UI
│   │   │   ├── ThemeSettings.tsx    # Theme customization
│   │   │   └── KeyboardSettings.tsx # Shortcut editor
│   │   ├── marketplace/
│   │   │   └── PluginMarketplace.tsx # Plugin browser/installer
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Dialog.tsx
│   │       ├── Input.tsx
│   │       └── ... (shadcn/ui components)
│   ├── stores/
│   │   ├── connections.ts           # Connection state (Zustand)
│   │   ├── query.ts                 # Query/results state
│   │   ├── ui.ts                    # UI state (theme, panels, etc)
│   │   └── settings.ts              # User preferences
│   ├── hooks/
│   │   ├── useConnections.ts        # Connection management hook
│   │   ├── useQuery.ts              # Query execution hook
│   │   └── useWindowSize.ts         # Responsive design hook
│   ├── lib/
│   │   ├── database.ts              # Frontend DB abstraction
│   │   ├── connection.ts            # Connection utilities
│   │   └── validators.ts            # Input validation
│   ├── types/
│   │   ├── connection.ts            # Connection types
│   │   ├── query.ts                 # Query result types
│   │   ├── database.ts              # Database schema types
│   │   └── index.ts                 # Type exports
│   ├── App.tsx                      # Root component
│   └── main.tsx                     # Entry point
│
├── src-tauri/                       # Backend (Rust)
│   ├── src/
│   │   ├── main.rs                  # Tauri setup
│   │   ├── lib.rs                   # Module exports
│   │   ├── commands/
│   │   │   ├── mod.rs               # Commands module
│   │   │   ├── connections.rs       # Connection CRUD commands
│   │   │   │   - create_connection
│   │   │   │   - get_connections
│   │   │   │   - update_connection
│   │   │   │   - delete_connection
│   │   │   ├── queries.rs           # Query execution commands
│   │   │   │   - execute_query
│   │   │   │   - fetch_results
│   │   │   │   - cancel_query
│   │   │   ├── tables.rs            # Table operations
│   │   │   │   - get_tables
│   │   │   │   - get_table_info
│   │   │   │   - get_columns
│   │   │   ├── validators.rs        # Validation commands
│   │   │   │   - validate_connection_string
│   │   │   ├── database.rs          # Database operations
│   │   │   │   - create_table
│   │   │   │   - create_schema
│   │   │   └── utils.rs             # Utility commands
│   │   ├── db/
│   │   │   ├── mod.rs               # DB module
│   │   │   ├── manager.rs           # Connection pool manager
│   │   │   │   - Maintains active connections
│   │   │   │   - Handles connection lifecycle
│   │   │   ├── postgres.rs          # PostgreSQL driver
│   │   │   ├── mysql.rs             # MySQL/MariaDB driver
│   │   │   ├── sqlite.rs            # SQLite driver
│   │   │   ├── mssql.rs             # SQL Server driver
│   │   │   ├── mongodb.rs           # MongoDB driver
│   │   │   └── connection.rs        # Connection trait abstraction
│   │   ├── models/
│   │   │   ├── connection.rs        # Connection types
│   │   │   ├── query.rs             # Query/result types
│   │   │   ├── column.rs            # Column metadata
│   │   │   ├── table.rs             # Table metadata
│   │   │   └── error.rs             # Error types
│   │   ├── error.rs                 # Error handling
│   │   ├── storage/
│   │   │   └── local.rs             # Persistent storage
│   │   └── utils/
│   │       ├── clipboard.rs         # Clipboard operations
│   │       └── converters.rs        # Type conversions
│   └── tauri.conf.json             # Tauri configuration
│
├── crates/                          # Rust workspace crates
│   ├── plugin-core/
│   │   ├── src/
│   │   │   ├── lib.rs               # Plugin trait definitions
│   │   │   ├── metadata.rs          # Plugin metadata
│   │   │   └── types.rs             # Shared plugin types
│   │   └── Cargo.toml
│   ├── validator-core/
│   │   ├── src/
│   │   │   └── lib.rs               # Validator trait
│   │   └── Cargo.toml
│   ├── validator-csharp/
│   │   ├── src/
│   │   │   └── lib.rs               # C# connection string parser
│   │   └── Cargo.toml
│   ├── validator-nodejs/
│   │   ├── src/
│   │   │   └── lib.rs               # Node.js connection string parser
│   │   └── Cargo.toml
│   └── validator-python/
│       ├── src/
│       │   └── lib.rs               # Python connection string parser
│       └── Cargo.toml
│
├── docs/                            # Documentation
│   ├── README.md                    # Overview
│   ├── GETTING_STARTED.md          # User guide
│   ├── FEATURES.md                 # Feature documentation
│   ├── USER_GUIDE.md               # Detailed usage guide
│   ├── ARCHITECTURE.md             # This file
│   └── images/                     # Documentation images
│
├── public/                          # Static assets
│   ├── icon.png                    # Application icon
│   └── favicon.ico
│
├── package.json                     # Frontend dependencies
├── tsconfig.json                    # TypeScript config
├── tailwind.config.js              # TailwindCSS config
├── vite.config.ts                  # Vite config
├── Cargo.toml                       # Rust workspace
└── .gitignore

```

## Frontend Architecture

### Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── ConnectionList
│   │   └── DatabaseTree
│   ├── MainContent
│   │   ├── QueryEditor
│   │   │   ├── EditorToolbar
│   │   │   └── QueryTabs
│   │   └── Results
│   │       ├── DataGrid
│   │       └── Pagination
│   └── SidePanel (conditional)
│       └── RowEditor
├── Settings (modal)
├── ConnectionModal (modal)
└── DiffView (modal)
```

### State Management with Zustand

**File: `src/stores/connections.ts`**

```typescript
type ConnectionStore = {
  connections: Connection[]
  activeConnection: Connection | null

  // Actions
  addConnection: (conn: Connection) => void
  removeConnection: (id: string) => void
  updateConnection: (id: string, updated: Connection) => void
  setActiveConnection: (id: string) => void
}
```

**File: `src/stores/query.ts`**

```typescript
type QueryStore = {
  queryTabs: QueryTab[]
  activeTab: string
  results: QueryResult | null
  isLoading: boolean
  pendingChanges: DataChange[]

  // Actions
  addTab: (tab: QueryTab) => void
  removeTab: (id: string) => void
  updateTabQuery: (id: string, query: string) => void
  setResults: (results: QueryResult) => void
  addChange: (change: DataChange) => void
  clearPendingChanges: () => void
}
```

**File: `src/stores/ui.ts`**

```typescript
type UIStore = {
  theme: 'light' | 'dark' | 'system'
  sidebarOpen: boolean
  sidePanelOpen: boolean
  diffViewOpen: boolean
  currentModal: ModalType | null

  // Actions
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  toggleSidePanel: () => void
  showModal: (modal: ModalType) => void
  closeModal: () => void
}
```

### Component Communication Flow

```
User Interaction
      ↓
Component Event Handler
      ↓
Zustand Store Update
      ↓
Component Re-render (if subscribed to store)
      ↓
Or: Tauri IPC Command
      ↓
Backend Processing
      ↓
Result → Store Update
      ↓
Component Re-render
```

## Backend Architecture

### Command Handler Pattern

Each Tauri command is a Rust async function:

```rust
#[tauri::command]
async fn execute_query(
    connection_id: String,
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResult, String> {
    let pool = state.db_manager.get_connection(&connection_id)?;
    let result = execute_sql(&pool, &query).await?;
    Ok(result)
}
```

Commands are automatically serialized/deserialized via Serde.

### Database Manager

**File: `src-tauri/src/db/manager.rs`**

Manages connection lifecycle:

```rust
pub struct DatabaseManager {
    pools: HashMap<String, Box<dyn DatabaseConnection>>,
}

impl DatabaseManager {
    pub async fn connect(&mut self, config: ConnectionConfig) -> Result<()> {
        // Create appropriate driver based on database type
        let driver: Box<dyn DatabaseConnection> = match config.db_type {
            DbType::PostgreSQL => Box::new(PostgresDriver::connect(&config).await?),
            DbType::MySQL => Box::new(MysqlDriver::connect(&config).await?),
            // ... others
        };
        self.pools.insert(config.id, driver);
        Ok(())
    }

    pub fn get_connection(&self, id: &str) -> Result<&dyn DatabaseConnection> {
        self.pools.get(id).ok_or("Connection not found")
    }
}
```

### Database Abstraction Trait

**File: `src-tauri/src/db/connection.rs`**

```rust
pub trait DatabaseConnection: Send + Sync {
    async fn execute(&self, query: &str) -> Result<QueryResult>;
    async fn fetch_schema(&self) -> Result<Schema>;
    async fn get_table_info(&self, table: &str) -> Result<TableInfo>;
    async fn insert_row(&self, table: &str, values: Row) -> Result<()>;
    async fn update_row(&self, table: &str, id: u64, values: Row) -> Result<()>;
    async fn delete_row(&self, table: &str, id: u64) -> Result<()>;
}
```

Different database drivers implement this trait.

### Error Handling

**File: `src-tauri/src/error.rs`**

```rust
pub enum DbError {
    ConnectionFailed(String),
    QueryExecutionError(String),
    InvalidInput(String),
    PermissionDenied,
}

impl From<DbError> for String {
    fn from(err: DbError) -> String {
        format!("{:?}", err)
    }
}
```

Errors are converted to strings and sent to frontend.

## Database Abstraction Layer

### Supported Database Drivers

Each database has a dedicated module implementing the `DatabaseConnection` trait:

**PostgreSQL** (`src-tauri/src/db/postgres.rs`)
- Uses `sqlx::PgPool`
- Supports schema, transactions
- Full feature support

**MySQL** (`src-tauri/src/db/mysql.rs`)
- Uses `sqlx::MySqlPool`
- Compatible with MySQL and MariaDB
- Stored procedures support

**SQLite** (`src-tauri/src/db/sqlite.rs`)
- Uses `sqlx::SqlitePool`
- File-based database
- No authentication

**MSSQL** (`src-tauri/src/db/mssql.rs`)
- Uses `tiberius` or `sqlx`
- T-SQL support
- Complex data types support

**Others** (MongoDB, Redis, CockroachDB, Cassandra)
- Specialized drivers per database
- Custom protocol handlers

### Type Conversions

**File: `src-tauri/src/utils/converters.rs`**

Converts database-specific types to generic JSON-compatible types:

```rust
pub fn convert_value(db_type: DbType, value: &dyn Any) -> serde_json::Value {
    match db_type {
        DbType::PostgreSQL => convert_postgres_value(value),
        DbType::MySQL => convert_mysql_value(value),
        // ... others
    }
}
```

Ensures frontend receives consistent JSON representations.

## Plugin System

### Plugin Core Traits

**File: `crates/plugin-core/src/lib.rs`**

```rust
pub trait Plugin: Send + Sync {
    fn metadata(&self) -> PluginMetadata;
    fn version(&self) -> &str;
    fn author(&self) -> &str;
}

pub enum PluginType {
    Validator,
    Theme,
    Exporter,
    Tool,
    AIAssistant,
}
```

### Validator Plugin Example

**File: `crates/validator-csharp/src/lib.rs`**

```rust
pub struct CSharpValidator;

impl Plugin for CSharpValidator {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "C# Connection String Validator".to_string(),
            plugin_type: PluginType::Validator,
        }
    }
}

impl Validator for CSharpValidator {
    fn validate(&self, connection_string: &str) -> ValidatorResult {
        // Parse C# connection string format
        // Return validation result
    }
}
```

### Plugin Loading

Plugins are loaded at startup from configured directories:

```rust
fn load_plugins() -> Result<Vec<Box<dyn Plugin>>> {
    let plugin_dir = get_plugin_directory();
    let mut plugins = Vec::new();

    for entry in fs::read_dir(&plugin_dir)? {
        let path = entry?.path();
        if path.extension().map_or(false, |e| e == "so" || e == "dll" || e == "dylib") {
            // Load dynamic library and register plugin
        }
    }

    Ok(plugins)
}
```

## State Management

### Persistent State

UI state is persisted to localStorage on the frontend:

```typescript
// src/stores/connections.ts
const useConnectionStore = create(
  persist(
    (set) => ({
      // ... store definition
    }),
    {
      name: 'connections-store',
    }
  )
)
```

Connection settings are stored in the backend's local storage:

```rust
// src-tauri/src/storage/local.rs
pub struct LocalStorage {
    config_dir: PathBuf,
}

impl LocalStorage {
    pub fn save_connections(&self, connections: &[Connection]) -> Result<()> {
        let json = serde_json::to_string(connections)?;
        fs::write(self.config_dir.join("connections.json"), json)?;
        Ok(())
    }
}
```

## Communication Protocol

### Tauri IPC Commands

Frontend → Backend via `@tauri-apps/api`:

```typescript
import { invoke } from '@tauri-apps/api/core'

// Call backend command
const result = await invoke<QueryResult>('execute_query', {
  connectionId: 'abc123',
  query: 'SELECT * FROM users',
})
```

### Command Serialization

Commands are serialized as JSON over Tauri's IPC:

**Request:**
```json
{
  "connectionId": "abc123",
  "query": "SELECT * FROM users LIMIT 10"
}
```

**Response:**
```json
{
  "columns": ["id", "name", "email"],
  "rows": [
    {"id": 1, "name": "Alice", "email": "alice@example.com"},
    {"id": 2, "name": "Bob", "email": "bob@example.com"}
  ],
  "executionTime": 125
}
```

## Key Design Decisions

### 1. Tauri Instead of Electron

**Decision**: Use Tauri for the desktop framework

**Rationale**:
- Smaller binary size (< 50MB vs Electron's 150MB+)
- Lower memory footprint
- Native OS integration
- Faster startup
- Better security model (Rust backend)

### 2. Zustand for State Management

**Decision**: Use Zustand instead of Redux

**Rationale**:
- Simpler API than Redux
- Less boilerplate
- Good TypeScript support
- Built-in persistence
- Minimal bundle size

### 3. Database Abstraction Trait

**Decision**: Use Rust trait for database abstraction

**Rationale**:
- Compile-time type checking
- Minimal runtime overhead
- Easy to add new database drivers
- Consistent error handling
- Automatic serialization via Serde

### 4. Separate Compilation for Validators

**Decision**: Validators are separate Cargo crates

**Rationale**:
- Modular plugin system
- Can be updated independently
- Language-specific validators (C#, Python, Node.js)
- Easy for community to contribute
- Reduces main binary size

### 5. Local Storage for Connections

**Decision**: Store connections locally with optional encryption

**Rationale**:
- Works offline
- User privacy (data stays on machine)
- Faster startup
- Can encrypt sensitive data
- Portable configuration

## Development Workflow

### Frontend Development

```bash
# Install dependencies
bun install

# Start dev server with hot reload
bun tauri dev

# Build for production
bun tauri build
```

### Backend Development

```bash
# Run tests
cargo test

# Build backend
cargo build --release

# Format code
cargo fmt
```

### Adding a New Database Driver

1. Create new module in `src-tauri/src/db/`
2. Implement `DatabaseConnection` trait
3. Add database type to `DbType` enum
4. Update driver selection in `DatabaseManager`
5. Add tests
6. Update documentation

### Adding a New Feature

1. **Design**: Plan UI components and state changes
2. **Frontend**: Create React components, update Zustand stores
3. **Backend**: Add Tauri command handlers, implement business logic
4. **Testing**: Test frontend and backend independently
5. **Integration**: Test end-to-end workflow
6. **Documentation**: Update docs and add examples

## Performance Considerations

### Frontend Optimization

- **Code Splitting**: Lazy-load components
- **Virtual Scrolling**: Only render visible grid rows
- **Memoization**: Use React.memo for expensive components
- **Bundle Size**: Tree-shake unused code

### Backend Optimization

- **Connection Pooling**: Reuse database connections
- **Query Caching**: Cache frequently run queries
- **Async/Await**: Non-blocking operations
- **Batch Operations**: Group database operations

### Database Optimization

- **Indexes**: Create indexes on frequently queried columns
- **LIMIT Clause**: Limit result set size
- **Prepared Statements**: Use parameterized queries (prevent SQL injection)
- **Connection Pool Size**: Configure based on workload

---

**Contributing**: See CONTRIBUTING.md for guidelines on adding features, fixing bugs, and submitting pull requests.
