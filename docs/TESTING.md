# Testing Guide

This document describes the test structure and how to run tests in the dbfordevs project.

## Overview

The project includes two types of tests:

- **TypeScript Unit Tests** - Testing frontend utilities, hooks, and functions
- **Rust Integration Tests** - Testing database drivers and backend functionality

### Test Statistics

| Category | Tests | Status |
|----------|-------|--------|
| TypeScript Unit Tests | 86 | ✅ All passing |
| Rust Unit Tests | 16 | ✅ All passing |
| SQLite Integration Tests | 14 | ✅ All passing |
| PostgreSQL Integration Tests | 11 | ✅ All passing (requires Docker) |
| MySQL Integration Tests | 10 | ✅ All passing (requires Docker) |
| **Total** | **137** | ✅ All passing |

## TypeScript Tests

### Location
```
src/__tests__/
├── lib/
│   ├── utils.test.ts               (16 tests)
│   ├── export-utils.test.ts        (17 tests)
│   └── connection-string-parser.test.ts (37 tests)
├── components/
│   └── query-history-utils.test.ts (16 tests)
└── setup.ts                         (Vitest configuration)
```

### Running TypeScript Tests

```bash
# Run tests in watch mode
bun test

# Run tests once
bun test:run

# Run tests with coverage
bun test:coverage
```

### Test Coverage

#### utils.test.ts (16 tests)
Tests for utility functions in `src/lib/utils.ts`:

- **cn()** - Class name utility function
  - Merging class names
  - Handling conditional classes
  - Merging Tailwind CSS classes
  - Handling arrays and objects

- **formatTimestamp()** - Timestamp parsing and formatting
  - ISO 8601 format parsing (with T separator)
  - Space-separated format
  - Milliseconds handling
  - Timezone parsing (positive offset, negative offset, Z for UTC)
  - NULL/invalid format handling

#### export-utils.test.ts (17 tests)
Tests for data export functions in `src/lib/export-utils.ts`:

- **rowsToInsertSQL()** - Generate INSERT statements
  - Basic INSERT statement generation
  - NULL value handling
  - Single quote escaping
  - JSON/JSONB handling
  - Empty rows
  - Table name inference

- **rowsToJSON()** - Export to JSON
  - JSON array generation
  - Proper formatting/indentation

- **rowsToCSV()** - Export to CSV
  - Header row generation
  - CSV value escaping (commas, quotes, newlines)
  - NULL handling
  - With/without headers

#### connection-string-parser.test.ts (37 tests)
Tests for connection string parsing in `src/lib/connection-string-parser.ts`:

- **detectDatabaseType()** - Identify database type from connection string
  - PostgreSQL detection (postgresql://, postgres://)
  - MySQL detection (mysql://)
  - MariaDB detection (mariadb://)
  - MSSQL detection (Server=, Data Source=)
  - CockroachDB detection
  - Case insensitivity
  - Whitespace handling

- **parseConnectionString()** - Parse connection strings
  - PostgreSQL URLs with credentials, port, query parameters
  - MySQL URLs with credentials and port
  - MSSQL connection strings with various key formats
  - URL-encoded credentials
  - Quoted values in MSSQL strings
  - Error handling for invalid formats

- **validateParsedConnection()** - Validate parsed connection config
  - Required field validation (host, database)
  - Error message generation

#### query-history-utils.test.ts (16 tests)
Tests for query history utilities in `src/components/query-history/query-history-utils.ts`:

- **formatRelativeTime()** - Format timestamps relative to now
  - "just now" for recent timestamps
  - Minutes, hours, days formatting
  - Uses fake timers for reliable testing

- **formatExecutionTime()** - Format query execution time
  - Milliseconds for times < 1 second
  - Seconds with 2 decimal places for times >= 1 second
  - Undefined handling

- **truncateSQL()** - Truncate and clean SQL statements
  - Whitespace collapsing
  - Truncation with ellipsis
  - Custom max length
  - Trimming

## Rust Tests

### Unit Tests

Location: `src-tauri/src/db/common.rs`

**16 built-in unit tests** covering:
- CTE (Common Table Expression) parsing
- SQLite identifier escaping
- Multi-database SQL parsing (PostgreSQL, MySQL, SQLite)

Run with:
```bash
cd src-tauri
cargo test --lib
```

### Integration Tests

#### Setup

Integration tests require **Docker** to be running for PostgreSQL and MySQL tests.

Dependencies added to `Cargo.toml`:
- `testcontainers` - Container lifecycle management
- `testcontainers-modules` - Pre-built containers (PostgreSQL, MySQL)
- `tokio-test` - Async test utilities
- `tempfile` - Temporary file handling for SQLite

#### SQLite Integration Tests

**Location:** `src-tauri/tests/sqlite_integration.rs`
**Tests:** 14
**Requirements:** None (no Docker needed, uses temporary files)

Tests database operations:
- Connection testing
- SELECT query execution
- CREATE TABLE and INSERT operations
- Table enumeration and schema inspection
- Foreign key relationships
- DDL generation
- Multiple statements in single query
- CRUD operations (UPDATE, DELETE)
- Table renaming
- Index handling
- NULL value handling
- Transaction behavior

Run with:
```bash
cd src-tauri
cargo test --test sqlite_integration
```

#### PostgreSQL Integration Tests

**Location:** `src-tauri/tests/postgres_integration.rs`
**Tests:** 11
**Requirements:** Docker with PostgreSQL image

Tests database operations:
- Connection testing
- SELECT query execution
- CREATE TABLE and INSERT
- Table listing and schema inspection
- Foreign key relationships
- Multiple statement execution
- DDL generation
- Data type handling (UUID, JSON, arrays, timestamps)
- NULL value handling
- Transaction rollback on constraint violations

Run with:
```bash
cd src-tauri
cargo test --test postgres_integration
```

#### MySQL Integration Tests

**Location:** `src-tauri/tests/mysql_integration.rs`
**Tests:** 10
**Requirements:** Docker with MySQL image

Tests database operations:
- Connection testing
- SELECT query execution
- CREATE TABLE and INSERT
- Table listing and schema inspection
- Foreign key relationships
- DDL generation
- Data type handling
- NULL value handling
- UPDATE and DELETE operations

Run with:
```bash
cd src-tauri
cargo test --test mysql_integration
```

### Test Utilities

**Location:** `src-tauri/tests/common/mod.rs`

Helper functions for creating connection configs:
```rust
fn postgres_config(host, port, database, user, password) -> ConnectionConfig
fn mysql_config(host, port, database, user, password) -> ConnectionConfig
fn sqlite_config(file_path) -> ConnectionConfig
```

### Running All Rust Tests

```bash
cd src-tauri

# Run all tests (unit + integration)
cargo test

# Run only unit tests
cargo test --lib

# Run only SQLite integration (no Docker needed)
cargo test --test sqlite_integration

# Run only PostgreSQL integration (requires Docker)
cargo test --test postgres_integration

# Run only MySQL integration (requires Docker)
cargo test --test mysql_integration

# Run specific test
cargo test test_postgres_connection

# Run with output
cargo test -- --nocapture
```

## Test Configuration Files

### TypeScript

- **vitest.config.ts** - Vitest configuration
  - jsdom environment for browser APIs
  - Global test utilities
  - Path aliases (@/ → src/)
  - Test file patterns

- **tsconfig.test.json** - TypeScript config for tests
  - Extends main tsconfig
  - Adds vitest globals type definitions
  - Includes test files

- **src/__tests__/setup.ts** - Test setup file
  - Imports jest-dom matchers
  - Mocks Tauri API calls

### Rust

- **vitest.config.ts** - Main Vitest configuration
- **src-tauri/Cargo.toml** - Dev dependencies for tests
  - testcontainers
  - testcontainers-modules
  - tokio-test
  - tempfile

## CI/CD Integration

To add tests to CI/CD pipeline:

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  typescript-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:run

  rust-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpass123
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: cd src-tauri && cargo test
```

## Debugging Tests

### TypeScript

```bash
# Run with verbose output
bun test -- --reporter=verbose

# Run specific test file
bun test -- src/__tests__/lib/utils.test.ts

# Run tests matching pattern
bun test -- --grep "formatTimestamp"
```

### Rust

```bash
# Run with backtrace on failure
RUST_BACKTRACE=1 cargo test

# Run single test
cargo test test_postgres_connection

# Show println output
cargo test -- --nocapture

# Run tests sequentially (useful for debugging)
cargo test -- --test-threads=1
```

## Writing New Tests

### Adding a TypeScript Test

1. Create file in `src/__tests__/` matching the source file structure
2. Use `.test.ts` or `.test.tsx` extension
3. Import `describe`, `it`, `expect` from vitest
4. Write test cases:

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "@/lib/utils";

describe("myFunction", () => {
  it("should do something", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

### Adding a Rust Integration Test

1. Create test function with `#[tokio::test]` attribute
2. Use `testcontainers` to manage containers
3. Create connection configs using helpers in `tests/common/mod.rs`
4. Execute database operations
5. Assert results:

```rust
#[tokio::test]
async fn test_something() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    // Test database operations
    let result = driver.execute_query(...).await;
    assert!(result.is_ok());
}
```

## Troubleshooting

### TypeScript Tests

**Issue:** `Cannot find name 'vi'`
- **Solution:** Ensure `vitest/globals` types are in `tsconfig.test.json` and `setup.ts` has the reference comment

**Issue:** Tests not discovered
- **Solution:** Check file extension is `.test.ts` or `.test.tsx` and matches pattern in `vitest.config.ts`

### Rust Tests

**Issue:** Docker connection refused
- **Solution:** Ensure Docker daemon is running
- Check with: `docker ps`

**Issue:** Port already in use
- **Solution:** Testcontainers finds random free ports automatically
- Kill existing containers: `docker stop $(docker ps -q)`

**Issue:** Type inference errors in IDE
- **Solution:** Restart rust-analyzer
- VS Code: `Ctrl+Shift+P` → "Rust Analyzer: Restart Server"
- Or run: `cd src-tauri && cargo check --tests`

**Issue:** MySQL tests fail with auth error
- **Solution:** Check `MYSQL_PASSWORD` constant in `tests/mysql_integration.rs` matches container config

## Best Practices

1. **Test one thing per test** - Keep tests focused and simple
2. **Use descriptive names** - Test name should describe what's being tested
3. **Arrange-Act-Assert** - Organize tests into setup, action, verification
4. **Mock external dependencies** - Use mocks for Tauri API calls
5. **Clean up resources** - Close database connections, temp files after tests
6. **Use test utilities** - Reuse common setup code in helpers
7. **Test edge cases** - NULL values, empty strings, large numbers, special characters
8. **Document complex tests** - Add comments for non-obvious test logic

## Performance

- TypeScript tests: ~10 seconds total
- SQLite integration tests: ~0.1 seconds total
- PostgreSQL integration tests: ~8 seconds total (includes Docker startup)
- MySQL integration tests: ~47 seconds total (includes Docker startup)
- Rust unit tests: ~0 seconds (nearly instant)

**Total test suite:** ~65 seconds (with Docker containers)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Cargo Test Documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- [testcontainers-rs](https://github.com/testcontainers/testcontainers-rs)
- [sqlx Documentation](https://github.com/launchbadge/sqlx)
