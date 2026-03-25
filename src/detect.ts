import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out',
  'coverage', '.cache', 'vendor', '__pycache__', '.venv', 'venv',
  '.idea', '.vscode', '.turbo', '.vercel', '.output',
]);

const LANG_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
};

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  language: string;
  lines: number;
  content: string;
}

export function discoverFiles(repoPath: string): SourceFile[] {
  const files: SourceFile[] = [];
  walk(repoPath, repoPath, files);
  return files;
}

function walk(dir: string, root: string, results: SourceFile[]): void {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    if (entry.startsWith('.')) continue;

    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walk(fullPath, root, results);
    } else if (stat.isFile()) {
      const ext = extname(entry).toLowerCase();
      const language = LANG_EXTENSIONS[ext];
      if (!language) continue;

      try {
        const content = readFileSync(fullPath, 'utf-8');
        results.push({
          absolutePath: fullPath,
          relativePath: relative(root, fullPath),
          language,
          lines: content.split('\n').length,
          content,
        });
      } catch {
        // skip unreadable files
      }
    }
  }
}

export function summarizeLanguages(files: SourceFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    counts[f.language] = (counts[f.language] || 0) + f.lines;
  }
  return counts;
}
