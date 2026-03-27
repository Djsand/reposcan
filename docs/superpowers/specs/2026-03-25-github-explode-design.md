# reposcan — The Codebase Doctor

## Problem

The "vibe coding hangover" is the #1 developer pain point of 2026:
- 45% of devs say "almost-right AI code" is their biggest frustration
- 95% spend extra time correcting AI-generated code
- AI writes 41% of new commercial code, yet produces 1.7x more major issues
- Amazon lost 6.3M orders to a vibe-coded outage; Moltbook leaked 1.5M API keys in 3 days
- Developer trust in AI tools has collapsed from 77% to 60%

**No open-source tool exists** that gives developers a comprehensive health report on their codebase — one that finds time bombs, measures comprehension debt, and actually fixes issues. Existing tools (SonarQube, CodeScene, CodeRabbit) are either enterprise-priced, single-purpose, or not designed for the AI-generated code era.

## Solution

A CLI tool that scans any GitHub repo (or local codebase) and generates a rich health report with scores, time bomb detection, architecture visualization, and auto-fix capabilities.

```
npx reposcan https://github.com/vercel/next.js
npx reposcan ./my-project
npx reposcan ./my-project --fix
npx reposcan ./my-project --badge
```

## Core Features

### 1. Vital Signs (Health Scores)

Four 0-100 scores plus an overall A-F letter grade:

- **Comprehension Score**: How understandable is this code?
  - Naming consistency (variable/function naming conventions)
  - Function complexity (cyclomatic complexity distribution)
  - Abstraction quality (file sizes, function lengths, nesting depth)
  - Documentation coverage (JSDoc/docstrings presence for public APIs)

- **Resilience Score**: How likely is this code to break?
  - Dead code / orphaned functions
  - Untested critical paths
  - Error handling coverage
  - Defensive coding patterns

- **Security Score**: Known vulnerability patterns
  - Exposed secrets / hardcoded credentials
  - Injection risk patterns (SQL, XSS, command injection)
  - Dependency vulnerability audit (via advisory databases)
  - Unsafe patterns (eval, dangerouslySetInnerHTML, etc.)

- **Dependency Health**: Supply chain risk
  - Outdated dependencies count
  - Known CVEs in dependency tree
  - Phantom packages (imports that don't resolve — hallucinated by AI)
  - Lock file integrity

- **Overall Health Grade**: Weighted composite → A through F
  - Weights: Security (35%), Resilience (25%), Comprehension (25%), Dependency Health (15%)
  - Thresholds: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F < 40

### 2. Time Bombs

The killer differentiator. AI-powered detection of specific "ticking time bombs":

- **Hallucinated imports**: Referencing packages/modules that don't exist
- **Orphaned code**: Functions/classes defined but never called or exported
- **Copy-paste drift**: Duplicated code blocks with subtle differences (classic AI slop pattern)
- **Naming inconsistency**: Mixed conventions within the same module (camelCase + snake_case)
- **Unhandled edge cases**: Critical code paths missing error handling
- **Hardcoded secrets**: API keys, tokens, passwords in source
- **Circular dependencies**: Module A → B → C → A

Each time bomb includes:
- Severity: critical / warning / info
- File path and line number
- Plain-English explanation of why it's dangerous
- Suggested fix

### 3. Architecture X-Ray

- Dependency graph (ASCII in terminal, interactive SVG in HTML report)
- Entry points and critical paths highlighted
- File-level complexity heatmap
- Circular dependency visualization

### 4. Fix Mode (`--fix`)

```
npx reposcan ./my-project --fix
```

Creates a new git branch (`reposcan/fixes`) with:
- One commit per fix category (security, dead-code, naming, etc.)
- Each commit message explains what was fixed and why
- Developer can cherry-pick individual categories
- Uses Claude API for intelligent refactoring (not just regex replacements)

### 5. Badge Generation (`--badge`)

Generates a shields.io badge URL for README files:
```
![Health: A](https://img.shields.io/badge/codebase_health-A-brightgreen)
```

## Technical Architecture

### Stack

- **Language**: TypeScript (Node.js)
- **CLI framework**: Commander.js
- **AST parsing**: ts-morph for TypeScript/JavaScript (MVP), tree-sitter for multi-language (post-MVP)
- **AI engine**: Anthropic Claude API (for semantic analysis, time bomb detection, fix generation)
- **Terminal output**: chalk + cli-table3 (rich formatted output)
- **HTML reports**: Embedded template, self-contained single HTML file
- **Package distribution**: npm (supports `npx` for zero-install usage)

### API Key Management

The tool requires a Claude API key for AI-powered analysis. Key handling:

- **Env var**: `ANTHROPIC_API_KEY` (standard convention)
- **Graceful degradation**: Without an API key, the tool runs **static-analysis-only mode** — all heuristic checks work, scores are computed from static metrics only, and the report clearly labels itself as "Static Analysis Only" with a note that AI analysis is available with an API key
- **Cost management**: Token budget capped at ~100K tokens per scan. Files are batched and summarized. A `--budget` flag allows users to set a custom limit
- **Caching**: Analysis results are cached per file hash in `~/.cache/reposcan/`. Unchanged files skip re-analysis on subsequent runs

### Repo Cloning

- GitHub URLs are shallow-cloned (`--depth 1`) to a temp directory (`os.tmpdir()`)
- Temp clones are cleaned up after analysis completes (or on process exit)
- Private repos require a `gh` CLI auth token (detected automatically if available)
- `--fix` mode only works on local paths (not cloned URLs) — the CLI warns and exits if attempted on a URL
- Large repo mitigation: skip `node_modules`, `.git`, vendored dirs. If source files exceed 50K LOC, warn and offer `--path src/` to scope the scan

### Phantom Package Detection (MVP)

For JS/TS: check every `import`/`require` against:
1. Relative paths → verify file exists
2. Package names → verify exists in `package.json` dependencies
3. No network calls needed — purely local resolution

### Error Handling

- Claude API failure: fall back to static-analysis-only mode, log warning
- Unsupported language: skip file, report "X files skipped (unsupported language)"
- AST parse failure: skip file, report as warning, don't crash
- Empty repo: exit with clear message "No source files found"

### Analysis Pipeline

```
Input (URL or path)
  → Clone (if URL) / validate path
  → Language detection + file discovery (skip vendored/generated dirs)
  → AST parsing (ts-morph for TS/JS)
  → Static analysis pass (heuristic checks — fast, no AI, no API key needed)
    → Naming consistency
    → Complexity metrics
    → Dead code detection
    → Import validation / phantom package detection
    → Secret scanning
  → [If API key present] AI analysis pass (Claude API)
    → Time bomb detection (semantic, beyond what heuristics catch)
    → Comprehension scoring refinement
    → Fix generation (if --fix, local paths only)
  → Score calculation (static-only or static+AI depending on availability)
  → Report generation (terminal + optional HTML)
  → Cleanup (remove temp clone if applicable)
```

### Language Support (MVP)

1. TypeScript / JavaScript (highest GitHub usage)
2. Python (most AI/ML repos)
3. Go (infrastructure repos)
4. Rust (growing fast, high GitHub cred)

### File Structure

```
reposcan/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # CLI entry point
│   ├── cli.ts                    # Argument parsing (Commander.js)
│   ├── clone.ts                  # Git clone / local path handling
│   ├── detect.ts                 # Language detection
│   ├── analyzers/
│   │   ├── index.ts              # Analyzer orchestrator
│   │   ├── naming.ts             # Naming consistency analyzer
│   │   ├── complexity.ts         # Cyclomatic complexity analyzer
│   │   ├── dead-code.ts          # Orphaned functions/imports
│   │   ├── secrets.ts            # Secret/credential scanner
│   │   ├── dependencies.ts       # Dependency health checker
│   │   ├── imports.ts            # Import validation (phantom packages)
│   │   └── duplicates.ts         # Copy-paste drift detection
│   ├── ai/
│   │   ├── client.ts             # Claude API client
│   │   ├── time-bombs.ts         # AI time bomb detection
│   │   ├── comprehension.ts      # AI comprehension scoring
│   │   └── fixer.ts              # AI-powered fix generation
│   ├── scoring/
│   │   ├── calculator.ts         # Score computation
│   │   └── grade.ts              # Letter grade assignment
│   ├── reporters/
│   │   ├── terminal.ts           # Rich terminal output
│   │   ├── html.ts               # HTML report generator
│   │   └── badge.ts              # Badge URL generator
│   └── types.ts                  # Shared type definitions
├── templates/
│   └── report.html               # HTML report template
└── tests/
    ├── analyzers/                 # Unit tests per analyzer
    ├── scoring/                   # Score calculation tests
    └── fixtures/                  # Sample codebases for testing
```

## MVP Scope

For the initial launch that can go viral:

**Must have:**
- CLI with `npx` support
- GitHub URL + local path input
- 4 health scores + overall grade
- Time bomb detection (top 5 most impactful types)
- Rich terminal output with colors and tables
- HTML report generation
- TypeScript/JavaScript language support

**Nice to have (fast follow):**
- `--fix` mode
- Python/Go/Rust support
- Badge generation
- Architecture X-Ray visualization
- GitHub Action

**Post-launch:**
- CI/CD integration
- VS Code extension
- Historical tracking (score over time)

## Viral Strategy

1. **Zero friction**: `npx reposcan <url>` — nothing to install
2. **Run on famous repos**: Pre-generate reports for React, Next.js, OpenClaw, etc. Include in README
3. **Shareable scores**: Badges for READMEs, HTML reports for social sharing
4. **Controversial by nature**: "Your codebase has 47 time bombs" — guaranteed engagement
5. **Show HN + Reddit**: Post with a provocative title ("I scanned the top 100 GitHub repos. Here's what I found.")
6. **Open source**: MIT license, encourage contributions

## Success Criteria

- Works on any public GitHub repo via URL and any local path
- Static analysis runs in under 30 seconds for repos up to 50K LOC (excludes clone time)
- Full AI analysis completes in under 90 seconds for repos up to 50K LOC
- Fewer than 25% false positives on time bomb detection (tested against 10 diverse repos)
- Terminal output renders correctly in standard terminals (iTerm2, Terminal.app, Windows Terminal, VS Code terminal)
- HTML report is self-contained (single file, no external dependencies) and under 1MB
- Tool degrades gracefully without API key — static-only mode still provides useful scores
