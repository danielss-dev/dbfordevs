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
| `Ctrl/Cmd + A` | Select all rows |
| `Ctrl/Cmd + C` | Copy selected rows |
| `Escape` | Clear selection |
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

## Plugin System

### What are Plugins?

Plugins extend dbfordevs functionality. Available plugin types:

- **Validators**: Connection string validators
- **Themes**: Custom color schemes
- **Exporters**: Export data in different formats
- **Tools**: Custom functionality for specific use cases
- **AI Assistants**: AI-powered features

### Installing Plugins

1. Open **"Plugin Marketplace"** from settings
2. Browse available plugins
3. Click **"Install"** on desired plugin
4. Restart dbfordevs for changes to take effect

### Managing Plugins

- **Enable/Disable**: Toggle plugins on/off
- **Uninstall**: Remove plugins you don't use
- **Settings**: Configure plugin-specific options
- **Updates**: Check for and install plugin updates

### Plugin Marketplace

Discover community-created plugins:
- Custom validators in your language
- Theme packs
- Data export formats
- Analysis tools
- Database-specific utilities

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
