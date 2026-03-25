import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding } from '../types.js';

interface ImportInfo {
  source: string;
  line: number;
  isRelative: boolean;
}

function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ES import
    const esMatch = line.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/);
    if (esMatch) {
      imports.push({
        source: esMatch[1],
        line: i + 1,
        isRelative: esMatch[1].startsWith('.'),
      });
      continue;
    }

    // Dynamic import
    const dynMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dynMatch) {
      imports.push({
        source: dynMatch[1],
        line: i + 1,
        isRelative: dynMatch[1].startsWith('.'),
      });
      continue;
    }

    // require
    const reqMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (reqMatch) {
      imports.push({
        source: reqMatch[1],
        line: i + 1,
        isRelative: reqMatch[1].startsWith('.'),
      });
    }
  }

  return imports;
}

function resolveRelativeImport(importSource: string, fromFile: string, repoPath: string): boolean {
  const dir = dirname(join(repoPath, fromFile));
  const base = resolve(dir, importSource);

  // Try exact path and common extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  if (extensions.some(ext => existsSync(base + ext))) return true;

  // TypeScript ESM: .js imports resolve to .ts files
  if (importSource.endsWith('.js')) {
    const tsBase = resolve(dir, importSource.replace(/\.js$/, ''));
    const tsExtensions = ['.ts', '.tsx'];
    if (tsExtensions.some(ext => existsSync(tsBase + ext))) return true;
  }
  if (importSource.endsWith('.jsx')) {
    const tsBase = resolve(dir, importSource.replace(/\.jsx$/, ''));
    if (existsSync(tsBase + '.tsx')) return true;
  }

  return false;
}

function getPackageName(importSource: string): string {
  if (importSource.startsWith('@')) {
    // Scoped package: @scope/name
    const parts = importSource.split('/');
    return parts.slice(0, 2).join('/');
  }
  return importSource.split('/')[0];
}

export function analyzeImports(files: SourceFile[], repoPath: string): AnalyzerResult {
  const findings: Finding[] = [];
  let phantomPackageCount = 0;
  let brokenRelativeCount = 0;

  // Load package.json dependencies
  const deps = new Set<string>();
  let pkgName = '';
  let hasSubpathImports = false;
  const builtins = new Set(['fs', 'path', 'os', 'url', 'util', 'events', 'stream', 'http', 'https', 'crypto', 'zlib', 'buffer', 'querystring', 'child_process', 'cluster', 'dgram', 'dns', 'net', 'readline', 'tls', 'tty', 'v8', 'vm', 'worker_threads', 'assert', 'async_hooks', 'console', 'constants', 'domain', 'inspector', 'module', 'perf_hooks', 'process', 'punycode', 'string_decoder', 'timers', 'trace_events', 'wasi']);

  try {
    const pkgPath = join(repoPath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      pkgName = (pkg.name as string) || '';
      hasSubpathImports = !!pkg.imports;
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      for (const name of Object.keys(allDeps)) {
        deps.add(name);
      }
    }
  } catch {
    // No package.json or parse error — skip package validation
  }

  for (const file of files) {
    const imports = extractImports(file.content);

    for (const imp of imports) {
      if (imp.isRelative) {
        // Check if relative import resolves
        if (!resolveRelativeImport(imp.source, file.relativePath, repoPath)) {
          brokenRelativeCount++;
          findings.push({
            analyzer: 'imports',
            severity: 'critical',
            file: file.relativePath,
            line: imp.line,
            message: `Broken import: "${imp.source}" does not resolve to a file`,
            suggestion: 'Fix the import path or create the missing file',
          });
        }
      } else {
        // Check if package exists in dependencies
        const importPkgName = getPackageName(imp.source);

        // Skip Node builtins (with and without node: prefix)
        if (builtins.has(importPkgName) || (importPkgName.startsWith('node:') && builtins.has(importPkgName.slice(5)))) {
          continue;
        }

        // Skip subpath imports (#foo) — these are defined in package.json "imports" field
        if (imp.source.startsWith('#')) {
          continue;
        }

        // Skip self-referencing imports (package importing itself)
        if (pkgName && importPkgName === pkgName) {
          continue;
        }

        if (deps.size > 0 && !deps.has(importPkgName)) {
          phantomPackageCount++;
          findings.push({
            analyzer: 'imports',
            severity: 'critical',
            file: file.relativePath,
            line: imp.line,
            message: `Phantom package: "${importPkgName}" is imported but not in package.json`,
            suggestion: `Add "${importPkgName}" to dependencies or remove the import`,
          });
        }
      }
    }
  }

  return {
    name: 'imports',
    findings,
    stats: {
      phantomPackages: phantomPackageCount,
      brokenRelativeImports: brokenRelativeCount,
    },
  };
}
