# dbfordevs

## Product Requirements Document

| Field   | Value              |
|---------|--------------------|
| Version | 1.1                |
| Date    | December 18, 2025  |
| Author  | Daniels            |
| Status  | In Development     |

---

## 1. Executive Summary

dbfordevs is a modern, cross-platform database management application designed specifically for developers. The application provides a unified interface to manage multiple database systems including PostgreSQL, MySQL, Microsoft SQL Server, SQLite, and eventually NoSQL databases like MongoDB and Redis. Built with developer experience as the primary focus, dbfordevs aims to streamline database operations with features like inline editing, visual diff comparison for changes, and extensible connection string validation tools.

---

## 2. Problem Statement

Developers working with multiple database systems face several challenges:

- They often need to switch between different database management tools depending on the database they're working with (pgAdmin for PostgreSQL, MySQL Workbench for MySQL, SQL Server Management Studio for MSSQL)
- Each tool has its own learning curve and interface conventions
- Developers frequently struggle with connection string formats, which vary significantly between programming languages and database drivers
- There's no easy way to validate connection strings before using them in code
- Making changes to database records often requires writing SQL statements
- Reviewing changes before committing them is cumbersome

---

## 3. Goals and Objectives

### 3.1 Primary Goals

1. Provide a single, unified interface for managing multiple database types
2. Support Windows, macOS, and Linux platforms with consistent experience
3. Enable intuitive data editing with visual change tracking
4. Offer extensible connection string validation for multiple programming languages
5. Maintain a lightweight, fast, and responsive application

### 3.2 Success Metrics

1. Application startup time under 3 seconds
2. Memory usage under 200MB for typical workloads
3. Support for at least 5 SQL database types at launch
4. Connection string validators for 3 programming languages in Phase 1

---

## 4. Target Users

### 4.1 Primary Users

**Software Developers:** Full-stack and backend developers who regularly interact with databases during development, testing, and debugging.

**DevOps Engineers:** Professionals managing database connections across multiple environments who need to validate and test connection configurations.

**Technical Leads:** Team leads who need to quickly inspect and modify data across different database systems.

### 4.2 Secondary Users

**Database Administrators:** DBAs who want a lightweight alternative to full-featured database administration tools for quick data inspection and modifications.

**QA Engineers:** Quality assurance professionals who need to verify data states during testing.

---

## 5. Technical Architecture

### 5.1 Framework: Tauri

dbfordevs will be built using **Tauri 2.x**, a modern framework for building lightweight cross-platform desktop applications.

**Why Tauri:**

- **Lightweight:** Bundle sizes of 3-10 MB
- **Fast:** Startup time ~0.5 seconds, memory usage 30-50 MB idle
- **Secure:** Secure by default with opt-in APIs
- **Performance:** Rust backend provides excellent performance for database operations
- **Native Feel:** Uses system WebViews for a lightweight footprint
- **Cross-Platform:** Full support for Windows, macOS, and Linux

### 5.2 Technology Stack

- **Framework:** Tauri 2.x with Rust backend
- **Frontend:** React 18+ with TypeScript, Vite for bundling
- **Package Manager:** Bun (fast, modern JavaScript runtime and package manager)
- **UI Framework:** TailwindCSS with shadcn/ui components
- **State Management:** Zustand for React state management
- **Database Drivers (Rust):** sqlx (PostgreSQL, MySQL, SQLite), tiberius (MSSQL)
- **Diff Library:** diff-match-patch or similar for change visualization
- **Code Editor:** Monaco Editor (VS Code's editor) for SQL editing

### 5.3 Project Structure

The project uses a **Cargo workspace** monorepo structure:

```
dbfordevs/
├── src/                    # React frontend
├── src-tauri/              # Main Tauri application (Rust)
├── crates/                 # Workspace crates
│   ├── validator-core/     # Shared validator traits and types
│   ├── validator-csharp/   # C#/.NET connection string validator
│   ├── validator-nodejs/   # Node.js connection string validator
│   └── validator-python/   # Python/SQLAlchemy validator
├── Cargo.toml              # Workspace root configuration
└── package.json            # Frontend dependencies
```

This structure allows:
- Independent development and testing of each validator
- Shared core types and traits via `validator-core`
- Easy addition of new language validators as separate crates

---

## 6. Feature Specifications

### 6.1 Connection Management

#### 6.1.1 Description

Users can create, edit, and manage database connections. Connections are organized in a sidebar tree view, supporting folders for organization. Each connection stores encrypted credentials and connection parameters.

#### 6.1.2 Supported Databases (Phase 1 - SQL)

- PostgreSQL
- MySQL / MariaDB
- Microsoft SQL Server
- SQLite
- Oracle Database (stretch goal)

#### 6.1.3 Supported Databases (Phase 2 - NoSQL)

- MongoDB
- Redis
- CockroachDB
- Cassandra (stretch goal)

---

### 6.2 Connection String Validator Tool

#### 6.2.1 Description

An extensible plugin system that allows users to install language-specific connection string validators. Each validator understands the connection string format for its respective language/framework and can test the connection.

#### 6.2.2 Workflow

1. User opens the Connection String Validator from the Tools menu
2. User selects the programming language/framework from installed validators
3. User pastes or types their connection string
4. Validator parses the connection string and displays parsed components
5. User clicks "Test Connection" to verify connectivity
6. Status indicator shows green (success) or red (failure) with error details
7. User can optionally create a dbfordevs connection from the validated string

#### 6.2.3 Initial Validators

- **C# / .NET:** ADO.NET connection strings (SqlConnection, NpgsqlConnection, MySqlConnection)
- **Node.js:** Connection strings for pg, mysql2, mssql packages (URL format and JSON config)
- **Python:** SQLAlchemy connection URLs, psycopg2, PyMySQL

#### 6.2.4 Validator Architecture

Each validator is implemented as a separate Rust crate in the `crates/` directory:

- **validator-core:** Defines the `ConnectionStringValidator` trait and shared types
- **validator-csharp:** Parses ADO.NET style `key=value;` connection strings
- **validator-nodejs:** Handles URL format (`postgresql://...`) and JSON configuration objects
- **validator-python:** Parses SQLAlchemy dialect URLs (`dialect+driver://...`)

All validators implement a common interface:
- `parse()` - Extract connection components from string
- `validate()` - Check for errors and warnings
- `to_connection_string()` - Convert parsed components back to string format

---

### 6.3 Table View and Data Grid

#### 6.3.1 Description

A high-performance data grid for viewing and editing table data. The grid supports virtualized scrolling for large datasets, column sorting, filtering, and inline editing capabilities.

#### 6.3.2 Features

- Virtualized scrolling for tables with millions of rows
- Column resizing and reordering
- Multi-column sorting
- Quick filter and advanced filter builders
- Pagination controls with configurable page sizes
- Export selected rows or entire result sets

---

### 6.4 Side Panel Editor

#### 6.4.1 Description

When a user clicks on a row or specific field in the data grid, a side panel slides in from the right displaying a detailed edit form. This provides a more comfortable editing experience for records with many columns or large text fields.

#### 6.4.2 Features

- Form-based editing with appropriate input controls per data type
- Support for NULL values with explicit toggle
- JSON/XML field formatting and syntax highlighting
- Image preview for binary/blob fields containing images
- Foreign key lookup with autocomplete
- Field validation based on column constraints
- Navigate between rows while keeping panel open

---

### 6.5 Change Diff Preview

#### 6.5.1 Description

Before committing any changes to the database, users are presented with a diff view showing exactly what will be modified. This provides transparency and reduces accidental data corruption.

#### 6.5.2 Features

- Side-by-side diff view showing original vs. modified values
- Syntax-highlighted SQL preview of the actual statements to be executed
- Color-coded changes:
  - 🟢 Green for additions
  - 🔴 Red for deletions
  - 🟡 Yellow for modifications
- Ability to selectively apply or discard individual changes
- Change summary showing count of inserts, updates, and deletes
- Copy generated SQL to clipboard
- Undo/Redo support for pending changes

---

### 6.6 CRUD Operations

#### 6.6.1 Create (Insert)

- Add new row button in table view
- Form pre-populated with default values
- Duplicate existing row functionality
- Bulk insert from CSV/JSON

#### 6.6.2 Read (Select)

- Quick table preview with first N rows
- Custom SQL query execution
- Query history and favorites
- Result set export (CSV, JSON, Excel, SQL INSERT statements)

#### 6.6.3 Update

- Inline cell editing (double-click to edit)
- Side panel detailed editing
- Bulk update with find/replace
- Transaction support with explicit commit/rollback

#### 6.6.4 Delete

- Single row deletion with confirmation
- Multi-row selection and batch delete
- Cascade delete warnings for foreign key relationships
- Soft delete option (if table supports it)

---

### 6.7 SQL Query Editor

- Monaco Editor integration with SQL syntax highlighting
- IntelliSense/autocomplete for table names, columns, and SQL keywords
- Multiple query tabs
- Query execution with keyboard shortcuts (Ctrl/Cmd + Enter)
- Execution plan visualization
- Query formatting/beautification

---

## 7. User Interface Design

### 7.1 Layout Overview

The application follows a three-panel layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  Menu Bar                                                       │
├──────────────┬──────────────────────────────┬───────────────────┤
│              │                              │                   │
│   Sidebar    │       Main Content           │    Side Panel     │
│              │                              │    (collapsible)  │
│  - Connections│    - Data Grid              │                   │
│  - Databases │    - Query Editor            │    - Row Editor   │
│  - Tables    │    - Results                 │    - Properties   │
│              │                              │                   │
│              │                              │                   │
├──────────────┴──────────────────────────────┴───────────────────┤
│  Status Bar                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Theme Support

- Light and Dark themes built-in
- System theme auto-detection
- Custom theme support via JSON configuration

---

## 8. Development Phases

### Phase 1: Foundation (Months 1-3)

- [x] Project setup with Tauri + React + TypeScript + Bun
- [x] Configure Cargo workspace with validator crates structure
- [x] Set up TailwindCSS, shadcn/ui, and Zustand state management
- [x] Implement three-panel layout (Sidebar, MainContent, SidePanel)
- [x] Define validator-core traits and initial validator implementations
- [ ] Basic connection management (PostgreSQL, MySQL, SQLite)
- [ ] Table browsing and basic data grid
- [ ] Simple SQL query execution
- [ ] Basic CRUD operations

### Phase 2: Core Features (Months 4-6)

- [ ] Microsoft SQL Server support
- [ ] Side panel editor implementation
- [ ] Change diff preview system
- [ ] Connection string validator (C# plugin)
- [ ] Query history and favorites

### Phase 3: Polish & Expand (Months 7-9)

- [ ] Node.js and Python connection string validators
- [ ] Advanced data grid features (export, bulk operations)
- [ ] Query IntelliSense and autocomplete
- [ ] Performance optimization
- [ ] Beta release

### Phase 4: NoSQL Support (Months 10-12)

- [ ] MongoDB support
- [ ] Redis support
- [ ] Document viewer/editor for NoSQL
- [ ] v1.0 stable release

---

## 9. Competitive Analysis

| Feature               | dbfordevs | DBeaver   | DataGrip | DbGate |
|-----------------------|-----------|-----------|----------|--------|
| Lightweight           | ✅        | ❌        | ❌       | ✅     |
| Conn String Validator | ✅        | ❌        | ❌       | ❌     |
| Visual Diff Preview   | ✅        | Partial   | ✅       | ❌     |
| Side Panel Editor     | ✅        | ❌        | ❌       | ❌     |
| Free & Open Source    | TBD       | Community | Paid     | ✅     |
| Cross-Platform        | ✅        | ✅        | ✅       | ✅     |
| SQL + NoSQL           | ✅        | ✅        | ✅       | ✅     |

### Key Differentiators

1. **Connection String Validator** - Unique feature not found in competitors
2. **Lightweight footprint** - Tauri-based architecture vs Java (DBeaver) or JetBrains platform (DataGrip)
3. **Side Panel Editor** - Better UX for editing complex records
4. **Visual Diff Preview** - Review all changes before committing

---

## 10. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Rust Learning Curve** | High | Medium | Start with simple Tauri commands; leverage existing Rust database crates; consider pairing with experienced Rust developers |
| **WebView Inconsistencies** | Medium | Medium | Thorough cross-platform testing; use polyfills; stick to well-supported CSS features |
| **Database Driver Complexity** | High | High | Start with most commonly used databases (PostgreSQL, MySQL) and add others incrementally |
| **Competition** | Medium | High | Focus on unique differentiators (connection string validators, lightweight footprint, developer-focused UX) |

---

## 11. Future Considerations

- Cloud database support (AWS RDS, Azure SQL, Google Cloud SQL)
- Team collaboration features (shared connections, query sharing)
- ER diagram visualization
- Database migration tools integration
- AI-powered query suggestions
- Plugin marketplace for community extensions
- SSH tunnel support
- Database schema comparison and synchronization

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition |
|------|------------|
| **CRUD** | Create, Read, Update, Delete - the four basic database operations |
| **Connection String** | A string containing parameters needed to connect to a database |
| **Tauri** | A framework for building lightweight desktop applications using web technologies and Rust |
| **WebView** | A native component that renders web content within a desktop application |
| **Diff** | A comparison showing differences between two versions of data or text |
| **Monaco Editor** | The code editor that powers VS Code, available as a standalone component |

### 12.2 References

- Tauri Documentation: https://tauri.app/v2/
- React Documentation: https://react.dev/
- SQLx (Rust): https://github.com/launchbadge/sqlx
- Monaco Editor: https://microsoft.github.io/monaco-editor/
- TailwindCSS: https://tailwindcss.com/
- shadcn/ui: https://ui.shadcn.com/

### 12.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 18, 2025 | Daniels | Initial draft |
| 1.1 | December 18, 2025 | Daniels | Added project structure, Bun package manager, validator architecture details, updated Phase 1 progress |

---

*Document generated for dbfordevs project*