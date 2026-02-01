# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dbfordevs is a cross-platform database management application built with Tauri 2.0 (Rust backend) and React 18 (TypeScript frontend). It provides a unified interface for PostgreSQL, MySQL, SQLite, Oracle, MSSQL, MongoDB, Redis, Cassandra and other databases with AI-powered query assistance.

## Development Commands

```bash
# Install dependencies
bun install

# Development (runs both Vite frontend and Tauri backend)
bun tauri dev

# Build for production
bun tauri build

# Frontend only (for UI development without Tauri)
bun dev

# Type check and build frontend
bun run build

# Bump version (updates package.json, Cargo.toml, and tauri.conf.json)
bun scripts/bump-version.ts
```

## Architecture

### Frontend (src/)
- **State Management**: Zustand stores with localStorage persistence in `src/stores/`
  - `useConnectionsStore` - Database connections, groups, tags
  - `useUIStore` - Theme, sidebar, modals, editor settings
  - `useQueryStore` - Tabs, query results, table schemas, query history
  - `useCRUDStore` - Row selection, cell editing, pending changes
  - `useViewsStore`, `useIndexesStore`, `useProceduresStore`, `useFunctionsStore`, `useTriggersStore`, `useSequencesStore` - Database object management
  - `useUsersStore` - Users, roles, and permissions
  - `useGridStore` - Grid display settings and formatting
  - `useDiffStore` - Schema diff state and snapshots
  - `useSchemaSearchStore` - Global schema search
- **Tauri Bridge**: All backend calls via `useDatabase` hook (`src/hooks/useDatabase.ts`) which wraps Tauri `invoke()` calls
- **Components**: Radix UI primitives styled with Tailwind in `src/components/ui/`
- **Editor**: Monaco editor with SQL syntax highlighting in `src/components/editor/`

### Backend (src-tauri/)
- **Commands** (`src-tauri/src/commands/`): Tauri IPC handlers for connections, queries, tables
- **Database Layer** (`src-tauri/src/db/`): sqlx-based async connection pooling with driver-specific implementations (postgres.rs, mysql.rs, sqlite.rs, oracle.rs, mssql.rs, mongodb.rs, redis.rs, cassandra.rs)
- **Connection Manager**: `src-tauri/src/db/manager.rs` - manages active connection pools per connection ID

### AI Integration (Built-in)
- **Location**: `src/lib/ai/` - Built-in AI assistant (not extension-based)
- **SDK**: Uses Vercel AI SDK (`ai` package) with custom Tauri fetch adapter (`src/lib/ai/tauri-fetch.ts`)
- **Providers**: Multi-provider support for Anthropic Claude, OpenAI GPT, Google Gemini
- **Features**:
  - Context-aware: Extracts @table references and fetches schemas automatically
  - Streaming support with token usage tracking
  - Session-based chat history with usage statistics
  - Query generation, explanation, and optimization
- **Store**: `src/lib/ai/store.ts` - Zustand store for AI state management
- **Components**: `src/components/ai/` - AI panel UI components

### Themes
- **Built-in Themes**: Light, Dark, System (auto), Nordic Dark, Nordic Light, Solarized Dark, Solarized Light
- **Theme System**: CSS custom properties in `src/index.css`
- **Theme Switching**: Managed by `useUIStore` in `src/stores/ui.ts`
- **Monaco Editor**: Theme mapping in `src/components/editor/monaco-themes.ts`

## Key Patterns

### Adding a Tauri Command
1. Define handler in `src-tauri/src/commands/*.rs`
2. Register in `tauri::generate_handler![]` macro in `src-tauri/src/lib.rs`
3. Create TypeScript wrapper in `useDatabase` hook or appropriate API layer

### Adding a Zustand Store
1. Create store file in `src/stores/`
2. Use `persist` middleware with `partialize` for selective persistence
3. Export from `src/stores/index.ts`

### Database Driver Pattern
- Each database type implements the same query/table/schema interface
- Type mappings in respective driver files (e.g., `postgres_type_to_string()`)
- Connection pools are enum variants in `ConnectionPool`

### Component Structure
- UI primitives in `components/ui/` (buttons, dialogs, etc.)
- Feature components in domain folders (e.g., `components/ai/`, `components/connections/`)
- Layout components in `components/layout/`

## Configuration Files

- `src-tauri/tauri.conf.json` - Tauri app config (window, permissions, plugins)
- `tailwind.config.js` - TailwindCSS theme customization
- `components.json` - shadcn/ui configuration
- `tsconfig.json` - TypeScript with strict mode enabled

## Database Support Status

- **Fully Implemented**: PostgreSQL, MySQL, SQLite, Oracle, MSSQL, MongoDB, Redis, Cassandra

## Recent Features (v0.5.x)

- **Schema Diff**: Compare schemas across connections/tables/snapshots with migration script generation
- **Global Schema Search**: Search across tables, columns, views, procedures, and more (Ctrl+Shift+F)
- **Cassandra Support**: Full NoSQL support with CQL Shell, keyspace management, and cluster info
- **MongoDB & Redis**: Complete driver implementations with connection management and UI
- **MSSQL Enhancements**: Named instance support, SQL Server Browser, database create/delete
- **Oracle Wallet Support**: Secure authentication using Oracle Wallet
- **SSL/TLS Testing**: Built-in feature for testing secure database connections
- **Connection Groups & Tags**: Organize connections with groups and custom tags
- **Tab Pinning**: Pin important query tabs to prevent accidental closure
- **Solarized & Classic Themes**: Additional theme options
- **Database Objects Management**: Create and manage procedures, functions, triggers, and sequences
- **User/Role Management**: Full user, role, and permission management
- **AI Context Management**: Enhanced AI assistant with NoSQL database context awareness
- **Query Bookmarks & Templates**: Save, organize, and reuse queries with template variables
- **Table Creation Wizard**: 5-step guided UI for creating tables with constraints and indexes
- **SQL Formatting**: One-click SQL beautification with dialect-aware formatting
- **Query Execution Plans**: Visual EXPLAIN output with interactive tree view
- **Data Import**: CSV, JSON, SQL import with column mapping and progress tracking
- **SSH Tunneling**: Secure database connections through SSH tunnels
- **SSL Configuration**: Full SSL/TLS support with certificate configuration
- **Data Grid Global Search**: Search across all columns in data grid results
- **Schema-Aware SQL Autocomplete**: Table and column suggestions in Monaco editor
