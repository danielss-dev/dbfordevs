# DataGrip Features Gap Analysis

This document lists features from [JetBrains DataGrip](https://www.jetbrains.com/datagrip/features/) that dbfordevs is currently lacking and would be valuable to implement.

## Priority Legend

- 🔴 **High Priority** - Core functionality that significantly improves UX
- 🟡 **Medium Priority** - Nice-to-have features that enhance productivity
- 🟢 **Low Priority** - Advanced features for power users

---

## 1. Schema Diff & Migration Scripts ✅ IMPLEMENTED

**DataGrip Feature:** Compare schemas between databases and generate migration scripts automatically.

**Current State:** Fully implemented in v0.5.0. Includes 3-step wizard UI, comparison across connections/tables/snapshots, database-specific migration SQL generation, and export functionality.

**What's Implemented:**
- Compare table structures between two connections/schemas
- Visual diff highlighting (added/removed/modified columns, indexes, constraints)
- Generate ALTER TABLE migration scripts per database dialect
- Support for all database types (PostgreSQL, MySQL, SQLite, Oracle, MSSQL)
- Export migration scripts to file
- Point-in-time schema snapshots

---

## ~~2. Data Comparison Between Tables/Query Results~~ ✅

**DataGrip Feature:** Diff viewer to compare tables or query results with tolerance parameters.

**Current State:** **Implemented in v0.6.x** - Full data comparison feature with table vs table and query vs query modes, side-by-side grids with row/cell-level diff highlighting, configurable key columns, tolerance options (ignore case, whitespace, numeric tolerance, null handling), filter modes, synchronized scrolling, and CSV/JSON export.

---

## 3. Parameterized Queries 🔴

**DataGrip Feature:** Run parameterized SQL queries with user-defined parameter patterns.

**Current State:** Queries are executed as raw SQL strings only.

**Implementation Scope:**
- Support `$1`, `:param`, `@param`, `?` syntax
- Parameter input dialog before execution
- Save parameter values per query/template
- Parameter history
- Type hints for parameters

---

## 4. Foreign Key Navigation in Data Grid 🟡

**DataGrip Feature:** Navigate through data by clicking on foreign key values to jump to referenced rows.

**Current State:** FK validation exists but no click-to-navigate.

**Implementation Scope:**
- Clickable FK cells with link indicator
- Navigate to referenced table/row
- Breadcrumb trail for navigation history
- "Go back" functionality
- Preview referenced row on hover

---

## 5. Smart Context-Aware Code Completion 🟡

**DataGrip Feature:** Schema-aware completion that understands JOINs, subqueries, and aliases.

**Current State:** Schema-aware completion for keywords, tables, and columns with dot notation and FROM/JOIN context. Implemented via Monaco completion provider.

**Implementation Scope:**
- Alias-aware completion (e.g., `u.` resolves to `users` table columns)
- Suggest JOIN conditions based on FK relationships
- Subquery context awareness
- Function parameter hints
- Snippet suggestions for common patterns

---

## 6. Code Analysis & Quick-Fixes 🟡

**DataGrip Feature:** Detect SQL bugs, unresolved objects, and suggest fixes on-the-fly.

**Current State:** Monaco editor provides basic syntax highlighting only.

**Implementation Scope:**
- Validate table/column references against schema
- Highlight unresolved identifiers
- Suggest fixes (typo correction, missing table)
- Warn about N+1 query patterns
- Performance anti-pattern detection

---

## 7. Refactoring & Find Usages 🟡

**DataGrip Feature:** Find where tables/columns are used across procedures, functions, and views. Rename objects with cascade.

**Current State:** Not implemented.

**Implementation Scope:**
- "Find usages" for tables, columns, procedures
- Search across saved queries, templates, and bookmarks
- Rename refactoring with preview
- Impact analysis before changes

---

## 8. Customizable Keyboard Shortcuts 🟡

**DataGrip Feature:** Fully customizable keymap for all actions.

**Current State:** Shortcuts are displayed in Settings but not customizable (view-only).

**Implementation Scope:**
- Settings UI for keybinding customization
- Conflict detection
- Import/export keymap profiles
- Context-specific bindings (editor vs grid)
- Reset to defaults

---

## 9. VCS / Git Integration 🟡

**DataGrip Feature:** Unified interface for Git and other VCS systems, including GitHub integration.

**Current State:** No VCS integration.

**Implementation Scope:**
- Track changes to saved queries/templates
- Version history for query files
- Git diff for query modifications
- GitHub Gist integration for sharing queries
- Sync queries across devices via Git repo

---

## 10. Run Configurations 🟡

**DataGrip Feature:** Run script files in sequence without opening them, with pre-run tasks.

**Current State:** Not implemented.

**Implementation Scope:**
- Create named run configurations
- Add multiple script files in order
- Select target schemas/connections
- Pre-run and post-run hooks
- Save and share configurations

---

## 11. DDL Data Source 🟢

**DataGrip Feature:** Use SQL files containing DDL statements as virtual data sources for code completion and validation.

**Current State:** Not implemented.

**Implementation Scope:**
- Import .sql files as schema definitions
- Code completion from DDL files
- Map DDL source to real database
- Two-way sync (file ↔ database)
- Useful for development without live database

---

## 12. Enhanced Export Formats 🟢

**DataGrip Feature:** Export to CSV, JSON, HTML, Markdown, Excel with custom scripting.

**Current State:** CSV, JSON, and SQL INSERT are supported.

**Implementation Scope:**
- Excel (.xlsx) export
- HTML table export
- Markdown table export
- Custom export templates (scripting)
- Batch export multiple tables

---

## 13. Localization / i18n 🟢

**DataGrip Feature:** UI available in Chinese, Japanese, and Korean.

**Current State:** English only.

**Implementation Scope:**
- i18n framework integration (react-i18next)
- Extract all UI strings
- Initial language packs: English, Spanish, Chinese
- Language switcher in settings
- Community translation contributions

---

## 14. Query Console Modes 🟢

**DataGrip Feature:** Read-only mode, results-in-editor mode, manual transaction committing.

**Current State:** Single execution mode.

**Implementation Scope:**
- Read-only mode toggle (prevent accidental writes)
- Manual commit/rollback controls
- Transaction indicator in status bar
- Results inline in editor option
- Statement-level vs script-level execution

---

## Summary

| Priority | Feature | Effort | Status |
|----------|---------|--------|--------|
| ~~🔴 High~~ | ~~Schema Diff & Migration Scripts~~ | ~~Large~~ | **Implemented** |
| ~~🔴 High~~ | ~~Data Comparison~~ | ~~Medium~~ | **Implemented** |
| 🔴 High | Parameterized Queries | Medium | Not Started |
| 🟡 Medium | Foreign Key Navigation | Small | Not Started |
| 🟡 Medium | Smart Code Completion | Medium | Partial (basic schema-aware) |
| 🟡 Medium | Code Analysis & Quick-Fixes | Large | Not Started |
| 🟡 Medium | Refactoring & Find Usages | Medium | Not Started |
| 🟡 Medium | Customizable Shortcuts | Small | Not Started |
| 🟡 Medium | VCS / Git Integration | Medium | Not Started |
| 🟡 Medium | Run Configurations | Medium | Not Started |
| 🟢 Low | DDL Data Source | Large | Not Started |
| 🟢 Low | Enhanced Export Formats | Small | Not Started |
| 🟢 Low | Localization | Medium | Not Started |
| 🟢 Low | Query Console Modes | Small | Not Started |

---

## Recommended Implementation Order

1. **Parameterized Queries** - Essential for real-world database work
2. **Foreign Key Navigation** - Quick win, builds on existing FK validation
3. **Customizable Shortcuts** - Already in roadmap, small effort
4. ~~**Schema Diff**~~ - **Already implemented** in v0.5.0
5. ~~**Data Comparison**~~ - **Already implemented** in v0.6.x
6. **Enhanced Export** - Quick wins with Excel/Markdown/HTML
7. **Smart Code Completion** - Extend existing schema-aware provider with alias resolution
8. **Run Configurations** - Workflow automation
9. **Code Analysis** - Long-term quality feature
