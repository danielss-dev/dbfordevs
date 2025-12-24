# dbfordevs Extension Development Guide

This guide explains how to create extensions for dbfordevs, enabling you to add new features, themes, validators, and AI integrations.

## Table of Contents

- [Overview](#overview)
- [Extension Types](#extension-types)
- [Extension Manifest](#extension-manifest)
- [Creating Your First Extension](#creating-your-first-extension)
- [Rust Extensions](#rust-extensions)
- [Theme Extensions](#theme-extensions)
- [Publishing Extensions](#publishing-extensions)
- [API Reference](#api-reference)

---

## Overview

dbfordevs uses a modular extension system that allows developers to extend the application's functionality. Extensions can be:

- **Official**: Maintained by the dbfordevs team, built into the application
- **Community**: Created by the community, installable via GitHub releases

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    dbfordevs Application                     │
├─────────────────────────────────────────────────────────────┤
│  Extension Registry  │  Extension Loader  │  Extension Host  │
├─────────────────────────────────────────────────────────────┤
│     AI Assistant     │    Validators     │     Themes       │
│      (Official)      │    (Official)     │   (Community)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Extension Types

### 1. Validator Extensions
Parse and validate connection strings for different programming languages.

**Examples**: C# Validator, Node.js Validator, Python Validator

### 2. AI Extensions
Integrate AI models for query generation, explanation, and optimization.

**Examples**: AI Query Assistant (Claude)

### 3. Exporter Extensions
Add new export formats for query results.

**Examples**: Parquet Exporter, Avro Exporter

### 4. Theme Extensions
Customize the visual appearance of dbfordevs.

**Examples**: Nordic Theme, Dracula Theme

### 5. Connector Extensions
Add support for new database types.

**Examples**: Custom database drivers

---

## Extension Manifest

Every extension requires an `extension.json` manifest file in its root directory.

### Basic Structure

```json
{
  "id": "my-extension",
  "version": "1.0.0",
  "displayName": "My Extension",
  "description": "A brief description of what this extension does",
  "author": {
    "name": "Your Name",
    "email": "you@example.com",
    "url": "https://yourwebsite.com"
  },
  "categories": ["theme"],
  "isOfficial": false,
  "capabilities": [],
  "activationEvents": [],
  "repository": "https://github.com/username/my-extension",
  "license": "MIT",
  "minAppVersion": "0.1.0"
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (alphanumeric, hyphens, underscores) |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `displayName` | string | Yes | Human-readable name |
| `description` | string | Yes | Brief description |
| `author` | object | Yes | Author information |
| `categories` | array | Yes | One or more of: `validator`, `ai`, `exporter`, `theme`, `connector` |
| `isOfficial` | boolean | No | Whether maintained by dbfordevs team |
| `capabilities` | array | No | Features contributed by this extension |
| `activationEvents` | array | No | Events that trigger extension activation |
| `repository` | string | No | GitHub repository URL |
| `license` | string | No | License identifier (e.g., "MIT") |
| `minAppVersion` | string | No | Minimum dbfordevs version required |
| `icon` | string | No | Path to extension icon |
| `homepage` | string | No | Extension homepage URL |

### Capability Types

#### Command Contribution

```json
{
  "type": "command",
  "id": "myext.doSomething",
  "title": "Do Something",
  "shortcut": "Cmd+Shift+X"
}
```

#### Panel Contribution

```json
{
  "type": "panel",
  "id": "myext.panel",
  "title": "My Panel",
  "location": "right",
  "icon": "layout"
}
```

#### Setting Contribution

```json
{
  "type": "setting",
  "id": "myext.apiKey",
  "title": "API Key",
  "settingType": "password",
  "description": "Your API key"
}
```

---

## Creating Your First Extension

### Step 1: Create the Extension Directory

```bash
mkdir my-extension
cd my-extension
```

### Step 2: Create the Manifest

Create `extension.json`:

```json
{
  "id": "my-first-extension",
  "version": "1.0.0",
  "displayName": "My First Extension",
  "description": "Learning to build dbfordevs extensions",
  "author": {
    "name": "Developer"
  },
  "categories": ["other"],
  "repository": "https://github.com/username/my-first-extension"
}
```

### Step 3: Implement Your Extension

For Rust extensions, create a new crate. For theme extensions, create CSS variables.

### Step 4: Test Locally

Extensions are stored in:
- **macOS**: `~/Library/Application Support/dbfordevs/extensions/`
- **Linux**: `~/.local/share/dbfordevs/extensions/`
- **Windows**: `%APPDATA%\dbfordevs\extensions\`

Copy your extension folder there to test.

---

## Rust Extensions

For extensions that need backend logic (validators, AI, connectors), you'll create a Rust crate.

### Project Structure

```
my-validator/
├── Cargo.toml
├── extension.json
└── src/
    └── lib.rs
```

### Cargo.toml

```toml
[package]
name = "my-validator"
version = "1.0.0"
edition = "2021"

[dependencies]
extension-core = { git = "https://github.com/dbfordevs/dbfordevs", branch = "main" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Implementing the Extension Trait

```rust
use extension_core::{Extension, ExtensionCategory, ExtensionMetadata};

pub struct MyValidator;

impl Extension for MyValidator {
    fn metadata(&self) -> ExtensionMetadata {
        ExtensionMetadata {
            id: "my-validator".to_string(),
            name: "My Validator".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: "Validates connection strings".to_string(),
            author: "Developer".to_string(),
            category: ExtensionCategory::Validator,
            is_official: false,
            repository: Some("https://github.com/username/my-validator".to_string()),
            min_app_version: Some("0.1.0".to_string()),
        }
    }

    fn on_load(&self) -> Result<(), extension_core::ExtensionError> {
        println!("My Validator loaded!");
        Ok(())
    }

    fn on_unload(&self) -> Result<(), extension_core::ExtensionError> {
        println!("My Validator unloaded!");
        Ok(())
    }
}
```

### Implementing a Validator

For connection string validators, also implement the `ConnectionStringValidator` trait:

```rust
use validator_core::{
    ConnectionStringValidator, DatabaseType, ParsedConnection,
    ValidationResult, ValidatorError,
};

impl ConnectionStringValidator for MyValidator {
    fn parse(&self, connection_string: &str) -> Result<ParsedConnection, ValidatorError> {
        // Parse the connection string
        todo!()
    }

    fn validate(&self, connection_string: &str) -> ValidationResult {
        // Validate and return results
        todo!()
    }

    fn supports_database(&self, db_type: &DatabaseType) -> bool {
        matches!(db_type, DatabaseType::PostgreSQL | DatabaseType::MySQL)
    }

    fn to_connection_string(&self, parsed: &ParsedConnection) -> Result<String, ValidatorError> {
        // Convert back to string
        todo!()
    }
}
```

---

## Theme Extensions

Theme extensions customize the visual appearance of dbfordevs using CSS variables. Themes are **dynamically loaded** - their CSS is injected when enabled and removed when disabled.

### How Theme Loading Works

The extension system uses a `ThemeStore` that:
1. **Registers themes** at app startup (official themes) or on install (community themes)
2. **Injects CSS** into the document `<head>` when a theme is activated
3. **Removes CSS** when the theme is deactivated or uninstalled
4. **Persists** the active theme selection across sessions

This means themes are truly isolated - adding or removing them has no side effects on other themes or the base application.

### Creating a Theme Extension

#### TypeScript Theme Definition

For official or bundled themes, define your theme in TypeScript:

```typescript
import type { ThemeDefinition } from "@/extensions/themes";

const MY_THEME_CSS = `
/* My Custom Theme */
.theme-my-theme {
  --background: 220 16% 22%;
  --foreground: 218 27% 92%;
  /* ... other variables */
}
`;

export const myTheme: ThemeDefinition = {
  id: "my-theme",
  name: "My Theme",
  description: "A beautiful custom theme",
  author: "Designer",
  version: "1.0.0",
  variant: "dark", // or "light"
  isOfficial: false,
  css: MY_THEME_CSS,
};
```

#### Theme Definition Interface

```typescript
interface ThemeDefinition {
  id: string;           // Unique identifier (e.g., "nordic-dark")
  name: string;         // Display name
  description: string;  // Brief description
  author: string;       // Author name
  version: string;      // Semantic version
  variant: "light" | "dark";  // Light or dark theme
  isOfficial: boolean;  // Whether bundled with dbfordevs
  css: string;          // CSS content (inline or URL)
  isUrl?: boolean;      // If true, `css` is a URL to load
}
```

### CSS Variables

Themes override CSS variables within a scoped class (`.theme-<id>`). The system applies this class to the document root when the theme is activated.

```css
/* Your theme CSS - scoped to .theme-my-theme */
.theme-my-theme {
  /* Background colors */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  
  /* Card colors */
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  
  /* Primary colors */
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  
  /* Secondary colors */
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  
  /* Muted colors */
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  
  /* Accent colors */
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  
  /* Border and input */
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
  
  /* Semantic colors */
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  
  /* Table colors */
  --table-header-bg: 220 16% 20%;
  --table-row-odd: 220 16% 22%;
  --table-row-even: 220 17% 24%;
  --table-row-hover: 220 16% 28%;
  
  /* Sidebar colors */
  --sidebar-background: 220 16% 18%;
  --sidebar-foreground: 218 27% 92%;
  
  /* Radius */
  --radius: 0.5rem;
}
```

### Color Format

Colors use HSL format without the `hsl()` wrapper:
- Format: `H S% L%`
- Example: `222.2 84% 4.9%` (dark blue)

### Registering Your Theme

**For official themes** (bundled with the app), add to `src/extensions/themes/official.ts`:

```typescript
import { myTheme } from "./my-theme";

export const officialThemes: ThemeDefinition[] = [
  nordicDarkTheme,
  nordicLightTheme,
  myTheme, // Add your theme here
];
```

**For community themes**, they will be registered when installed via the extension system.

### Using the Theme API

```typescript
import { useThemes } from "@/extensions";

function ThemeSelector() {
  const { themes, activeThemeId, activate, deactivate } = useThemes();
  
  return (
    <select 
      value={activeThemeId || ""}
      onChange={(e) => e.target.value ? activate(e.target.value) : deactivate()}
    >
      <option value="">Default</option>
      {themes.map(theme => (
        <option key={theme.id} value={theme.id}>{theme.name}</option>
      ))}
    </select>
  );
}

---

## Publishing Extensions

### Via GitHub Releases

1. Create a GitHub repository for your extension
2. Tag a release with your version number
3. Create a release with your extension as a `.zip` file
4. Users can install via the repository URL

### Release Structure

Your `.zip` file should contain:

```
my-extension-v1.0.0.zip
└── my-extension/
    ├── extension.json
    ├── theme.css (for themes)
    └── ... (other files)
```

### Installation URL

Users install your extension using:
```
https://github.com/username/my-extension
```

---

## API Reference

### Extension Core Types

```typescript
// Extension status
type ExtensionStatus =
  | "installed"
  | "active"
  | "disabled"
  | { error: string }
  | "installing"
  | "updating";

// Extension category
type ExtensionCategory =
  | "validator"
  | "ai"
  | "exporter"
  | "theme"
  | "connector"
  | { other: string };

// Extension info
interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  status: ExtensionStatus;
  isOfficial: boolean;
  repository?: string;
  icon?: string;
}
```

### Frontend Hooks

```typescript
import { useExtensions, useAIAssistant, useExtensionSettings } from "@/extensions";

// Extension management
const { extensions, enable, disable, uninstall, installFromGitHub } = useExtensions();

// AI Assistant
const { isOpen, sendMessage, messages, toggle } = useAIAssistant();

// Settings
const { settings, updateSettings } = useExtensionSettings();
```

### Tauri Commands

```typescript
// List extensions
await invoke("list_extensions");

// Enable/disable
await invoke("enable_extension", { extensionId: "my-ext" });
await invoke("disable_extension", { extensionId: "my-ext" });

// Install from GitHub
await invoke("install_extension_from_github", {
  request: { repositoryUrl: "https://github.com/user/repo" }
});
```

---

## Best Practices

1. **Follow naming conventions**: Use lowercase with hyphens for IDs
2. **Version semantically**: Use semver (MAJOR.MINOR.PATCH)
3. **Provide good documentation**: Include a README in your repo
4. **Test thoroughly**: Test on all supported platforms
5. **Keep dependencies minimal**: Only include what you need
6. **Handle errors gracefully**: Return meaningful error messages
7. **Respect user privacy**: Don't collect data without consent

---

## Examples

### Official Extensions

- **AI Assistant**: `crates/ai-assistant/`
- **C# Validator**: `crates/validator-csharp/`
- **Node.js Validator**: `crates/validator-nodejs/`
- **Python Validator**: `crates/validator-python/`

### Community Examples

Check the [dbfordevs-extensions](https://github.com/dbfordevs/extensions) repository for community-contributed extensions.

---

## Getting Help

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Discord**: Join our community for real-time help

---

*Last updated: December 2025*

