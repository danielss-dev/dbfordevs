# dbfordevs

[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Bun](https://img.shields.io/badge/Bun-latest-fbf0df?logo=bun&logoColor=black)](https://bun.sh/)

**dbfordevs** is a modern, lightweight, cross-platform database management application designed specifically for developers. Built with **Tauri 2.0**, **React**, and **Rust**, it focuses on speed, security, and a superior developer experience.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/dbfordevs_dark.png">
    <img alt="dbfordevs Preview" src="docs/images/dbfordevs_light.png" width="100%">
  </picture>
</p>

## 🚀 Key Features

- **Unified Interface:** Manage PostgreSQL, MySQL, MSSQL, SQLite, Oracle, MongoDB, Redis, and Cassandra from a single app.
- **Lightweight & Fast:** Minimal memory footprint (< 200MB) and near-instant startup.
- **Visual Diff Preview:** Review all data changes before committing them to the database.
- **Side Panel Editor:** High-performance data grid with a comfortable side-panel for editing complex records.
- **AI-Powered Assistance:** Built-in AI assistant to generate, explain, and optimize SQL queries using Claude, GPT, or Gemini.
- **Multiple Themes:** Choose from Light, Dark, Nordic Dark, Nordic Light, Solarized Dark, Solarized Light, or System auto-switching.
- **Schema Diff:** Compare database schemas and visualize differences between connections.
- **Query Execution Plans:** Visualize EXPLAIN output with interactive tree view and cost analysis.
- **SQL Formatting:** One-click SQL beautification with configurable options per database dialect.
- **Query Bookmarks & Templates:** Save, organize, and reuse frequently used queries with folder organization and template variables.
- **Data Import:** Import CSV, JSON, and SQL files with column mapping and duplicate handling.
- **Table Creation Wizard:** Create tables with a guided UI for columns, constraints, indexes, and foreign keys.
- **View & Index Management:** Create, view DDL, and drop views and indexes directly from the sidebar.
- **User & Role Management:** Manage database users, roles, and permissions with an intuitive UI.
- **Query History:** Search, filter, favorite, and export your query execution history with statistics.
- **Advanced Data Grid:** Column pinning, conditional formatting, find & replace, binary preview, and more.
- **SSH Tunneling & SSL:** Secure connections through SSH tunnels and SSL/TLS encryption.
- **Connection Organization:** Group and tag connections for better organization.

## 🛠️ Tech Stack

- **Frontend:** React 18+, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend:** Rust, Tauri 2.x
- **State Management:** Zustand
- **Database Drivers:** SQLx (PostgreSQL, MySQL, SQLite, MSSQL), Oracle, MongoDB, Redis, Cassandra
- **Package Manager:** Bun

## 📁 Project Structure

```text
dbfordevs/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ai/             # AI assistant panel
│   │   ├── bookmarks/      # Query bookmarks & templates
│   │   ├── connections/    # Connection management (SSH, SSL)
│   │   ├── data-grid/      # Data grid with import/export
│   │   ├── editor/         # SQL editor with formatting
│   │   ├── explain/        # Query execution plan visualization
│   │   ├── query-history/  # Query history panel
│   │   ├── table/          # Table creation wizard
│   │   └── users/          # User & role management
│   ├── lib/ai/             # Built-in AI assistant
│   ├── stores/             # Zustand state management
│   └── hooks/              # React hooks
├── src-tauri/              # Tauri application core (Rust)
│   ├── src/commands/       # Tauri IPC command handlers (views, indexes, users)
│   └── src/db/             # Database drivers (PostgreSQL, MySQL, SQLite, MSSQL, Oracle)
├── public/                 # Static assets
└── docs/                   # Project documentation & PRD
```

## 📖 Documentation

For more detailed information, please refer to the documentation in the `docs/` folder:

- **[Getting Started](docs/GETTING_STARTED.md)**: Installation and first steps.
- **[User Guide](docs/USER_GUIDE.md)**: Comprehensive guide on using the application.
- **[Architecture](docs/ARCHITECTURE.md)**: Technical details about the system.
- **[Graphite Workflow](docs/GRAPHITE.md)**: Guide for developers on using Graphite for stacked PRs.

## 🚦 Getting Started

### Prerequisites

- **Rust:** Install via [rustup](https://rustup.rs/)
- **Bun:** Install via [bun.sh](https://bun.sh/)
- **Tauri Dependencies:** Follow the [Tauri setup guide](https://tauri.app/v1/guides/getting-started/prerequisites) for your OS.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/dschwarz/dbfordevs.git
   cd dbfordevs
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run in development mode:
   ```bash
   bun tauri dev
   ```

### Building for Production

```bash
bun tauri build
```

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by Daniels

