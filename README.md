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

- **Unified Interface:** Manage PostgreSQL, MySQL, MSSQL, SQLite, MongoDB, and Redis from a single app.
- **Lightweight & Fast:** Minimal memory footprint (< 200MB) and near-instant startup.
- **Plugin Marketplace:** Extensible architecture for specialized tools.
- **Connection String Validators:** Built-in support for C#, Node.js, and Python connection string formats.
- **Visual Diff Preview:** Review all data changes before committing them to the database.
- **Side Panel Editor:** High-performance data grid with a comfortable side-panel for editing complex records.
- **AI-Powered Assistance:** Generate, analyze, and optimize SQL queries using LLMs.

## 🛠️ Tech Stack

- **Frontend:** React 18+, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend:** Rust, Tauri 2.x
- **State Management:** Zustand
- **Database Drivers:** SQLx (PostgreSQL, MySQL, SQLite, MSSQL), MongoDB, Redis
- **Package Manager:** Bun

## 📁 Project Structure

```text
dbfordevs/
├── src/                    # React frontend
├── src-tauri/              # Tauri application core (Rust)
├── crates/                 # Shared workspace crates
│   ├── plugin-core/        # Shared plugin architecture
│   ├── validator-core/     # Connection validator traits
│   ├── validator-csharp/   # C#/.NET validator implementation
│   ├── validator-nodejs/   # Node.js validator implementation
│   └── validator-python/   # Python validator implementation
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

## 🧩 Plugin System

dbfordevs uses a modular architecture where features like connection validators are implemented as independent Rust crates. This keeps the core application lean while allowing for powerful extensions.

Interested in building a plugin? See `crates/plugin-core` for the base traits.

## 📄 License

This project's core is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details. 

The plugin architecture is designed to support a dual-licensing model, allowing for both open-source and proprietary extensions within the marketplace.

---

Built with ❤️ by Daniels

