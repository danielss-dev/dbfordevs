# Using Graphite for dbfordevs

This guide explains how to use [Graphite](https://graphite.dev/) for managing stacked pull requests in the **dbfordevs** project.

## What is Graphite?

Graphite is a tool designed for developers to manage "stacked" pull requests. Instead of waiting for one PR to be merged before starting the next related task, you can build on top of your existing branches.

## Prerequisites

1.  **Graphite CLI**: Install the CLI globally using `bun` (or npm/yarn):
    ```bash
    bun install -g @withgraphite/graphite-cli
    ```
2.  **Authentication**: Log in to your Graphite account:
    ```bash
    gt auth
    ```

## Project Workflow

### 1. Initialize Graphite
If you haven't already, initialize Graphite in your local repository:
```bash
gt init
```

### 2. Creating a Stack
When starting a new feature or fix, create a new branch using Graphite:

```bash
gt branch create <branch-name>
```

### 3. Making Changes & Committing
Make your changes as usual. We follow **conventional commits** in this project. 

Example:
```bash
git add .
git commit -m "feat: add support for new database system"
```

### 4. Stacking Changes
If you need to start a related task before the first one is merged:

```bash
# While on your first branch
gt branch create <next-branch-name>
# Make changes
git add .
git commit -m "feat: implement query runner for new database"
```

### 5. Submitting your Stack
To submit your entire stack to GitHub as separate, linked pull requests:

```bash
gt stack submit
```

Graphite will handle creating the PRs and setting the base branches correctly so that each PR only shows its own changes.

## Common Commands

| Command | Description |
|---------|-------------|
| `gt branch create <name>` | Create a new branch stacked on the current one |
| `gt stack submit` | Push the current stack and create/update PRs |
| `gt stack restack` | Rebase your entire stack if the base branch (main) has changed |
| `gt branch checkout` | Interactively switch between branches in your stack |
| `gt log` | View a visual representation of your current stacks |

## Tips for dbfordevs

- **Small PRs**: Graphite makes it easy to keep PRs small and focused. For example, you can have one PR for the Rust backend changes and another for the React frontend components.
- **Conventional Commits**: Ensure every commit in your stack follows the conventional commit format to keep the changelog clean.
- **Syncing**: Run `gt repo sync` frequently to stay up to date with the remote repository.

For more detailed information, visit the [Graphite Documentation](https://docs.graphite.dev/).

