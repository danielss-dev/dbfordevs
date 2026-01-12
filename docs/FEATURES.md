# dbfordevs Features Guide

A comprehensive guide to all features available in dbfordevs.

## Connection Management

### Creating Connections

dbfordevs supports connections to multiple database systems simultaneously.

**To create a new connection:**

1. Click **"New Connection"** in the sidebar (or press `Ctrl/Cmd+K`)
2. Select your database type from the dropdown
3. Enter connection details (host, port, username, password, database)
4. Click **"Test Connection"** to verify settings
5. Enter a friendly name and click **"Save"**

### Connection String Validators

If you have a connection string in your application's configuration, use the built-in validators to ensure correct format:

**Supported Languages:**
- C# / .NET
- Node.js / JavaScript
- Python

**To validate a connection string:**

1. Open Settings (`Ctrl/Cmd+,`)
2. Navigate to "Validators"
3. Select your programming language
4. Paste your connection string
5. The validator will highlight any issues

### Managing Saved Connections

Right-click any saved connection for options:

- **Connect**: Make this your active database
- **Edit**: Modify connection details
- **Duplicate**: Create a copy with same settings
- **Rename**: Change the display name
- **Delete**: Remove the connection
- **Copy Connection String**: Copy the connection string to clipboard

### Connection States

- **Connected** (green dot): Active connection ready for queries
- **Disconnected** (gray): Saved but not currently active
- **Connecting**: In progress (spinner icon)
- **Error** (red): Connection failed

### SSL Configuration

Secure your database connections with SSL/TLS encryption.

**To configure SSL:**

1. Open the connection dialog (new or edit)
2. Click the **SSL** tab
3. Configure SSL settings:

**SSL Modes:**

| Mode | Description |
|------|-------------|
| Disable | No SSL encryption |
| Prefer | Use SSL if available, fall back to unencrypted |
| Require | Require SSL, but don't verify certificate |
| Verify-CA | Require SSL and verify server certificate |
| Verify-Full | Require SSL, verify certificate and hostname |

**Certificate Options:**
- **CA Certificate**: Path to Certificate Authority file
- **Client Certificate**: Path to client certificate file
- **Client Key**: Path to client private key file

**Tip:** Use Verify-Full for production databases to ensure both encryption and server identity verification.

### SSH Tunneling

Connect to databases through an SSH tunnel for secure access to remote servers.

**When to use SSH tunneling:**
- Database is behind a firewall
- Database only accepts connections from specific hosts
- Extra layer of security for remote connections

**To configure SSH tunnel:**

1. Open the connection dialog (new or edit)
2. Click the **SSH** tab
3. Enable **"Use SSH Tunnel"**
4. Configure tunnel settings:

**SSH Configuration:**

- **SSH Host**: Hostname or IP of the SSH server
- **SSH Port**: SSH port (default: 22)
- **SSH Username**: Your SSH username

**Authentication Methods:**

**Password Authentication:**
- Select "Password" method
- Enter your SSH password

**Key-Based Authentication:**
- Select "Private Key" method
- Browse to select your private key file
- Enter passphrase if the key is encrypted

**How it works:**
1. dbfordevs establishes an SSH connection to the tunnel host
2. Database connection is routed through the SSH tunnel
3. From the database server's perspective, the connection comes from the SSH host

**Example Setup:**

```
Your Computer → SSH Tunnel (jump-host.example.com) → Database Server (db.internal:5432)
```

Configure:
- SSH Host: `jump-host.example.com`
- SSH Username: `your-user`
- Database Host: `db.internal` (internal hostname)
- Database Port: `5432`

### Supported Databases

dbfordevs supports the following database systems:

| Database | Status | SSL | SSH Tunnel |
|----------|--------|-----|------------|
| PostgreSQL | Full Support | Yes | Yes |
| MySQL / MariaDB | Full Support | Yes | Yes |
| Microsoft SQL Server | Full Support | Yes | Yes |
| SQLite | Full Support | N/A | N/A |
| Oracle | Full Support | Yes | Yes |
| MongoDB | Planned | - | - |
| Redis | Planned | - | - |

**Oracle-Specific Notes:**
- Uses Easy Connect format: `//host:port/service_name`
- Supports Oracle Wallet authentication
- Full PL/SQL execution support
- EXPLAIN PLAN visualization with DBMS_XPLAN

## Query Editor

The Monaco-based query editor is where you write and execute SQL commands.

### Editor Features

- **Syntax Highlighting**: Color-coded SQL syntax for readability
- **Code Completion**: Autocomplete for SQL keywords and identifiers
- **Line Numbers**: Track query line positions
- **Bracket Matching**: Automatic highlighting of matching brackets
- **Multi-Tab Support**: Organize multiple queries in tabs

### Writing Queries

Click in the editor and type your SQL:

```sql
SELECT id, name, email FROM users WHERE active = true ORDER BY created_at DESC;
```

### Comment and Uncomment

- **Single Line**: `--` comment syntax for SQL
- **Block Comment**: `/* ... */` for multi-line comments
- **Toggle Comment**: Press `Ctrl/Cmd+/` to toggle selection as comment

### Executing Queries

**Method 1: Keyboard Shortcut**
- Press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (macOS)

**Method 2: Execute Button**
- Click the **"Execute"** button in the toolbar

**Method 3: Right-Click**
- Right-click in editor and select "Execute"

### Execution Indicators

- **In Progress**: Spinner shows query is running
- **Success**: Green checkmark, results displayed below
- **Error**: Red error message with query details
- **Execution Time**: Shows duration of query execution

### Query Tabs

Organize multiple queries in separate tabs:

- **New Tab**: Click the `+` button next to existing tabs
- **Switch Tabs**: Click any tab to view/edit that query
- **Close Tab**: Click the `X` on a tab to close it
- **Rename Tab**: Double-click tab name to rename
- **Tab Menu**: Right-click for additional options

### Editor Settings

Customize editor behavior in Settings:

- **Font Size**: Adjust text size
- **Line Height**: Modify line spacing
- **Word Wrap**: Enable/disable line wrapping
- **Tab Size**: Set indentation level
- **Theme**: Choose editor color scheme

### SQL Formatting

Format your SQL queries with one click for better readability.

**To format SQL:**

1. Write or paste SQL in the editor
2. Press `Shift+Alt+F` or click the **Format** button in the toolbar
3. SQL is automatically beautified with proper indentation

**Format Selection Only:**
- Select a portion of SQL
- Press `Shift+Alt+F`
- Only the selected text is formatted

**Formatting Options** (configurable in Settings):

- **Keyword Case**: UPPER, lower, or Preserve original case
- **Indentation**: Spaces or tabs, configurable width
- **Indent Style**: Standard, tabularLeft, or tabularRight
- **Logical Operator Placement**: Newline before or after AND/OR

**Dialect Support:**
SQL formatting is dialect-aware and automatically uses the correct syntax rules for:
- PostgreSQL
- MySQL / MariaDB
- SQLite
- Microsoft SQL Server
- Oracle
- Standard SQL

### Query Bookmarks & Templates

Save frequently used queries for quick access and reuse.

**Saving a Bookmark:**

1. Write a query in the editor
2. Click **"Save as Bookmark"** or press `Ctrl/Cmd+B`
3. Enter a name and optional description
4. Choose a folder (or create a new one)
5. Click **Save**

**Accessing Bookmarks:**

- Click the **Bookmarks** dropdown next to the editor
- Use the search box to filter bookmarks
- Click a bookmark to insert it into the editor

**Bookmark Manager:**

Open the Bookmark Manager for full control:

1. Click **"Manage Bookmarks"** from the dropdown
2. Features available:
   - **Create folders** for organization
   - **Drag and drop** bookmarks between folders
   - **Edit** bookmark name, description, or SQL
   - **Duplicate** bookmarks
   - **Mark as favorite** for quick access
   - **Delete** bookmarks or folders

**Built-in Templates:**

Access pre-built query templates for common operations:

- Basic SELECT with JOIN
- INSERT template
- UPDATE template
- DELETE with WHERE clause
- Common aggregations (COUNT, SUM, AVG)
- Index creation

**Template Variables:**

Create dynamic templates with placeholders:

```sql
SELECT * FROM {{table_name}} WHERE {{column}} = '{{value}}' LIMIT {{limit}};
```

When you use a template with variables:
1. A dialog appears prompting for values
2. Enter values for each variable
3. Click **Apply** to insert the populated query

## Data Grid & Results

Results from executed queries appear in the data grid below the editor.

### Grid Features

- **Column Headers**: Clickable for sorting
- **Row Selection**: Click row numbers to select
- **Pagination**: Navigate through large result sets
- **Sorting**: Click headers to sort ascending/descending
- **Resizable Columns**: Drag column borders to resize
- **Scrolling**: Horizontal and vertical navigation
- **Row Highlighting**: Current row is highlighted
- **Global Search**: Search across all columns instantly

### Global Search

Search across all columns in the result set instantly.

**Using Global Search:**

1. Execute a query to load data into the grid
2. Click the search box at the top of the grid (or press `Ctrl/Cmd+F`)
3. Type your search term
4. Results filter in real-time as you type

**Search Behavior:**
- Case-insensitive matching
- Searches all visible columns
- Works alongside column-specific filters
- Clear the search box to show all rows

**Keyboard Shortcut:**
- `Ctrl/Cmd+F`: Focus the search box
- `Escape`: Clear search and return focus to grid

### Grid Operations

**Selecting Data:**
- Click row number to select single row
- `Ctrl/Cmd+A` to select all visible rows
- `Shift+Click` to select range

**Copying Data:**
- Select rows and press `Ctrl/Cmd+C`
- Paste into spreadsheets or text editors

**Exporting:**
- Copy selected data
- Paste into Excel, Google Sheets, or CSV files

### Pagination

Large result sets are paginated for performance:

- **Page Size**: Adjust rows per page in settings
- **Navigation**: Use previous/next buttons
- **Jump to Page**: Click page number input to go directly
- **Row Count**: Total rows and current range displayed

### Grid Settings

Configure grid behavior:

- **Rows Per Page**: Default number of rows to display
- **Stripe Rows**: Alternate row coloring for readability
- **Dense Mode**: Compact row height for more data visibility
- **Column Freezing**: Keep columns visible while scrolling (for wide tables)

## Data Editing

### Edit Existing Records

**Method 1: Click Edit Icon**
1. Click the edit icon next to a row
2. Modify values in the side panel
3. Click **"Save"** to apply changes

**Method 2: Double-Click Cell**
1. Double-click any cell in the grid
2. Inline editor appears
3. Press `Enter` to confirm or `Esc` to cancel

**Method 3: Right-Click Row**
1. Right-click a row
2. Select **"Edit Row"**
3. Modify in side panel
4. Click **"Save"**

### Insert New Records

1. Right-click in the grid (or click insert button)
2. Select **"Insert Row"**
3. Fill in values in the side panel
4. Click **"Save"**

### Delete Records

1. Select one or more rows
2. Right-click and select **"Delete"**
3. Confirm deletion when prompted

### Validating Changes

The side panel provides:
- **Field Validation**: Invalid entries are highlighted
- **Type Checking**: Values are validated against column types
- **Required Fields**: Mandatory fields are marked
- **Constraints**: Foreign key and unique constraints are checked

### Diff View

Before committing changes, review all pending modifications:

1. Click **"View Changes"** or press `Ctrl/Cmd+Shift+D`
2. The diff panel shows:
   - **New Records**: Added rows (green)
   - **Modified Records**: Changed rows (blue)
   - **Deleted Records**: Removed rows (red)
3. Click **"Commit"** to save all changes to database
4. Click **"Discard"** to revert all pending changes

### Undo Pending Changes

Press `Ctrl/Cmd+Z` to undo the last pending change. Only affects unsaved modifications.

## Schema Visualization

### Table Properties

View column definitions and constraints:

1. Click a table in the sidebar
2. Click **"Properties"** tab
3. View information about:
   - **Columns**: Name, type, nullable, default
   - **Indexes**: Composite indexes and performance
   - **Constraints**: Primary key, unique, check, foreign key
   - **Triggers**: Database triggers (if any)

### Table Diagram

Visualize table relationships:

1. Click a table in the sidebar
2. Click **"Diagram"** tab
3. The diagram shows:
   - **Related Tables**: Tables with foreign keys
   - **Relationships**: Visual connections between tables
   - **Key Information**: Highlighted primary/foreign keys
   - **Cardinality**: Relationship types (one-to-many, etc.)

### View Table DDL

See the SQL statement that created the table:

1. Right-click a table
2. Select **"View DDL"**
3. DDL appears in a modal
4. Click **"Copy"** to copy DDL to clipboard

### Creating Tables

For databases that support it:

1. Right-click the database name
2. Select **"Create Table"**
3. Enter table name
4. Define columns with types and constraints
5. Click **"Create"**

### Creating Schemas

For databases with schema support:

1. Right-click the database name
2. Select **"Create Schema"**
3. Enter schema name
4. Click **"Create"**

## Keyboard Shortcuts

### Query Editor

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Execute query |
| `Ctrl/Cmd + E` | Explain query (show execution plan) |
| `Shift + Alt + F` | Format SQL |
| `Ctrl/Cmd + B` | Save as bookmark |
| `Ctrl/Cmd + /` | Toggle line comment |
| `Ctrl/Cmd + Shift + /` | Toggle block comment |
| `Ctrl/Cmd + D` | Select current word |
| `Ctrl/Cmd + L` | Select line |
| `Alt + Up/Down` | Move line up/down |
| `Ctrl/Cmd + ]` | Indent |
| `Ctrl/Cmd + [` | Unindent |

### Data Grid

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + F` | Focus global search |
| `Ctrl/Cmd + A` | Select all rows |
| `Ctrl/Cmd + C` | Copy selected rows |
| `Escape` | Clear selection / search |
| `Page Down` | Next page |
| `Page Up` | Previous page |
| `Home` | First row |
| `End` | Last row |

### Application

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | New connection |
| `Ctrl/Cmd + T` | New query tab |
| `Ctrl/Cmd + W` | Close tab |
| `Ctrl/Cmd + ,` | Open settings |
| `Ctrl/Cmd + Shift + D` | View changes diff |
| `Ctrl/Cmd + Z` | Undo pending change |
| `F1` | Open help |
| `F11` | Toggle fullscreen |

## Appearance & Customization

### Themes

Choose your preferred color scheme:

- **Light Theme**: Bright interface for daytime use
- **Dark Theme**: Dark interface for low-light environments
- **System Theme**: Automatically matches OS preference

**To change theme:**
1. Open Settings (`Ctrl/Cmd+,`)
2. Go to "Appearance"
3. Select theme from dropdown

### Appearance Modes

Different UI layouts for different workflows:

- **Developer Mode**: Optimized for developers with compact layout
- **Web Mode**: Web-style interface with different aesthetics

### Font & Size Customization

Adjust text sizes throughout the application:

- **Editor Font Size**: Query editor text size
- **Grid Font Size**: Data grid text size
- **UI Scale**: Overall interface scaling

### Sidebar Customization

Control sidebar appearance:

- **Width**: Drag sidebar border to resize
- **Collapse**: Click collapse icon to hide sidebar
- **Connection Organization**: Sort or group connections

### Panel Management

Show/hide different interface panels:

- **Query Editor**: Write queries
- **Results Grid**: View query results
- **Side Panel**: Edit data or view properties
- **Diff View**: Review pending changes

Click panel toggle buttons to show/hide.

## Settings & Preferences

### General Settings

Access via `Ctrl/Cmd+,`

- **Auto-save**: Automatically save pending changes
- **Confirm Delete**: Require confirmation before deleting rows
- **Show Line Numbers**: Display line numbers in editor
- **Show Hints**: Display helpful tooltips

### Database Settings

- **Connection Timeout**: Seconds before connection fails
- **Query Timeout**: Maximum query execution time
- **Result Limit**: Maximum rows to fetch
- **Connection Pool**: Enable connection pooling for better performance

### Editor Settings

- **Tab Size**: Spaces per tab (default 2 or 4)
- **Word Wrap**: Wrap long lines
- **Minimap**: Show code minimap
- **Bracket Matching**: Highlight matching brackets

### Grid Settings

- **Rows Per Page**: Default pagination size
- **Stripe Rows**: Alternate row colors
- **Dense Mode**: Compact row height
- **Show Row Numbers**: Display row indices

### Keyboard Settings

View and customize keyboard shortcuts:
1. Open Settings
2. Go to "Keyboard Shortcuts"
3. Hover over shortcuts to edit
4. Click to modify keybindings

## Advanced Features

### Connection Pooling

Improve performance with connection pooling:

1. Open Settings
2. Enable "Connection Pooling"
3. Configure pool size
4. Restart application

### Query Caching

Speed up repeated queries:

1. Open Settings
2. Enable "Query Caching"
3. Cached results appear instantly
4. Clear cache from Settings

### Batch Operations

Execute multiple statements:

```sql
-- Each statement should end with ;
INSERT INTO users (name) VALUES ('Alice');
INSERT INTO users (name) VALUES ('Bob');
SELECT COUNT(*) FROM users;
```

Then execute. Results for each statement appear separately.

### Export Functionality

Export query results or entire tables:

1. Right-click table or select grid data
2. Choose export format
3. Specify filename
4. Select save location
5. File is exported in chosen format

Supported formats:
- CSV
- JSON
- Excel (.xlsx)
- SQL INSERT statements

### Data Import

Import data from external files into database tables.

**To import data:**

1. Select a table in the sidebar (or query it)
2. Click the **Import** button in the data grid toolbar
3. Follow the 5-step import wizard

**Step 1: Upload File**
- Select a file (CSV, JSON, or SQL)
- Drag and drop or click to browse
- Auto-detection of file format and delimiter
- Preview of first rows

**Step 2: Column Mapping**
- Map source columns to target table columns
- Auto-mapping attempts exact and fuzzy name matches
- Manually adjust mappings as needed
- Skip columns you don't want to import
- View target column data types

**Step 3: Import Options**
- **Duplicate Handling**:
  - Fail on duplicate (stop import)
  - Skip duplicates (continue with others)
  - Replace duplicates (update existing rows)
- **Batch Size**: 100-5000 rows per batch
- **Transaction Mode**: Rollback all on error
- **Error Handling**: Stop on first error or continue

**Step 4: Progress**
- Real-time progress bar
- Row counts: inserted, updated, skipped, failed
- Batch progress indicator
- Cancel option for long imports

**Step 5: Complete**
- Summary of import results
- Success/failure status
- Detailed error log with row numbers
- Option to view imported data

**Supported File Formats:**

| Format | Description |
|--------|-------------|
| CSV | Comma, semicolon, tab, or pipe delimited |
| JSON | Array of objects with column keys |
| SQL | INSERT statements (batch execution) |

**Tips:**
- Ensure column names in CSV header match target table
- Use JSON for complex data with nested structures
- SQL files support multiple INSERT statements

## Query Execution Plans

Analyze query performance with visual execution plan analysis.

### Viewing Execution Plans

**To view a query plan:**

1. Write your query in the editor
2. Click the **Explain** button (or press `Ctrl/Cmd+E`)
3. The execution plan appears in the Explain panel

**ANALYZE Mode:**
- Toggle **ANALYZE** to run the query and get actual execution metrics
- Without ANALYZE: Shows estimated costs only
- With ANALYZE: Shows actual rows, times, and buffer usage

### Plan Tree View

The interactive tree visualization shows:

- **Operation Types**: Seq Scan, Index Scan, Hash Join, Sort, Aggregate, etc.
- **Cost Indicators**: Color-coded from green (low) to red (high)
- **Row Estimates**: Expected vs actual row counts
- **Timing**: Planning and execution time
- **Filters**: WHERE conditions applied at each step
- **Index Usage**: Which indexes are used

**Node Icons:**
- Sequential scans (table icon)
- Index scans (index icon)
- Joins (merge icon)
- Sorts (sort icon)
- Aggregates (function icon)

**Interacting with the Tree:**
- Click nodes to expand/collapse details
- Hover for additional information
- High-cost nodes are highlighted for attention

### Plan Summary

At the top of the Explain panel:

- **Total Cost**: Overall query cost estimate
- **Planning Time**: Time spent planning the query
- **Execution Time**: Time spent executing (ANALYZE mode)
- **Database Type**: Current database being queried

### Warnings & Suggestions

The plan analyzer identifies potential issues:

- Sequential scans on large tables
- Missing indexes
- High row estimates
- Expensive sorts or aggregations

**Database Support:**

| Database | EXPLAIN Command |
|----------|-----------------|
| PostgreSQL | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` |
| MySQL | `EXPLAIN FORMAT=JSON` |
| SQLite | `EXPLAIN QUERY PLAN` |
| MSSQL | `SET SHOWPLAN_XML ON` |
| Oracle | `EXPLAIN PLAN` with `DBMS_XPLAN` |

## Table Creation

Create new database tables with a guided wizard interface.

### Using the Table Creation Wizard

**To create a new table:**

1. Right-click on a schema or database in the sidebar
2. Select **"Create Table"**
3. Follow the 5-step wizard

### Step 1: Basics

- **Table Name**: Enter the name for your new table
- **Schema**: Select the target schema (for databases with schema support)
- **Comment**: Optional description for the table

### Step 2: Columns

Define your table columns:

- **Column Name**: Unique name for the column
- **Data Type**: Select from database-specific types
- **Length/Precision**: For types that support it (VARCHAR, DECIMAL)
- **Nullable**: Allow NULL values
- **Default Value**: Set a default value
- **Primary Key**: Mark as part of the primary key
- **Auto Increment**: For auto-generated IDs (database dependent)

**Actions:**
- Click **"Add Column"** to add more columns
- Drag to reorder columns
- Click trash icon to remove a column

### Step 3: Constraints

Add table constraints:

**Primary Key:**
- Single column: Check "Primary Key" in column definition
- Composite: Select multiple columns in constraint editor

**Foreign Keys:**
- Select source column(s)
- Choose reference table
- Select reference column(s)
- Set ON DELETE and ON UPDATE actions

**Unique Constraints:**
- Select one or more columns
- Name the constraint (optional)

**Check Constraints:**
- Enter SQL expression (e.g., `price > 0`)
- Name the constraint

### Step 4: Indexes

Create indexes for performance:

- **Index Name**: Unique name for the index
- **Columns**: Select columns to index
- **Unique**: Create a unique index

### Step 5: Preview

Review the generated DDL:

- Full CREATE TABLE statement
- All constraints and indexes
- Database-specific syntax

**Actions:**
- **Copy DDL**: Copy to clipboard for documentation
- **Create Table**: Execute the DDL to create the table

### After Creation

- Success notification with table name
- Sidebar automatically refreshes
- New table appears in the schema tree
- Click to browse or query the new table

## Performance Tips

1. **Use LIMIT**: Reduce result size with `LIMIT` clause
2. **Filter Data**: Use `WHERE` to narrow results
3. **Pagination**: Use pagination for large result sets
4. **Indexes**: Ensure proper indexes on queried columns
5. **Connection Pooling**: Enable pooling for multiple queries
6. **Query Caching**: Enable to speed up repeated queries

## Troubleshooting Features

### Query Diagnostics

When a query fails:

1. Error message displays in red
2. Error details show problematic SQL
3. Database error message provides details
4. Hover for explanations of common errors

### Connection Status

View connection health:

- **Status Indicator**: Green = connected, red = error, gray = disconnected
- **Connection Time**: How long the connection took to establish
- **Protocol Version**: Database server version
- **Last Used**: When connection was last active

### Performance Monitoring

Monitor query performance:

- **Execution Time**: Shows in milliseconds
- **Rows Fetched**: Number of rows returned
- **Row Fetch Time**: Time to retrieve results
- **Total Time**: All time including network round-trip

---

For more help, check the [User Guide](./USER_GUIDE.md) or [Getting Started](./GETTING_STARTED.md).
