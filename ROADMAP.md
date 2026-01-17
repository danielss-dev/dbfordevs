# dbfordevs - Implementation Roadmap

This document outlines all potential features, improvements, and technical debt items identified for the dbfordevs project.

---

## Table of Contents

1. [High Priority](#high-priority)
2. [Medium Priority](#medium-priority)
3. [Low Priority](#low-priority)
4. [Database Drivers](#database-drivers)
5. [Testing & Quality](#testing--quality)
6. [Technical Debt](#technical-debt)
7. [UI/UX Enhancements](#uiux-enhancements)
8. [AI Assistant Improvements](#ai-assistant-improvements)
9. [Performance Optimizations](#performance-optimizations)
10. [Documentation](#documentation)

---

## High Priority

### 1. Data Import Functionality

**Status:** Not Implemented
**Impact:** High
**Effort:** Medium

Currently, the application supports export only (JSON, CSV, INSERT SQL). Import is a fundamental feature for any database tool.

**Implementation Tasks:**
- [x] CSV import with delimiter detection
- [x] Column mapping UI (source column → target column)
- [x] Data type validation and conversion
- [x] JSON import for structured data
- [x] SQL file execution (batch INSERT statements)
- [x] Import preview with first N rows
- [x] Error handling with row-level error reporting
- [x] Progress indicator for large imports
- [x] Duplicate handling options (skip, replace, fail)
- [x] Transaction support (rollback on error)

**Files to modify:**
- `src-tauri/src/commands/queries.rs` - New import commands
- `src/components/data-grid/` - Import UI components
- `src/hooks/useDatabase.ts` - Import hook methods

---

### 2. Query Execution Plan Visualization

**Status:** Not Implemented
**Impact:** High
**Effort:** Medium

Users cannot analyze query performance. EXPLAIN support would help optimize slow queries.

**Implementation Tasks:**
- [x] Add EXPLAIN/EXPLAIN ANALYZE execution command
- [x] Parse execution plan output per database type
- [x] Visual tree view for query plan nodes
- [x] Cost breakdown display
- [x] Index usage highlighting
- [x] Sequential scan warnings
- [x] Row estimate vs actual comparison
- [x] Query plan comparison (before/after optimization)
- [x] Save execution plans for reference

**Database-specific considerations:**
- PostgreSQL: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
- MySQL: `EXPLAIN FORMAT=JSON`
- SQLite: `EXPLAIN QUERY PLAN`
- MSSQL: `SET SHOWPLAN_XML ON`

---

### 3. SQL Formatter / Beautifier

**Status:** Implemented
**Impact:** High
**Effort:** Low

The Monaco editor now includes SQL formatting capabilities.

**Implementation Tasks:**
- [x] Integrate SQL formatting library (sql-formatter or similar)
- [x] Format document command (Shift+Alt+F)
- [x] Format selection command
- [ ] Auto-format on paste option
- [x] Configurable formatting options:
  - [x] Keyword case (UPPER, lower, Preserve)
  - [x] Indentation style (spaces/tabs, size)
  - [ ] Comma position (before/after)
  - [ ] Line width limit
- [x] Per-database dialect support
- [x] Add to editor toolbar
- [x] Add to right-click context menu

**Library used:** `sql-formatter` (npm package)

---

### 4. Table Creation UI

**Status:** Implemented
**Impact:** High
**Effort:** Medium

Users can create new tables via a wizard-style GUI with full column, constraint, and index support.

**Implementation Tasks:**
- [x] Create Table dialog/wizard
- [x] Column definition editor:
  - [x] Name, data type, length/precision
  - [x] Nullable checkbox
  - [x] Default value input
  - [x] Primary key checkbox
  - [x] Auto-increment option
- [x] Constraint editor:
  - [x] Primary key (single/composite)
  - [x] Foreign keys with reference picker
  - [x] Unique constraints
  - [x] Check constraints
- [x] Index creation
- [x] Preview generated DDL
- [x] Execute with confirmation
- [ ] Template tables (common patterns)

---

## Medium Priority

### 5. Query Bookmarks & Templates

**Status:** Implemented
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [x] Save query as bookmark
- [x] Bookmark manager UI
- [x] Organize bookmarks in folders
- [x] Quick access panel/dropdown
- [x] Search within bookmarks
- [x] Share bookmarks between connections
- [x] Built-in query templates:
  - [x] Basic SELECT with JOIN
  - [x] INSERT template
  - [x] UPDATE template
  - [x] DELETE with WHERE
  - [x] Common aggregations
  - [x] Index creation
- [x] Custom template creation
- [x] Template variables/placeholders

**Storage:** Zustand store with localStorage persistence (`dbfordevs-bookmarks`)

---

### 6. Global Schema Search

**Status:** Partial (diagram only)
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [ ] Search input in sidebar header
- [ ] Search across:
  - [ ] Table names
  - [ ] Column names
  - [ ] View names
  - [ ] Stored procedures
  - [ ] Functions
  - [ ] Index names
- [ ] Fuzzy matching support
- [ ] Highlight matches in results
- [ ] Navigate to result on click
- [ ] Search history
- [ ] Filter by object type

---

### 7. Customizable Keyboard Shortcuts

**Status:** Display only
**Impact:** Medium
**Effort:** Low

Settings show keybindings but they cannot be changed.

**Implementation Tasks:**
- [ ] Keybinding configuration UI
- [ ] Conflict detection
- [ ] Reset to defaults
- [ ] Import/export keybindings
- [ ] Per-context bindings (editor, grid, global)
- [ ] Search keybindings
- [ ] Visual key recorder

**Commands to make configurable:**
- Execute query
- New tab
- Close tab
- Save query
- Format SQL
- Toggle sidebar
- Focus search
- Navigate tables

---

### 8. Query History Improvements

**Status:** Implemented
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [x] Search within history
- [x] Filter by:
  - [x] Date range
  - [x] Connection (per-connection history)
  - [x] Success/failure
  - [x] Execution time
- [x] Star/favorite queries
- [x] History cleanup settings:
  - [x] Max history items
  - [x] Auto-delete after N days
  - [x] Clear all button
- [x] Export history (JSON, CSV)
- [x] Query execution statistics
- [x] Duplicate detection

**Files modified:**
- `src/types/index.ts` - Added QueryHistorySettings, QueryHistoryFilters, QueryHistoryStats types
- `src/stores/query.ts` - Added history settings, cleanup, favorites, export, and statistics
- `src/components/query-history/QueryHistoryPanel.tsx` - Complete rewrite with filters, stats, export
- `src/components/query-history/QueryHistoryItem.tsx` - Added favorites support
- `src/components/query-history/QueryHistoryDropdownItem.tsx` - Added favorites indicator
- `src/components/settings/SettingsDialog.tsx` - Added Query History settings in Advanced tab
- `src/App.tsx` - Added auto-cleanup on startup

---

### 9. Data Grid Enhancements

**Status:** Implemented
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [x] Column reordering (via header menu)
- [x] Column hiding/showing (ColumnVisibilityPopover)
- [x] Column pinning (freeze left/right)
- [x] Row height configuration (compact/default/comfortable/spacious)
- [x] Cell value formatting options:
  - [x] Date/time formats (ISO, locale, relative, custom)
  - [x] Number formats (compact, percentage, decimal places)
  - [x] JSON pretty-print (collapsed, inline, pretty)
- [x] Conditional formatting (highlight cells with rule builder)
- [x] Column statistics (count, sum, avg, min, max, stdDev)
- [x] Copy cell/row/column (JSON, CSV, INSERT)
- [x] Find & replace in results (Ctrl+F, regex support)
- [x] NULL value display customization (text, style, color)
- [x] Binary data preview (hex view, base64, text)
- [x] Image preview for BLOB/BYTEA (auto-detect PNG/JPEG/GIF/WebP/BMP)

**Files created:**
- `src/types/grid.ts` - Type definitions
- `src/stores/grid.ts` - Zustand store with persistence
- `src/lib/format-utils.ts` - Date/number/JSON formatting
- `src/lib/binary-utils.ts` - Binary detection and hex view
- `src/components/data-grid/ColumnVisibilityPopover.tsx`
- `src/components/data-grid/ColumnHeaderMenu.tsx`
- `src/components/data-grid/CellContextMenu.tsx`
- `src/components/data-grid/ColumnStatisticsDialog.tsx`
- `src/components/data-grid/FindReplaceBar.tsx`
- `src/components/data-grid/BinaryPreviewDialog.tsx`
- `src/components/data-grid/ConditionalFormatDialog.tsx`
- `src/components/settings/GridSettingsTab.tsx`

---

## Low Priority

### 10. Multiple Result Sets

**Status:** Not Implemented
**Impact:** Low
**Effort:** Medium

Support queries returning multiple result sets.

**Implementation Tasks:**
- [ ] Tab per result set
- [ ] Result set navigation
- [ ] Stored procedure output parameters
- [ ] PRINT/RAISERROR message capture (MSSQL)

---

### 11. Database Object Management

**Status:** Implemented
**Impact:** Low
**Effort:** High

**Implementation Tasks:**
- [x] Create/Edit/Drop Views
- [x] Create/Edit/Drop Indexes
- [x] Create/Edit/Drop Stored Procedures
- [x] Create/Edit/Drop Functions
- [x] Create/Edit/Drop Triggers
- [x] Create/Edit/Drop Sequences
- [x] User/Role management
- [x] Permission management

**Files created:**
- `src-tauri/src/commands/views.rs` - View management commands
- `src-tauri/src/commands/indexes.rs` - Index management commands
- `src/stores/views.ts` - Views Zustand store
- `src/stores/indexes.ts` - Indexes Zustand store
- `src/stores/users.ts` - Users/Roles Zustand store
- `src/components/users/` - User management UI components

---

### 12. Query Diff Tool

**Status:** Partial (AI optimization only)
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Compare two query results
- [ ] Schema diff between connections
- [ ] Data diff between tables
- [ ] Generate migration scripts
- [ ] Side-by-side view
- [ ] Inline diff view

---

### 13. Connection Groups & Tags

**Status:** Implemented
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [x] Group connections by environment (dev/staging/prod)
- [x] Custom tags/labels
- [x] Color coding
- [x] Collapse/expand groups
- [x] Filter by group/tag
- [x] Bulk operations on groups

**Files created:**
- `src/components/ui/color-picker.tsx` - Color palette picker
- `src/components/ui/tag-badge.tsx` - Colored tag badge component
- `src/components/connections/ConnectionFilterBar.tsx` - Search and filter UI
- `src/components/connections/GroupManagerDialog.tsx` - Group CRUD dialog
- `src/components/connections/AssignGroupDialog.tsx` - Assign group/tags to connection
- `src/components/layout/ConnectionGroupItem.tsx` - Collapsible group container

**Files modified:**
- `src/types/index.ts` - Added ConnectionGroup, ConnectionTag interfaces
- `src/stores/connections.ts` - Extended with groups, tags, filters, migration
- `src/stores/ui.ts` - Added dialog state management
- `src/components/layout/Sidebar.tsx` - Integrated grouped rendering

---

### 14. Query Scheduler

**Status:** Not Implemented
**Impact:** Low
**Effort:** High

**Implementation Tasks:**
- [ ] Schedule query execution
- [ ] Cron-like scheduling
- [ ] Export results automatically
- [ ] Email notifications
- [ ] Execution history
- [ ] Error alerting

---

## Database Drivers

### 15. MongoDB Driver

**Status:** Implemented
**Impact:** High
**Effort:** High

**Implementation Tasks:**
- [x] Add `mongodb` Rust crate dependency
- [x] Implement `DatabaseDriver` trait for MongoDB
- [x] Collection listing (equivalent to tables)
- [x] Document querying with MongoDB query syntax
- [x] Document CRUD operations
- [x] Index management
- [x] Aggregation pipeline support
- [x] Schema inference for documents
- [x] Connection string parsing (standard and Atlas SRV)
- [x] Authentication (SCRAM-SHA-256)

**Files Created:**
- `src-tauri/src/db/mongodb.rs` - Core MongoDB driver (~1100 lines)
- `src-tauri/src/commands/mongodb.rs` - 25+ Tauri commands
- `src/types/mongodb.ts` - TypeScript interfaces
- `src/stores/mongodb.ts` - Zustand store
- `src/hooks/useMongoDB.ts` - React hook wrapper
- `src/components/mongodb/` - UI components (MongoConnectionContent, MongoBrowser, MongoDocumentViewer, MongoDocumentEditor, MongoShell, MongoServerInfo)

**Features Implemented:**
- Database and collection browsing with tree view
- Document browser with filter, sort, and pagination
- Document CRUD operations (view, insert, edit, delete)
- Index management (list, create, drop)
- Aggregation pipeline support
- MongoDB Shell for raw command execution
- Server info dashboard with connection and storage stats
- Support for both `mongodb://` and `mongodb+srv://` (Atlas) connection strings

---

### 16. Redis Driver

**Status:** Implemented
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [x] Add `redis` Rust crate dependency
- [x] Key listing with pattern matching
- [x] Key type detection
- [x] Value viewing/editing per type:
  - [x] Strings
  - [x] Lists
  - [x] Sets
  - [x] Sorted Sets
  - [x] Hashes
  - [x] Streams
- [x] TTL management
- [x] Key deletion
- [x] Redis CLI mode
- [x] Pub/Sub viewer
- [x] Memory usage statistics

---

### 17. Oracle Driver

**Status:** Implemented
**Impact:** Medium
**Effort:** High

**Implementation Tasks:**
- [x] Evaluate Rust Oracle crates (oracle, sibyl)
- [x] Implement `DatabaseDriver` trait
- [x] Handle Oracle-specific types (NUMBER, VARCHAR2, CLOB, BLOB)
- [x] PL/SQL execution support
- [x] Package/procedure browsing
- [x] TNS connection string support (Easy Connect format)
- [ ] Oracle Wallet authentication

**Files:** `src-tauri/src/db/oracle.rs`

**Features Implemented:**
- Full Oracle driver using `oracle` crate with deadpool connection pooling
- Easy Connect format support (`//host:port/service_name`)
- All core operations: queries, tables, schemas, indexes, constraints, foreign keys
- Oracle-specific type handling (NUMBER, VARCHAR2, CHAR, CLOB, BLOB, DATE, TIMESTAMP)
- EXPLAIN PLAN visualization with DBMS_XPLAN
- DDL generation using DBMS_METADATA
- System schema filtering (SYS, SYSTEM, APEX_*, etc.)

---

### 18. Cassandra Driver

**Status:** Types defined, not implemented
**Impact:** Low
**Effort:** High

**Implementation Tasks:**
- [ ] Add `scylla` or `cdrs-tokio` crate
- [ ] Keyspace/table listing
- [ ] CQL query execution
- [ ] Partition key awareness
- [ ] Cluster topology view
- [ ] Consistency level configuration

---

## Testing & Quality

### 19. End-to-End Tests

**Status:** Not Implemented
**Impact:** High
**Effort:** High

**Implementation Tasks:**
- [ ] Set up Playwright or Cypress
- [ ] Connection creation flow test
- [ ] Query execution flow test
- [ ] Export functionality test
- [ ] Theme switching test
- [ ] AI assistant interaction test
- [ ] Error handling scenarios
- [ ] CI/CD integration

---

### 20. Rust Command Handler Tests

**Status:** Not Implemented
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Unit tests for `commands/connections.rs`
- [ ] Unit tests for `commands/queries.rs`
- [ ] Unit tests for `commands/tables.rs`
- [ ] Mock database connections
- [ ] Error case coverage

---

### 21. Frontend Component Tests

**Status:** Partial
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Data grid component tests
- [ ] Connection form tests
- [ ] Settings dialog tests
- [ ] AI panel tests
- [ ] Query editor tests
- [ ] Increase coverage to 80%+

---

## Technical Debt

### 22. Parameterized Queries for CRUD

**Status:** Security concern identified
**Impact:** Critical (Security)
**Effort:** Medium

Location: `src-tauri/src/commands/queries.rs:142`

**Implementation Tasks:**
- [ ] Replace string interpolation with parameterized queries
- [ ] Update `insert_row` command
- [ ] Update `update_row` command
- [ ] Update `delete_row` command
- [ ] Add input validation
- [ ] SQL injection test cases

---

### 23. Error Handling Standardization

**Status:** Inconsistent
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [ ] Standardize error types across all commands
- [ ] User-friendly error messages
- [ ] Error codes for programmatic handling
- [ ] Logging improvements
- [ ] Error tracking/reporting

---

### 24. Connection Pool Management

**Status:** Basic
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Connection pool statistics UI
- [ ] Pool size configuration
- [ ] Connection timeout settings
- [ ] Idle connection cleanup
- [ ] Connection health checks
- [ ] Reconnection strategies

---

## UI/UX Enhancements

### 25. Dark Mode Improvements

**Status:** Functional
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] More theme variants
- [ ] Custom theme creator
- [ ] Theme import/export
- [ ] Syntax highlighting theme sync
- [ ] High contrast mode

---

### 26. Accessibility (a11y)

**Status:** Basic
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Keyboard navigation audit
- [ ] Screen reader support
- [ ] ARIA labels
- [ ] Focus indicators
- [ ] Color contrast compliance
- [ ] Reduced motion support

---

### 27. Responsive Design

**Status:** Desktop only
**Impact:** Low
**Effort:** Medium

**Implementation Tasks:**
- [ ] Tablet layout optimization
- [ ] Collapsible panels for small screens
- [ ] Touch-friendly controls
- [ ] Mobile companion app (future)

---

### 28. Onboarding & Tutorials

**Status:** Not Implemented
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [ ] First-run welcome wizard
- [ ] Feature tour/highlights
- [ ] Sample database option
- [ ] Quick start guide
- [ ] Contextual help tooltips
- [ ] Video tutorial links

---

### 29. Notifications & Alerts

**Status:** Basic toasts
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Notification center
- [ ] Notification history
- [ ] Query completion notifications
- [ ] Error notifications with actions
- [ ] Desktop notifications (optional)

---

## AI Assistant Improvements

### 30. AI Context Enhancements

**Status:** Functional
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Include foreign key relationships in context
- [ ] Include indexes in context
- [ ] Include sample data option
- [ ] Context size indicator
- [ ] Manual context editing
- [ ] Context templates

---

### 31. AI Query Validation

**Status:** Not Implemented
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Syntax validation before execution
- [ ] Semantic validation (table/column existence)
- [ ] Performance warnings
- [ ] Security warnings (DROP, TRUNCATE, etc.)
- [ ] Suggested improvements

---

### 32. AI Chat Export

**Status:** Not Implemented
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Export chat history to Markdown
- [ ] Export to PDF
- [ ] Share chat sessions
- [ ] Chat templates

---

## Performance Optimizations

### 33. Query Result Streaming

**Status:** Not Implemented
**Impact:** Medium
**Effort:** High

**Implementation Tasks:**
- [ ] Stream large result sets
- [ ] Progressive loading
- [ ] Cancel long-running queries
- [ ] Memory usage optimization
- [ ] Result set pagination

---

### 34. Connection Caching

**Status:** Basic
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Schema metadata caching
- [ ] Table list caching
- [ ] Cache invalidation strategies
- [ ] Cache size limits
- [ ] Manual cache refresh

---

### 35. Lazy Loading

**Status:** Partial
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Lazy load schema tree
- [ ] Lazy load large tables
- [ ] Code splitting optimization
- [ ] Bundle size reduction

---

## Documentation

### 36. User Documentation

**Status:** Minimal
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] User guide
- [ ] Feature documentation
- [ ] Keyboard shortcuts reference
- [ ] FAQ section
- [ ] Troubleshooting guide
- [ ] Video tutorials

---

### 37. Developer Documentation

**Status:** CLAUDE.md exists
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Architecture documentation
- [ ] API documentation
- [ ] Contributing guidelines expansion
- [ ] Code style guide

---

## Implementation Priority Matrix

| Priority | Feature | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| ~~P0~~ | ~~Parameterized Queries (Security)~~ | ~~Critical~~ | ~~Medium~~ | Partial |
| ~~P1~~ | ~~Data Import~~ | ~~High~~ | ~~Medium~~ | **Implemented** |
| ~~P1~~ | ~~Query Execution Plans~~ | ~~High~~ | ~~Medium~~ | **Implemented** |
| ~~P1~~ | ~~SQL Formatter~~ | ~~High~~ | ~~Low~~ | **Implemented** |
| ~~P2~~ | ~~Table Creation UI~~ | ~~High~~ | ~~Medium~~ | **Implemented** |
| ~~P2~~ | ~~Query Bookmarks~~ | ~~Medium~~ | ~~Low~~ | **Implemented** |
| P2 | Global Schema Search | Medium | Low | Partial |
| ~~P2~~ | ~~MongoDB Driver~~ | ~~High~~ | ~~High~~ | **Implemented** |
| P3 | Customizable Keybindings | Medium | Low | Not Started |
| P3 | E2E Tests | High | High | Not Started |
| ~~P4~~ | ~~Redis Driver~~ | ~~Medium~~ | ~~Medium~~ | **Implemented** |
| ~~P4~~ | ~~Oracle Driver~~ | ~~Medium~~ | ~~High~~ | **Implemented** |
| ~~P2~~ | ~~View Management~~ | ~~Medium~~ | ~~Medium~~ | **Implemented** |
| ~~P2~~ | ~~Index Management~~ | ~~Medium~~ | ~~Medium~~ | **Implemented** |
| ~~P2~~ | ~~User/Role Management~~ | ~~Medium~~ | ~~Medium~~ | **Implemented** |
| ~~P2~~ | ~~Query History Enhancements~~ | ~~Medium~~ | ~~Low~~ | **Implemented** |
| ~~P2~~ | ~~Data Grid Enhancements~~ | ~~Medium~~ | ~~Medium~~ | **Implemented** |

---

## Version Milestones (Suggested)

### v0.3.0 - Data Management ✅ RELEASED
- ✅ Data Import (CSV, JSON, SQL)
- ✅ SQL Formatter
- ✅ Query Bookmarks
- ✅ Query Execution Plans
- ✅ Table Creation UI
- ✅ Oracle Driver

### v0.3.5 - Schema & User Management ✅ RELEASED
- ✅ View Management (Create/Drop/DDL)
- ✅ Index Management (Create/Drop/DDL)
- ✅ User/Role Management
- ✅ Permission Controls
- ✅ Query History Enhancements
- ✅ Data Grid Enhancements

### v0.4.0 - NoSQL Support ✅ RELEASED
- ✅ MongoDB Driver (full implementation)
- ✅ Redis Driver (full implementation)
- ✅ Document Viewer/Editor
- ✅ MongoDB Shell & Aggregation Pipeline
- ✅ Redis CLI & Pub/Sub

### v0.5.0 - Query Intelligence
- Query Validation
- Performance Warnings
- Global Schema Search
- Parameterized Queries Improvement

### v0.6.0 - Advanced Features
- Stored Procedures Management
- Functions Management
- Triggers Management
- Schema Diff

### v1.0.0 - Production Ready
- Full Test Coverage
- User Documentation
- Accessibility Compliance
- Customizable Keybindings

---

*Last updated: January 17, 2026*
*Generated from codebase analysis - v0.4.0*
