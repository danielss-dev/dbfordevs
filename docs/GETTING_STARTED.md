# Getting Started with dbfordevs

This guide will walk you through installing dbfordevs and connecting to your first database.

## Installation

### Download & Install

1. Visit the [dbfordevs releases page](https://github.com/yourusername/dbfordevs/releases)
2. Download the installer for your operating system:
   - **Windows**: `.msi` installer
   - **macOS**: `.dmg` or `.app.tar.gz`
   - **Linux**: `.AppImage` or distribution-specific package
3. Run the installer and follow the prompts
4. Launch dbfordevs from your applications menu

### Verify Installation

After launching dbfordevs for the first time:
- You should see the main window with a sidebar on the left
- The sidebar shows "No connections" initially
- The main area displays a welcome message

## Your First Connection

### Step 1: Open Connection Dialog

Click the **"New Connection"** button in the sidebar (or use `Ctrl+K` / `Cmd+K`).

### Step 2: Select Database Type

Choose your database system from the dropdown:
- PostgreSQL
- MySQL / MariaDB
- SQLite
- Microsoft SQL Server (MSSQL)
- Oracle
- MongoDB
- Redis
- CockroachDB
- Cassandra

### Step 3: Enter Connection Details

Fill in the required fields based on your database type:

#### PostgreSQL Example
```
Host: localhost
Port: 5432
Username: postgres
Password: your_password
Database: your_database
```

#### MySQL Example
```
Host: localhost
Port: 3306
Username: root
Password: your_password
Database: your_database
```

#### SQLite Example
```
File Path: /path/to/your/database.db
```

#### SQL Server Example
```
Host: localhost
Port: 1433
Username: sa
Password: your_password
Database: your_database
```

### Step 4: Validate Connection

Click **"Test Connection"** to verify your details are correct. You should see a success message if the connection works.

### Step 5: Save Connection

Enter a name for your connection (e.g., "Production DB", "Local Dev") and click **"Save"**.

Your connection now appears in the sidebar and is available for use.

## Your First Query

### Step 1: Open Query Editor

Click on your saved connection in the sidebar to open the query editor.

### Step 2: Write a Query

Click in the editor area and type a simple SQL query:

```sql
SELECT * FROM information_schema.tables LIMIT 10;
```

### Step 3: Execute Query

Press **`Ctrl+Enter`** (Windows/Linux) or **`Cmd+Enter`** (macOS) to execute the query.

Alternatively, click the **"Execute"** button in the toolbar.

### Step 4: View Results

Results appear in the data grid below the editor showing:
- Column headers
- Data rows
- Row count and execution time
- Sortable columns

## Managing Connections

### Switch Between Connections

Click any connection in the sidebar to switch to it. The query editor updates to use the selected connection.

### Edit Connection Details

Right-click a connection and select "Edit" to modify connection properties.

### Delete Connection

Right-click a connection and select "Delete" to remove it. You'll be prompted to confirm.

### Duplicate Connection

Right-click a connection and select "Duplicate" to quickly create a copy with the same settings.

### Rename Connection

Right-click a connection and select "Rename" to change its display name.

## Data Grid Basics

### Viewing Data

- **Scroll**: Navigate through rows vertically and columns horizontally
- **Sort**: Click column headers to sort ascending/descending
- **Pagination**: Use page controls at the bottom to navigate large result sets
- **Row Count**: See total rows and current page range

### Selecting Data

- Click row numbers to select entire rows
- Use `Ctrl/Cmd+A` to select all visible rows
- Copy selected data with `Ctrl/Cmd+C`

### Exporting Data

Selected data in the grid can be copied and pasted into spreadsheet applications or text editors.

## Common Tasks

### Create a New Table

1. Right-click the database name in the sidebar
2. Select "Create Table"
3. Enter table name and column definitions
4. Click "Create"

### Insert Data

1. Right-click inside the data grid
2. Select "Insert Row"
3. Fill in values for new row
4. Click "Save"

### Edit Existing Data

1. Double-click a cell in the grid to edit
2. Or right-click a row and select "Edit Row"
3. Modify values in the side panel
4. Click "Save" to apply changes

### Delete Data

1. Select one or more rows in the grid
2. Right-click and select "Delete Rows"
3. Confirm the deletion

### View Table Properties

1. Click a table in the sidebar
2. Select "Properties" to see:
   - Column names and types
   - Indexes
   - Constraints
   - Foreign keys

### Visualize Relationships

1. Click a table in the sidebar
2. Select "Diagram" to see:
   - Related tables
   - Foreign key relationships
   - Table structure

## Settings & Preferences

### Appearance Settings

Click the **Settings** icon (gear icon) to access:

- **Theme**: Choose Light, Dark, or System theme
- **Appearance Mode**: Developer or Web view
- **Font Size**: Adjust editor and grid font sizes
- **Keyboard Shortcuts**: View and customize shortcuts

### Connection String Validators

For help with connection strings, use the built-in validators:

1. Open Settings
2. Go to "Validators"
3. Choose your programming language
4. Paste a connection string to validate

Validators are available for:
- C# / .NET
- Node.js / JavaScript
- Python

## Using Query Tabs

### Create New Tab

Click the **"+"** button next to open query tabs to create a new query.

### Switch Between Tabs

Click any tab to switch to that query.

### Manage Tabs

- **Close Tab**: Click the "X" on the tab
- **Tab Name**: Double-click to rename a tab
- Right-click for more options

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | New connection |
| `Ctrl/Cmd + T` | New query tab |
| `Ctrl/Cmd + Enter` | Execute query |
| `Ctrl/Cmd + ,` | Open settings |
| `Ctrl/Cmd + /` | Toggle comment |
| `Alt + Up/Down` | Navigate results |
| `Ctrl/Cmd + A` | Select all (grid) |
| `Ctrl/Cmd + C` | Copy selection |
| `Esc` | Close dialogs |

## Troubleshooting

### Connection Failed

**Problem**: "Cannot connect to database"

**Solutions**:
1. Verify host and port are correct
2. Check username and password
3. Ensure database service is running
4. Check firewall/network rules
5. Verify you can connect from command line (`psql`, `mysql`, etc.)

### Query Execution Error

**Problem**: "Syntax error in query"

**Solutions**:
1. Check SQL syntax with your database documentation
2. Verify table and column names exist
3. Try executing query in native database client
4. Check for unsupported SQL features in your database version

### Slow Performance

**Problem**: "Grid is slow with large result sets"

**Solutions**:
1. Use `LIMIT` clause to reduce result size
2. Add `WHERE` conditions to filter data
3. Increase pagination size in settings
4. Ensure database query is optimized

### Connection Keeps Disconnecting

**Problem**: "Lost connection after inactivity"

**Solutions**:
1. Check database server timeout settings
2. Reconnect from sidebar
3. Review network stability
4. Check for VPN/network issues

## Next Steps

1. **Explore Features**: Check out the [Features Guide](./FEATURES.md) for advanced capabilities
2. **Learn Shortcuts**: Use keyboard shortcuts to work faster
3. **Install Plugins**: Extend functionality with plugins from the marketplace
4. **Customize Theme**: Personalize the appearance in Settings

## Need Help?

- Check the [User Guide](./USER_GUIDE.md) for detailed documentation
- Review the [Features Guide](./FEATURES.md) for specific feature help
- Search GitHub issues for common problems
- Report bugs with detailed reproduction steps

Happy querying! 🎉
