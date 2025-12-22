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
gt create <branch-name>
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
gt create <next-branch-name>
# Make changes
git add .
git commit -m "feat: implement query runner for new database"
```

### 5. Submitting your Stack
To submit your entire stack to GitHub as separate, linked pull requests:

```bash
gt submit --stack
```

Graphite will handle creating the PRs and setting the base branches correctly so that each PR only shows its own changes.

## Command Cheatsheet

### Viewing your Stack

| Task | Command | Short Form |
| :--- | :--- | :--- |
| See full information about all of your branches and their PRs | `gt log` | |
| See all of your branches | `gt log short` | `gt ls` |

### Creating and Modifying Branches

| Task | Command | Short Form |
| :--- | :--- | :--- |
| Create a new branch | `gt create` | `gt c` |
| Create a branch, stage all, commit with message | `gt create --all --message "msg"` | `gt c -am "msg"` |
| Stage all changes and amend them to current branch | `gt modify --all` | `gt m -a` |
| Stage all changes and add a new commit to current branch | `gt modify --commit --all --message "msg"` | `gt m -cam "msg"` |

### Syncing and Submitting

| Task | Command | Short Form |
| :--- | :--- | :--- |
| Pull trunk, clean up merged branches, restack | `gt sync` | |
| Push current branch and all downstack branches | `gt submit` | |
| Push all branches in current stack | `gt submit --stack` | `gt ss` |

### Navigating your Stack

| Task | Command | Short Form |
| :--- | :--- | :--- |
| Switch to a specific branch | `gt checkout` | `gt co` |
| Move up one branch | `gt up` | `gt u` |
| Move down one branch | `gt down` | `gt d` |
| Go to the top of the stack | `gt top` | `gt t` |
| Go to the bottom of the stack | `gt bottom` | `gt b` |

### Reorganizing & Recovery

| Task | Command | Short Form |
| :--- | :--- | :--- |
| Rebase your stack on its parent | `gt restack` | `gt r` |
| Squash all commits in branch into one | `gt squash` | `gt sq` |
| Split branch into multiple branches | `gt split` | `gt sp` |
| Undo the most recent Graphite mutation | `gt undo` | |

## Tips for dbfordevs

- **Small PRs**: Graphite makes it easy to keep PRs small and focused. For example, you can have one PR for the Rust backend changes and another for the React frontend components.
- **Conventional Commits**: Ensure every commit in your stack follows the conventional commit format to keep the changelog clean.
- **Syncing**: Run `gt repo sync` frequently to stay up to date with the remote repository.

For more detailed information, visit the [Graphite Documentation](https://docs.graphite.dev/).

