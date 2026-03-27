# reposcan

### The Codebase Doctor

> Scan any GitHub repo. Get a full health report. Find the time bombs before they blow up.

![Codebase Health: A](https://img.shields.io/badge/codebase_health-A-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/reposcan.svg)](https://www.npmjs.com/package/reposcan)

```
npx reposcan https://github.com/your/repo
```

```
  🔬 reposcan — The Codebase Doctor

   ██████╗
  ██╔════╝
  ██║
  ██║
   ██████╗
   ╚═════╝

  my-project — Overall Health: C (58/100)
  ⚡ Static Analysis · 142 files · 28,491 lines · 3.2s

  VITAL SIGNS

  Security        ████████████████████░░░░░░░░░░ 65
  Resilience      ██████████████░░░░░░░░░░░░░░░░ 45
  Comprehension   ██████████████████████░░░░░░░░ 72
  Dependencies    ██████████████████████████████ 100

  💣 TIME BOMBS (23 found)

  ● 👻 Phantom Import   "parse-csv" is imported but not in package.json     src/loader.ts:3
  ● 🔑 Secret           Possible Stripe Key found in source code            src/billing.ts:47
  ● 📋 Copy-Paste       Near-duplicate code block (91% similar to           src/api/users.ts:82
                         src/api/teams.ts:79)
  ● 💀 Dead Code        Exported "formatLegacy" appears unused              src/utils/format.ts:112
  ● ⚡ Complexity        Function "processQueue" has cyclomatic complexity   src/workers/queue.ts:34
                         of 27
```

## Why?

AI writes **41% of new commercial code** in 2026. It also produces **1.7x more bugs** and **2.74x more security vulnerabilities** than human-written code.

**95% of developers** spend extra time correcting AI-generated code. **96%** don't fully trust it.

There was no open-source tool to scan a codebase and answer: *"How healthy is this code, really?"*

Now there is.

## Getting Started

### Quick start (no install)

```bash
npx reposcan https://github.com/your/repo
```

### Install globally

```bash
npm install -g reposcan
reposcan ./my-project
```

### Install as a dev dependency

```bash
npm install --save-dev reposcan
npx reposcan .
```

### Requirements

- **Node.js** 18 or later
- **git** (for scanning GitHub URLs)
- **Anthropic API key** (optional — for AI-enhanced analysis)

## What it finds

| Category | What it detects |
|----------|----------------|
| **👻 Phantom Imports** | Packages imported but not in `package.json` — hallucinated by AI |
| **💀 Dead Code** | Exported functions nobody calls, variables never used |
| **📋 Copy-Paste Drift** | Near-duplicate code blocks with subtle differences |
| **🔑 Hardcoded Secrets** | API keys, tokens, passwords, connection strings in source |
| **⚡ High Complexity** | Functions with excessive branching, deep nesting, extreme length |
| **🏷️ Naming Chaos** | Mixed `camelCase` and `snake_case` in the same file |
| **📦 Dependency Issues** | Wildcard versions, missing lock files, known CVEs |

## Scores

Four health scores (0-100) plus an overall **A-F grade**:

- **Security** (35% weight) — secrets, injection patterns, unsafe code
- **Resilience** (25% weight) — dead code, duplicates, error handling
- **Comprehension** (25% weight) — naming consistency, complexity, file sizes
- **Dependencies** (15% weight) — outdated packages, CVEs, lock file health

## Usage

### Scan a GitHub repo

```bash
npx reposcan https://github.com/vercel/next.js
```

### Scan a local project

```bash
npx reposcan ./my-project
```

### Generate an HTML report

```bash
npx reposcan ./my-project --html report.html
```

### Get a README badge

```bash
npx reposcan ./my-project --badge
```

### AI-enhanced analysis (optional)

Set your Anthropic API key for deeper, semantic analysis powered by Claude:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx reposcan ./my-project
```

Without an API key, the tool runs in **static-analysis mode** — all heuristic checks work, you just don't get the AI-powered semantic analysis.

## Options

| Flag | Description |
|------|-------------|
| `--html <path>` | Generate a self-contained HTML report |
| `--badge` | Output a shields.io badge for your README |
| `--budget <tokens>` | Max token budget for AI analysis (default: 100000) |
| `--verbose` | Show detailed analysis output |

## Languages

Currently supports **TypeScript** and **JavaScript** (including JSX/TSX).

Python, Go, and Rust support coming soon.

## How it works

1. **Clone** — shallow-clones the repo (or reads local path)
2. **Discover** — finds all source files, skipping `node_modules`, `dist`, etc.
3. **Static Analysis** — runs 7 heuristic analyzers (naming, complexity, dead code, imports, secrets, duplicates, dependencies)
4. **AI Analysis** *(optional)* — sends code to Claude for semantic analysis (logic errors, architectural issues, comprehension debt)
5. **Score** — computes four health scores and an overall grade
6. **Report** — renders a beautiful terminal report + optional HTML

## Contributing

PRs welcome! Areas that need help:

- [ ] Python language support
- [ ] Go language support
- [ ] Rust language support
- [ ] `--fix` mode (auto-fix issues on a new branch)
- [ ] GitHub Action for CI/CD
- [ ] VS Code extension
- [ ] Architecture X-Ray visualization

## License

MIT
