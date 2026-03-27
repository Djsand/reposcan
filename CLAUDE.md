# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

- **Build:** `npm run build` (runs `tsc`, outputs to `dist/`)
- **Dev:** `npm run dev` (runs `tsc --watch`)
- **Lint:** `npm run lint` (runs `tsc --noEmit`)
- **Run:** `npm start` or `node dist/index.js <target>` (target is a GitHub URL or local path)
- **No test framework is configured yet.**

## Architecture

reposcan is a CLI tool that scans codebases (GitHub repos or local paths) and produces a health report with scores and "time bombs." It currently supports TypeScript/JavaScript only.

### Pipeline (src/index.ts)

The main flow is sequential: **parse CLI args** → **resolve input** (clone or local) → **discover files** → **run static analyzers** → **optional AI analysis** → **score** → **report**.

### Key Layers

- **Input resolution** (`src/clone.ts`): Shallow-clones GitHub repos to a temp dir, or resolves local paths. Returns a `RepoInput` with a cleanup function.
- **File discovery** (`src/detect.ts`): Recursive walk that filters by language extension (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`). Skips `node_modules`, `dist`, `.git`, etc. Loads file content into memory as `SourceFile` objects.
- **Analyzers** (`src/analyzers/`): Seven independent analyzers (naming, complexity, dead-code, imports, secrets, duplicates, dependencies), each returns `AnalyzerResult` with findings and stats. Orchestrated by `runAllAnalyzers()` in `src/analyzers/index.ts`.
- **AI analysis** (`src/ai/client.ts`): Optional — activated when `ANTHROPIC_API_KEY` is set. Sends file summaries + static results to Claude for semantic analysis. Returns additional findings and time bombs.
- **Scoring** (`src/scoring/`): `calculator.ts` computes four raw scores (security 35%, resilience 25%, comprehension 25%, dependencies 15%) from analyzer stats. `grade.ts` assigns A-F grade. `time-bombs.ts` extracts time bombs from analyzer findings.
- **Reporters** (`src/reporters/`): Terminal (chalk + cli-table3), HTML (self-contained), and badge (shields.io URL) output formats.

### Type System

Core types in `src/types.ts`: `Finding`, `AnalyzerResult`, `HealthScores`, `TimeBomb`, `ScanReport`, `ScanOptions`. All analyzers produce `AnalyzerResult`; the report aggregates everything into `ScanReport`.

### Adding a New Analyzer

Create `src/analyzers/<name>.ts` exporting a function that takes `SourceFile[]` (and optionally `repoPath`) and returns `AnalyzerResult`. Register it in `src/analyzers/index.ts` and update the scoring weights in `src/scoring/calculator.ts`.

## Conventions

- ESM modules (`"type": "module"` in package.json) — all imports use `.js` extensions even for `.ts` files
- TypeScript strict mode, target ES2022, Node16 module resolution
- CLI parsing via `commander`; AST analysis via `ts-morph`
