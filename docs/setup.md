# Karse setup

How to get Karse ready to run, test, and develop. Once set up, see [development.md](development.md) for the day-to-day workflow.

## Prerequisites

- **`bun`** on `PATH` (the [official installer](https://bun.sh), or `mise install` for the pinned version).
- **`kubectl`** on `PATH`, configured against at least one kubeconfig context (`mise install` provides the pinned version).
- **`jq`**, **`curl`**, and **`kwokctl`** on `PATH` for the smoke and e2e tests (kwokctl install is in [development.md](development.md#installing-kwokctl)).

If you use [mise](https://mise.jdx.dev), `mise trust && mise install` at the repo root installs the pinned `bun` and `kubectl`.

## Set up the project

Install all workspace dependencies from the repo root:

```sh
bun install
```

That is the whole setup. Then `bun start` runs Karse, or `bun run dev` for hot reload.

## Set up a worktree

Each git worktree has its own `node_modules`, so a fresh worktree is not ready until its dependencies are installed.

**The implementation agent must set up the worktree before implementing a ticket.** From the worktree root, before compiling, testing, or running anything:

```sh
bun install
```

Skipping this leaves the worktree with no dependencies and every later command fails.
