# Contributing to dbfordevs

Thank you for your interest in contributing to **dbfordevs**! We welcome contributions from the community to help make this database management tool even better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Architecture Patterns](#architecture-patterns)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Ways to Contribute

There are many ways to contribute to dbfordevs:

- **Report bugs**: Open an issue describing the bug, steps to reproduce, and your environment
- **Suggest features**: Propose new features or enhancements via GitHub issues
- **Write documentation**: Improve existing docs or add new guides
- **Fix bugs**: Pick up issues labeled `bug` or `good first issue`
- **Add features**: Implement new functionality (discuss in an issue first for larger features)
- **Improve tests**: Add test coverage or improve existing tests
- **Code review**: Review open pull requests and provide constructive feedback

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Rust**: Install via [rustup](https://rustup.rs/)
- **Bun**: Install via [bun.sh](https://bun.sh/)
- **Tauri Dependencies**: Follow the [Tauri setup guide](https://tauri.app/v1/guides/getting-started/prerequisites) for your OS
- **Git**: For version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/dbfordevs.git
   cd dbfordevs
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/danielss-dev/dbfordevs.git
   ```

### Install Dependencies

```bash
bun install
```

### Run Development Server

```bash
bun tauri dev
```

This will start both the Vite frontend dev server and the Tauri application.

### Frontend-Only Development

For UI-only changes without the Tauri backend:

```bash
bun dev
```

## Development Workflow

### Using Graphite (Recommended)

This project uses [Graphite](https://graphite.dev/) for managing stacked pull requests. See [docs/GRAPHITE.md](docs/GRAPHITE.md) for detailed instructions.

Quick start:
```bash
# Install Graphite CLI
bun install -g @withgraphite/graphite-cli

# Authenticate
gt auth

# Initialize in the repo
gt init

# Create a new branch
gt create my-feature-branch

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Submit PR
gt submit
```

### Traditional Git Workflow

If you prefer not to use Graphite:

1. Create a new branch from `master`:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Make your changes
3. Commit using [conventional commits](#commit-conventions)
4. Push to your fork:
   ```bash
   git push origin feature/my-feature
   ```
5. Open a pull request on GitHub

## Coding Standards

### TypeScript/React (Frontend)

- Use **TypeScript** with strict mode enabled
- Follow existing component patterns in `src/components/`
- Use **Tailwind CSS** for styling
- Use **shadcn/ui** and **Radix UI** primitives for UI components
- Prefer functional components with hooks
- Use **Zustand** for state management (see [Architecture Patterns](#architecture-patterns))

### Rust (Backend)

- Follow Rust's official style guide (`cargo fmt`)
- Run `cargo clippy` and fix all warnings before submitting
- Write async code using `tokio`
- Use `sqlx` for database operations
- Follow the Tauri command pattern (see [Architecture Patterns](#architecture-patterns))

### General

- Keep PRs focused and small
- Write clear, self-documenting code
- Add comments only where logic is not obvious
- Update documentation when changing behavior
- Ensure code builds without warnings

## Commit Conventions

We "follow" [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without changing behavior
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependency updates, build config, etc.)
- `ci`: CI/CD changes

### Examples

```bash
feat(ai): add support for Gemini AI provider
fix(connections): resolve SQLite connection timeout issue
docs(readme): update installation instructions
refactor(stores): simplify query store logic
```

If you want, you can use an AI tool to create the commit message.

## Pull Request Process

1. **Before Opening a PR**:
   - Ensure your code builds: `bun run build` and `cargo build`
   - Run type checks: `tsc --noEmit`
   - Test manually in development mode
   - Update documentation if needed
   - Add tests for new features

2. **Opening a PR**:
   - Use a clear, descriptive title following conventional commit format
   - Fill out the PR description template (if available)
   - Link related issues using `Closes #123` or `Fixes #456`
   - Add screenshots/videos for UI changes
   - Mark as draft if work is in progress

3. **PR Review**:
   - Address reviewer feedback promptly
   - Keep discussions focused and constructive
   - Request re-review after making changes
   - Use `git commit --amend` or fixup commits, then squash before merge

4. **Merging**:
   - PRs require approval from maintainers
   - Ensure CI checks pass
   - Use "Squash and merge" for clean history
   - Delete branch after merging

## Testing

### Frontend Testing

Frontend tests use Vitest with 86+ test cases covering utilities, connection parsing, export functions, and query history.

```bash
bun test          # Run tests in watch mode
bun test:run      # Run tests once
bun test:coverage # Run with coverage
```

- Manual testing in `bun tauri dev` is required for all UI changes
- Test across different themes (Light, Dark, Nordic, Solarized)
- Contributions to improve test coverage are welcome

### Backend Testing

Rust tests include unit tests and integration tests using testcontainers:

```bash
cd src-tauri
cargo test --lib                    # Unit tests only
cargo test --test sqlite_integration # SQLite (no Docker needed)
cargo test                          # All tests (Docker required for PG/MySQL)
```

- Test database operations with PostgreSQL, MySQL, and SQLite
- Ensure error handling works correctly
- Verify connection pooling behavior

### Manual Testing Checklist

For significant changes, test:
- [ ] Fresh install works (`bun install` + `bun tauri dev`)
- [ ] Production build works (`bun tauri build`)
- [ ] Database connections (PostgreSQL, MySQL, SQLite, MSSQL, Oracle, MongoDB, Redis, Cassandra)
- [ ] AI assistant functionality (if applicable)
- [ ] Theme switching
- [ ] Data editing and diff preview

## Architecture Patterns

Familiarize yourself with these key patterns before contributing:

### Adding a Tauri Command

1. Define handler in `src-tauri/src/commands/*.rs`:
   ```rust
   #[tauri::command]
   pub async fn my_command(arg: String) -> Result<String, String> {
       // Implementation
       Ok(result)
   }
   ```

2. Register in `src-tauri/src/lib.rs`:
   ```rust
   tauri::generate_handler![
       // ... other commands
       my_command
   ]
   ```

3. Create TypeScript wrapper in `src/hooks/useDatabase.ts`:
   ```typescript
   const myCommand = async (arg: string) => {
     return await invoke<string>('my_command', { arg });
   };
   ```

### Adding a Zustand Store

1. Create store in `src/stores/`:
   ```typescript
   export const useMyStore = create<MyState>()(
     persist(
       (set) => ({
         // state and actions
       }),
       {
         name: 'my-store',
         partialize: (state) => ({ /* selective persistence */ }),
       }
     )
   );
   ```

2. Export from `src/stores/index.ts`

### Database Driver Pattern

- Implement database operations in `src-tauri/src/db/<driver>.rs`
- Each driver implements the same interface
- Connection pools are managed in `src-tauri/src/db/manager.rs`

For more details, see [CLAUDE.md](CLAUDE.md).

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/danielss-dev/dbfordevs/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/danielss-dev/dbfordevs/issues)
- **Documentation**: Check [docs/](docs/) folder for guides
- **Graphite Workflow**: See [docs/GRAPHITE.md](docs/GRAPHITE.md)

## Version Bumping

When releasing a new version, use the built-in script:

```bash
bun scripts/bump-version.ts
```

This updates `package.json`, `Cargo.toml`, and `tauri.conf.json` automatically.

---

## License

By contributing to dbfordevs, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to dbfordevs! Your efforts help make database management better for developers everywhere.
