# dbfordevs User Guide

Comprehensive documentation for using dbfordevs effectively.

## Table of Contents

1. [Introduction](#introduction)
2. [Interface Overview](#interface-overview)
3. [Detailed Workflows](#detailed-workflows)
4. [Advanced Usage](#advanced-usage)
5. [Tips & Tricks](#tips--tricks)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

## Introduction

dbfordevs is a lightweight database management application for developers. This guide covers everything you need to know about using the application effectively.

**Key Concepts:**

- **Connection**: A saved database configuration allowing access to a specific database
- **Query Tab**: A workspace for writing and executing SQL queries
- **Data Grid**: The results display showing query output in table format
- **Side Panel**: The editing interface for modifying individual records
- **Diff View**: A comparison view showing all pending changes before committing

## Interface Overview

### Main Window Layout

```
┌─────────────────────────────────────────────────────┐
│  Menu Bar (File, Edit, View, Help)                  │
├────────────┬──────────────────────────────────────┤
│            │                                        │
│  Sidebar   │  Main Content Area                    │
│            │                                        │
│ Connections│  Query Editor                         │
│  - Conn 1  │                                        │
│  - Conn 2  │  Results Grid                         │
│            │                                        │
│ Databases  │                                        │
│  - Tables  │                                        │
│  - Views   │                                        │
│            │                                        │
└────────────┴──────────────────────────────────────┘
```

### Sidebar

The left sidebar contains:

**Connections Section**
- List of saved database connections
- Right-click for connection options
- Green dot indicates active connection
- Shows connection status (connected, error, connecting)

**Database Trees** (when connected)
- Schemas (for databases with schema support)
- Tables
- Views
- Indexes
- Functions/Procedures

**Actions**
- New Connection button (`Ctrl/Cmd+K`)
- Settings gear icon (`Ctrl/Cmd+,`)
- Plugin marketplace
- Help menu

### Main Content Area

**Query Editor**
- Write SQL queries
- Multiple tabs for organizing queries
- Syntax highlighting and code completion
- Execute button and options

**Results Grid**
- Displays query results
- Sortable and paginated
- Rows can be selected and copied
- Column resizing and reordering

**Side Panel**
- Appears when editing rows
- Shows field values and validation
- Save/Cancel buttons for changes
- Displays field types and constraints

**Diff View**
- Shows pending changes
- Color-coded: green (new), blue (modified), red (deleted)
- Review before committing changes
- Commit or discard all changes at once

## Detailed Workflows

### Workflow 1: Basic Query Execution

**Goal**: Execute a simple SELECT query

1. **Select Connection**: Click a connection in sidebar
2. **Open Editor**: Click the main content area or query tab
3. **Write Query**: Enter SQL in editor
   ```sql
   SELECT id, name, email FROM users LIMIT 10;
   ```
4. **Execute**: Press `Ctrl/Cmd+Enter` or click Execute button
5. **Review Results**: Check grid for results and execution time
6. **Export (Optional)**: Copy results to clipboard or export to file

**Time**: ~1-2 minutes
**Keyboard Efficiency**: Open connection (1 click) → Type query → `Ctrl/Cmd+Enter`

### Workflow 2: Data Editing

**Goal**: Modify existing records in a table

1. **Navigate**: Click table in sidebar to load data
2. **Review Data**: Examine results in grid
3. **Select Row**: Click the row you want to edit
4. **Edit**: Click edit icon or double-click cell
5. **Modify**: Change values in side panel
6. **Validate**: System checks constraints automatically
7. **Review Changes**: Click "View Changes" to see diff
8. **Commit**: Click "Commit Changes" to save to database
9. **Verify**: Check grid updates with new values

**Before You Commit**: Always review changes in diff view

### Workflow 3: Inserting New Records

**Goal**: Add new records to a table

1. **Select Table**: Click table in sidebar
2. **Insert Row**: Right-click in grid → "Insert Row"
3. **Fill Data**: Enter values in side panel
4. **Validate**: System checks required fields and types
5. **View Changes**: Click "View Changes" to preview
6. **Commit**: Save to database
7. **Verify**: New row appears in grid

**Tip**: Use Tab to navigate between fields in insert form

### Workflow 4: Deleting Records

**Goal**: Remove records from database

1. **Select Table**: Click in sidebar
2. **Select Rows**: Click row numbers to select (use Shift for ranges)
3. **Delete**: Right-click → "Delete Rows"
4. **Confirm**: Confirm deletion in dialog
5. **Review Changes**: View diff to see marked-for-deletion rows
6. **Commit**: Save deletions to database

**Warning**: Deletion is permanent. Review carefully before committing.

### Workflow 5: Complex Query with Multiple Statements

**Goal**: Execute multiple related queries

1. **New Tab**: Click `+` button to create new query tab
2. **First Query**: Write first statement
   ```sql
   -- Get user count by status
   SELECT status, COUNT(*) as count FROM users GROUP BY status;
   ```
3. **Execute**: `Ctrl/Cmd+Enter`
4. **Second Tab**: Click `+` for another tab
5. **Second Query**: Write related query
   ```sql
   SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC;
   ```
6. **Execute**: `Ctrl/Cmd+Enter`
7. **Compare**: Click between tabs to compare results

### Workflow 6: Schema Exploration

**Goal**: Understand table structure and relationships

1. **Locate Table**: Expand database tree in sidebar
2. **View Properties**: Right-click table → "Properties"
   - See all columns with types
   - View indexes
   - Check constraints and foreign keys
3. **View Diagram**: Right-click table → "Diagram"
   - See relationships visually
   - Identify dependencies
   - Understand cardinality
4. **View DDL**: Right-click table → "View DDL"
   - See CREATE TABLE statement
   - Copy DDL for documentation

## Advanced Usage

### Working with Large Result Sets

**Problem**: Queries return thousands of rows, affecting performance

**Solutions**:

1. **Use LIMIT Clause**
   ```sql
   SELECT * FROM large_table LIMIT 100;
   ```

2. **Filter with WHERE**
   ```sql
   SELECT * FROM large_table WHERE created_date > '2024-01-01';
   ```

3. **Use Pagination Settings**
   - Go to Settings → Grid
   - Increase "Rows Per Page" to 100+
   - Use pagination buttons to navigate

4. **Aggregate Data**
   ```sql
   SELECT category, COUNT(*) FROM items GROUP BY category;
   ```

### Batch Operations

**Execute multiple statements in one query:**

```sql
-- Insert multiple records
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com');
INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com');

-- Verify insertion
SELECT COUNT(*) FROM users;
```

Each statement executes separately, with results for each shown in order.

### Transaction Management

**For databases supporting transactions:**

```sql
BEGIN TRANSACTION;

UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

COMMIT;
```

Or if something goes wrong:
```sql
ROLLBACK;
```

### Working with Different Database Systems

#### PostgreSQL-Specific

```sql
-- List all schemas
SELECT schema_name FROM information_schema.schemata;

-- Get table info
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users';
```

#### MySQL-Specific

```sql
-- Show all databases
SHOW DATABASES;

-- Show table structure
DESCRIBE table_name;

-- Show table creation statement
SHOW CREATE TABLE table_name;
```

#### SQLite-Specific

```sql
-- List all tables
SELECT name FROM sqlite_master WHERE type='table';

-- Get table info
PRAGMA table_info(table_name);
```

#### SQL Server-Specific

```sql
-- List all tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES;

-- Get column info
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'table_name';
```

### Using Connection String Validators

**Scenario**: You have a .NET connection string and want to verify it's valid

1. Go to Settings (`Ctrl/Cmd+,`)
2. Click "Validators"
3. Select "C# / .NET"
4. Paste connection string:
   ```
   Server=localhost;Database=mydb;User Id=sa;Password=MyPassword123;
   ```
5. Validator shows if format is correct
6. Can also test actual connection in Connection Dialog

### Managing Multiple Connections

**Best Practices:**

1. **Naming Convention**: Use descriptive names
   - ✅ "Production PostgreSQL"
   - ❌ "db1"

2. **Organization**: Group by environment
   - Development connections
   - Staging connections
   - Production connections

3. **Separate Tabs**: Use different tabs per connection
   - Tab 1: "Dev - User Queries"
   - Tab 2: "Prod - Reports"
   - Tab 3: "Staging - Testing"

4. **Duplicate for Testing**: Test queries safely
   - Duplicate production connection → "Production-Test"
   - Run tests on copy
   - Delete test connection when done

### Data Export Workflows

**Export to CSV:**

1. Execute query to get data
2. Select all rows (`Ctrl/Cmd+A`)
3. Copy to clipboard (`Ctrl/Cmd+C`)
4. Open spreadsheet application
5. Paste data

**Export via Database Tools:**

```sql
-- PostgreSQL: Copy to CSV
COPY (SELECT * FROM users) TO STDOUT WITH CSV HEADER;

-- MySQL: Into Outfile
SELECT * FROM users
INTO OUTFILE '/tmp/users.csv'
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n';
```

### Performance Optimization

**Identify slow queries:**

1. Note execution time displayed after query runs
2. If > 1 second, optimization needed
3. Check if table has proper indexes
4. Use EXPLAIN to see query plan (if supported)

```sql
-- PostgreSQL
EXPLAIN SELECT * FROM large_table WHERE user_id = 1;

-- MySQL
EXPLAIN SELECT * FROM large_table WHERE user_id = 1;
```

**Optimization Strategies:**

1. Add indexes to frequently queried columns
2. Use proper JOIN syntax
3. Avoid SELECT * when possible
4. Use column aliases for readability
5. Partition large tables if supported

## Tips & Tricks

### Navigation Speed

**Use keyboard shortcuts to navigate faster:**

- `Ctrl/Cmd+K`: Quick connection switching
- `Ctrl/Cmd+T`: New query tab
- `Ctrl/Cmd+W`: Close current tab
- `Alt+Up/Down`: Navigate between grids

### Query Templates

**Save common query patterns:**

```sql
-- User lookup template
SELECT id, name, email, created_at
FROM users
WHERE id = ?;

-- Sales report template
SELECT DATE(order_date) as date, COUNT(*) as orders, SUM(total) as revenue
FROM orders
GROUP BY DATE(order_date)
ORDER BY date DESC;
```

Store in separate query tabs and modify as needed.

### Column Visibility

**Working with wide tables:**

1. **Horizontal Scroll**: Use arrow keys to scroll columns
2. **Column Hiding**: Right-click column header
3. **Column Reordering**: Drag column headers (if supported)
4. **Freeze Columns**: Keep key columns visible while scrolling

### Keyboard Macro Usage

**Use your OS keyboard macro features:**

Windows/Linux: AutoHotkey for repeated queries
macOS: Keyboard Shortcuts app

Create macro for common connection setup:
```
Ctrl+Alt+P → Connect to Production
→ Ctrl+T → New Tab
→ Type common query
```

### Diff View Mastery

**Before committing any changes:**

1. Click "View Changes"
2. Understand what will be written to database
3. Scan for unintended modifications
4. Check totals match expectations
5. Only then click "Commit"

### Safe Testing Pattern

**Test changes without risk:**

1. Use test database copy if available
2. Or create test schema: `CREATE SCHEMA test_changes;`
3. Run modifications on test version
4. Review results
5. Replay on production once confident

## Troubleshooting

### Connection Issues

#### "Cannot connect to database"

**Checklist:**

- [ ] Database service is running
- [ ] Host and port are correct
- [ ] Username and password are correct
- [ ] Database name is correct
- [ ] Firewall allows connection
- [ ] Network connectivity is available
- [ ] No special characters in password need escaping

**Verification Steps:**

1. Test with native client:
   ```bash
   # PostgreSQL
   psql -h localhost -U postgres -d mydb

   # MySQL
   mysql -h localhost -u root -p mydb

   # SQLite
   sqlite3 mydb.db
   ```

2. Check network/firewall:
   ```bash
   ping host
   telnet host port
   ```

#### "Connection times out"

**Causes and Solutions:**

1. Network latency
   - Try from machine closer to database
   - Check network stability

2. Database timeout settings
   - Increase timeout in Settings
   - Check database server timeout config

3. Firewall blocking
   - Verify port is open
   - Check security group rules (cloud)

### Query Issues

#### "Syntax error in query"

**Diagnosis:**

1. Check SQL against database documentation
2. Verify table and column names (case-sensitive in some databases)
3. Ensure semicolon at end
4. Check for unsupported features for database version
5. Try query in database native client

**Example Error:**
```
Error: column "user_id" does not exist
```

**Solution:**
1. Right-click table → Properties
2. Verify column name (might be `userId` or `user_Id`)
3. Update query with correct name

#### "Query returns no results"

**Checklist:**

1. Verify table has data: `SELECT COUNT(*) FROM table;`
2. Check WHERE clause conditions
3. Verify column names and spelling
4. Check data types match in WHERE clause
5. Try without filters: `SELECT * FROM table LIMIT 1;`

#### "Query takes too long"

**Analysis:**

1. Check execution time feedback
2. If > 5 seconds, likely performance issue
3. For very large tables:
   - Add LIMIT
   - Add WHERE clause
   - Check indexes exist

**Optimization:**
```sql
-- Before (slow)
SELECT * FROM 10_million_row_table;

-- After (fast)
SELECT * FROM 10_million_row_table WHERE year = 2024 LIMIT 100;
```

### Data Editing Issues

#### "Cannot modify field"

**Reasons:**

1. Field is part of primary key
2. Field is a generated/computed column
3. Database doesn't support modification for this column type
4. Insufficient permissions

**Solution:**

Check table properties to understand column constraints.

#### "Constraint violation when saving"

**Error**: "Foreign key constraint failed"

**Diagnosis:**

1. Value violates foreign key relationship
2. Value violates unique constraint
3. Value violates check constraint

**Solution:**

1. Review table properties
2. Check related tables for valid values
3. Ensure referenced record exists
4. Fix value to satisfy constraint

#### "Changes don't persist"

**Checklist:**

1. Did you click "Commit Changes"?
2. Was commit successful (no error message)?
3. Refresh grid to see updated data
4. Check database directly from another client
5. Review pending changes didn't exceed transaction size limit

### Display Issues

#### "Grid is very slow with large result sets"

**Solutions:**

1. Use pagination: Go to Settings → Grid
2. Increase "Rows Per Page"
3. Use LIMIT in query
4. Filter data with WHERE clause
5. Disable sorting on large columns

#### "Text is too small/large"

**Fix:**

1. Open Settings (`Ctrl/Cmd+,`)
2. Go to "Appearance"
3. Adjust "Font Size" or "UI Scale"
4. Restart application if needed

#### "Colors/Theme not applying"

**Solution:**

1. Open Settings
2. Go to "Appearance"
3. Select theme
4. Restart application
5. Or switch theme twice (sometimes needed)

### Performance Issues

#### "Application is sluggish"

**Optimization steps:**

1. Close unused query tabs
2. Clear result grids with large datasets
3. Reduce pagination size temporarily
4. Close sidebar panel temporarily
5. Restart application
6. Check available system RAM

#### "Typing in editor is slow"

**Solutions:**

1. Turn off syntax highlighting temporarily (Settings)
2. Disable code completion (Settings)
3. Reduce editor font size
4. Split large queries into multiple tabs
5. Restart application

## FAQ

### General Questions

**Q: Can I use dbfordevs with multiple databases at once?**

A: Yes! Each connection maintains its own session. Open multiple query tabs and switch between connections as needed.

**Q: Is my data safe? Are connections encrypted?**

A: Connections use standard database connection protocols (SSL/TLS when supported). Saved passwords are stored securely in your system's credential storage. Always use encrypted connections in production.

**Q: Can I export my queries?**

A: Yes. Copy query text from editor and save to file. Or export results using the export feature.

**Q: Does dbfordevs support stored procedures?**

A: Yes. Type `CALL procedure_name()` or `EXECUTE procedure_name` depending on your database.

**Q: Can I use transactions?**

A: Yes. Begin transaction, run queries, then commit or rollback. Some databases default to auto-commit, so `BEGIN` may be necessary.

### Database-Specific Questions

**Q: Can I connect to RDS, Azure SQL Database, or other cloud databases?**

A: Yes. Use the cloud provider's connection string. Make sure network rules allow connection.

**Q: Does dbfordevs work with database clusters?**

A: Yes. Connect to cluster endpoint with proper credentials. Features may vary depending on cluster setup.

**Q: Can I connect to databases behind a VPN?**

A: Yes. Configure VPN connection on your system first, then connect through dbfordevs normally.

### Data Editing Questions

**Q: Can I undo changes after committing?**

A: No. Once committed, changes are permanent. Always review diff before committing.

**Q: Can I bulk insert data?**

A: Yes. Write SQL with multiple INSERT statements:
```sql
INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');
```

**Q: Can I edit data from a JOIN query?**

A: Limited. Simple single-table updates work. Complex JOINs may require writing UPDATE query.

### Performance Questions

**Q: Why is my query slow?**

A: Check database indexes, use EXPLAIN plan, add WHERE clause, use LIMIT. Cloud databases may have latency.

**Q: What's the maximum number of rows I can view?**

A: Theoretically unlimited, but practical limit is 10,000+ rows. Use pagination for larger sets.

**Q: Can I cache query results?**

A: Results display instantly if query runs again. No explicit cache, but repeated queries are fast.

### Plugin Questions

**Q: How do I write a custom plugin?**

A: Check plugin documentation on GitHub. Basic plugins can validate connection strings or provide themes.

**Q: Are plugins safe?**

A: Only install from trusted sources. Review plugin source code if possible.

### Troubleshooting Questions

**Q: Why did my connection drop?**

A: Database timeout, network issues, or server restart. Reconnect from sidebar.

**Q: Where are my saved connections stored?**

A: In your system's local storage (encrypted). On macOS typically in `~/Library/Application Support/dbfordevs/`.

**Q: How do I report a bug?**

A: Report on GitHub with detailed steps to reproduce, your OS, database type, and dbfordevs version.

---

**Still need help?** Check the [Features Guide](./FEATURES.md) or [Getting Started](./GETTING_STARTED.md) guide.
