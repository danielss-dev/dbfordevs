# Database drivers

How a new engine is allowed to exist in dbfordevs without exploding `DatabaseDriver`, `PoolRef`, the IPC list, or the memory budget.

## Status

Accepted for the join protocol. The fat trait stays. Compatible engines are aliases. Per-engine command files are the exception, not the default.

`docs/ARCHITECTURE.md` is a survey and it is wrong on the live contract. It names `DatabaseConnection` with ~8 methods. The code is `DatabaseDriver` with ~50 methods plus `PoolRef`. It claims a &lt;50MB binary. Product README claims &lt;200MB memory. This file is the driver contract. That survey is not.

## Context

Eight engines compile into one Tauri 2 binary: Postgres, MySQL, SQLite, MSSQL, Oracle, Redis, MongoDB, Cassandra. MariaDB reuses MySQL. CockroachDB reuses Postgres. There are no per-driver Cargo features.

Adding an engine today touches four parallel matches: `DatabaseType` in `get_driver`, `PoolRef`, `ConnectionPool` in `manager.rs`, and `ConnectionManager::connect`. Redis, Mongo, and Cassandra also have `commands/{redis,mongodb,cassandra}.rs` plus their own stores and components. Identifier bugs across drivers already shipped as PRs #70, #84, and #85.

A ninth engine copied from Cassandra will add another command file, another store, and another match arm, and the &lt;200MB claim becomes folklore. Visual diffs and the ~140-command handler are downstream of this split. Decide the join rule first.

Plugins and `crates/plugin-core` are dead. PR #27 removed them from the app. The landing repo `dbfordevs_langing` still describes that layout. Ignore it.

## Decision

### One trait, capabilities as defaults

Keep `DatabaseDriver`. Do not split SQL vs document vs KV vs CQL into four traits yet. The leak is in IPC and UI, not in having one trait.

Operations a class of engine cannot do return `AppError::NotSupported` by default, same as `execute_parameterized` and `supports_user_management`. SQL engines override. Redis does not grow fake views.

`preview_query` stays on the trait. Schema snapshot and table-data compare can call trait methods. Redis staged edits and Mongo-specific shapes do not become fake SQL.

### Aliases, not extra pool variants

MariaDB → `MySqlDriver` / `ConnectionPool::MySql`. CockroachDB → `PostgresDriver` / `ConnectionPool::Postgres`. A wire-compatible engine is an alias in `get_driver` and `connect`. It does not add a `PoolRef` variant.

A new protocol adds one `PoolRef` variant, one `ConnectionPool` variant, one `get_driver` arm, and one `connect` arm, in the same PR.

### Four matches, one PR

A new engine is not done until all of these compile together:

- `DatabaseType`
- `get_driver` in `connection.rs`
- `PoolRef` in `connection.rs`
- `ConnectionPool` and `ConnectionManager::connect` / `disconnect` / `get_pool_ref` in `manager.rs`
- one file `src-tauri/src/db/<engine>.rs` that implements `DatabaseDriver`

Pool sizes stay in `manager.rs` for now. Do not invent a fifth factory.

### IPC

Trait methods get generic commands under `commands/` such as `queries`, `tables`, `users`. Frontend goes through those.

A per-engine command module is allowed only when the operation cannot be expressed on `DatabaseDriver` without lying. Redis commands, Mongo collection ops, CQL keyspace ops. A new SQL engine must not add `commands/<engine>.rs`.

Do not add ~140 more one-off handlers for SQL object types that already have a trait method.

### Compile and size

All drivers stay always-on. No Cargo features per engine. The budget that matters is process memory under 200MB in the product README, not the stale &lt;50MB binary line in `docs/ARCHITECTURE.md`.

Oracle Instant Client is a runtime download via `oracle_client.rs`. It does not sit in the installer. A new engine that needs a multi-hundred-MB native client follows that pattern or it does not ship.

SSH rewrite of host/port happens in `ConnectionManager::connect` before the driver sees the config. Drivers do not open tunnels.

### Identifiers

The driver emits canonical table and object names for its engine. UI must not guess 2-part vs 3-part vs schema. That is what PRs #70, #84, and #85 were. A new engine includes identifier tests with the driver, not a later UI patch.

## Rejected

**Four traits, one per data model, as the first cut.** It would freeze today's Redis/Mongo/Cassandra command files as the SQL/NoSQL border. Fix the join checklist first. Split the trait later if a second KV engine appears.

**Cargo features to drop engines from the binary.** Always-on is the product. Optional Instant Client download is the size valve, not feature flags the UI cannot explain.

**Plugin marketplace / language validators / `crates/`.** Removed in PR #27. Do not revive them to add an engine.

**Treat `docs/ARCHITECTURE.md` as the contract.** Wrong trait name, wrong size number, `storage/local.rs` does not exist in the tree it describes.

**Visual-diff ADR first.** Five preview paths already exist. Which of those a driver must implement is a follow-up that names `preview_query` vs `data_diff` vs Redis staging. This file decides how the driver enters the binary.

## Consequences

`AGENTS.md` still says MSSQL, Mongo, and Redis are unimplemented. They are implemented. Fix that playbook in a later PR. Until then, this README is what you follow when adding an engine.

Landing `dbfordevs_langing` README will keep lying until someone updates that repo. Do not copy its plugin story into this crate.

## What to change

New engine PR must touch:

- `src-tauri/src/db/connection.rs` — `PoolRef`, `DatabaseDriver` defaults, `get_driver`
- `src-tauri/src/db/manager.rs` — `ConnectionPool`, `connect`, `disconnect`, `get_pool_ref`
- `src-tauri/src/db/<engine>.rs` — the implementation
- `src-tauri/src/models/` — `DatabaseType` and identifier types
- generic `src-tauri/src/commands/*.rs` for trait methods
- `src-tauri/src/lib.rs` `generate_handler` only if a generic command is new

Add `commands/<engine>.rs` only for ops that cannot be a trait method. Then the matching `src/components/<engine>/` and store.

Do not put HTTP, SSH, or Instant Client unzip inside a driver impl. Do not format identifiers in React. Do not add a Cargo feature to hide the engine.

Follow-up, not this PR: classify the five preview paths in a `db/diff` README. Then an IPC allowlist README for `commands/`. Then rewrite or delete the stale survey in `docs/ARCHITECTURE.md`.
