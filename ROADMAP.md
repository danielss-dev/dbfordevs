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
- [ ] CSV import with delimiter detection
- [ ] Column mapping UI (source column → target column)
- [ ] Data type validation and conversion
- [ ] JSON import for structured data
- [ ] SQL file execution (batch INSERT statements)
- [ ] Import preview with first N rows
- [ ] Error handling with row-level error reporting
- [ ] Progress indicator for large imports
- [ ] Duplicate handling options (skip, replace, fail)
- [ ] Transaction support (rollback on error)

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
- [ ] Add EXPLAIN/EXPLAIN ANALYZE execution command
- [ ] Parse execution plan output per database type
- [ ] Visual tree view for query plan nodes
- [ ] Cost breakdown display
- [ ] Index usage highlighting
- [ ] Sequential scan warnings
- [ ] Row estimate vs actual comparison
- [ ] Query plan comparison (before/after optimization)
- [ ] Save execution plans for reference

**Database-specific considerations:**
- PostgreSQL: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
- MySQL: `EXPLAIN FORMAT=JSON`
- SQLite: `EXPLAIN QUERY PLAN`
- MSSQL: `SET SHOWPLAN_XML ON`

---

### 3. SQL Formatter / Beautifier

**Status:** Not Implemented
**Impact:** High
**Effort:** Low

The Monaco editor lacks SQL formatting capabilities.

**Implementation Tasks:**
- [ ] Integrate SQL formatting library (sql-formatter or similar)
- [ ] Format document command (Shift+Alt+F)
- [ ] Format selection command
- [ ] Auto-format on paste option
- [ ] Configurable formatting options:
  - [ ] Keyword case (UPPER, lower, Capitalize)
  - [ ] Indentation style (spaces/tabs, size)
  - [ ] Comma position (before/after)
  - [ ] Line width limit
- [ ] Per-database dialect support
- [ ] Add to editor toolbar
- [ ] Add to right-click context menu

**Suggested library:** `sql-formatter` (npm package)

---

### 4. Table Creation UI

**Status:** Not Implemented
**Impact:** High
**Effort:** Medium

Users can only view/edit existing tables. Cannot create new tables via GUI.

**Implementation Tasks:**
- [ ] Create Table dialog/wizard
- [ ] Column definition editor:
  - [ ] Name, data type, length/precision
  - [ ] Nullable checkbox
  - [ ] Default value input
  - [ ] Primary key checkbox
  - [ ] Auto-increment option
- [ ] Constraint editor:
  - [ ] Primary key (single/composite)
  - [ ] Foreign keys with reference picker
  - [ ] Unique constraints
  - [ ] Check constraints
- [ ] Index creation
- [ ] Preview generated DDL
- [ ] Execute with confirmation
- [ ] Template tables (common patterns)

---

## Medium Priority

### 5. Query Bookmarks & Templates

**Status:** Not Implemented
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [ ] Save query as bookmark
- [ ] Bookmark manager UI
- [ ] Organize bookmarks in folders
- [ ] Quick access panel/dropdown
- [ ] Search within bookmarks
- [ ] Share bookmarks between connections
- [ ] Built-in query templates:
  - [ ] Basic SELECT with JOIN
  - [ ] INSERT template
  - [ ] UPDATE template
  - [ ] DELETE with WHERE
  - [ ] Common aggregations
  - [ ] Index creation
- [ ] Custom template creation
- [ ] Template variables/placeholders

**Storage:** Add to Zustand store with localStorage persistence

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

**Status:** Basic implementation
**Impact:** Medium
**Effort:** Low

**Implementation Tasks:**
- [ ] Search within history
- [ ] Filter by:
  - [ ] Date range
  - [ ] Connection
  - [ ] Success/failure
  - [ ] Execution time
- [ ] Star/favorite queries
- [ ] History cleanup settings:
  - [ ] Max history items
  - [ ] Auto-delete after N days
  - [ ] Clear all button
- [ ] Export history
- [ ] Query execution statistics
- [ ] Duplicate detection

---

### 9. Data Grid Enhancements

**Status:** Functional
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Column reordering (drag & drop)
- [ ] Column hiding/showing
- [ ] Column pinning (freeze left/right)
- [ ] Row height configuration
- [ ] Cell value formatting options:
  - [ ] Date/time formats
  - [ ] Number formats
  - [ ] JSON pretty-print
- [ ] Conditional formatting (highlight cells)
- [ ] Column statistics (count, sum, avg, min, max)
- [ ] Copy cell/row/column
- [ ] Find & replace in results
- [ ] NULL value display customization
- [ ] Binary data preview (hex view)
- [ ] Image preview for BLOB/BYTEA

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

**Status:** Partial
**Impact:** Low
**Effort:** High

**Implementation Tasks:**
- [ ] Create/Edit/Drop Views
- [ ] Create/Edit/Drop Indexes
- [ ] Create/Edit/Drop Stored Procedures
- [ ] Create/Edit/Drop Functions
- [ ] Create/Edit/Drop Triggers
- [ ] Create/Edit/Drop Sequences
- [ ] User/Role management
- [ ] Permission management

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

**Status:** Not Implemented
**Impact:** Low
**Effort:** Low

**Implementation Tasks:**
- [ ] Group connections by environment (dev/staging/prod)
- [ ] Custom tags/labels
- [ ] Color coding
- [ ] Collapse/expand groups
- [ ] Filter by group/tag
- [ ] Bulk operations on groups

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

**Status:** Types defined, not implemented
**Impact:** High
**Effort:** High

**Implementation Tasks:**
- [ ] Add `mongodb` Rust crate dependency
- [ ] Implement `DatabaseDriver` trait for MongoDB
- [ ] Collection listing (equivalent to tables)
- [ ] Document querying with MongoDB query syntax
- [ ] Document CRUD operations
- [ ] Index management
- [ ] Aggregation pipeline support
- [ ] Schema inference for documents
- [ ] Connection string parsing
- [ ] Authentication (SCRAM, X.509)

---

### 16. Redis Driver

**Status:** Types defined, not implemented
**Impact:** Medium
**Effort:** Medium

**Implementation Tasks:**
- [ ] Add `redis` Rust crate dependency
- [ ] Key listing with pattern matching
- [ ] Key type detection
- [ ] Value viewing/editing per type:
  - [ ] Strings
  - [ ] Lists
  - [ ] Sets
  - [ ] Sorted Sets
  - [ ] Hashes
  - [ ] Streams
- [ ] TTL management
- [ ] Key deletion
- [ ] Redis CLI mode
- [ ] Pub/Sub viewer
- [ ] Memory usage statistics

---

### 17. Oracle Driver

**Status:** Types defined, not implemented
**Impact:** Medium
**Effort:** High

**Implementation Tasks:**
- [ ] Evaluate Rust Oracle crates (oracle, sibyl)
- [ ] Implement `DatabaseDriver` trait
- [ ] Handle Oracle-specific types (NUMBER, VARCHAR2, CLOB, BLOB)
- [ ] PL/SQL execution support
- [ ] Package/procedure browsing
- [ ] TNS connection string support
- [ ] Oracle Wallet authentication

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

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| P0 | Parameterized Queries (Security) | Critical | Medium |
| P1 | Data Import | High | Medium |
| P1 | Query Execution Plans | High | Medium |
| P1 | SQL Formatter | High | Low |
| P2 | Table Creation UI | High | Medium |
| P2 | Query Bookmarks | Medium | Low |
| P2 | Global Schema Search | Medium | Low |
| P2 | MongoDB Driver | High | High |
| P3 | Customizable Keybindings | Medium | Low |
| P3 | E2E Tests | High | High |
| P4 | Redis Driver | Medium | Medium |
| P4 | Oracle Driver | Medium | High |

---

## Version Milestones (Suggested)

### v0.3.0 - Data Management
- Data Import (CSV, JSON, SQL)
- SQL Formatter
- Query Bookmarks
- Parameterized Queries Fix

### v0.4.0 - Query Intelligence
- Query Execution Plans
- Query Validation
- Performance Warnings
- Global Schema Search

### v0.5.0 - Schema Management
- Table Creation UI
- Index Management
- View Management
- Schema Diff

### v0.6.0 - NoSQL Support
- MongoDB Driver
- Redis Driver
- Document Viewer

### v1.0.0 - Production Ready
- Full Test Coverage
- User Documentation
- Accessibility Compliance

---

*Last updated: January 2026*
*Generated from codebase analysis*
