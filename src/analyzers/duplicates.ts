import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding } from '../types.js';

const MIN_BLOCK_LINES = 6;
const SIMILARITY_THRESHOLD = 0.85;

interface CodeBlock {
  file: string;
  startLine: number;
  endLine: number;
  normalized: string;
  raw: string;
}

function normalizeCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')           // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove multi-line comments
    .replace(/['"][^'"]*['"]/g, 'STR')  // Normalize strings
    .replace(/\d+/g, 'NUM')             // Normalize numbers
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .trim();
}

function extractBlocks(file: SourceFile): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = file.content.split('\n');

  // Extract function-level blocks
  let blockStart = -1;
  let braceDepth = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect function/method starts
    if (!inBlock && (
      trimmed.match(/(?:function|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>)/) ||
      trimmed.match(/^\s*(?:async\s+)?[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/)
    )) {
      blockStart = i;
      inBlock = true;
      braceDepth = 0;
    }

    if (inBlock) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      if (braceDepth <= 0 && blockStart >= 0) {
        const blockLines = lines.slice(blockStart, i + 1);
        if (blockLines.length >= MIN_BLOCK_LINES) {
          const raw = blockLines.join('\n');
          blocks.push({
            file: file.relativePath,
            startLine: blockStart + 1,
            endLine: i + 1,
            normalized: normalizeCode(raw),
            raw,
          });
        }
        inBlock = false;
        blockStart = -1;
      }
    }
  }

  return blocks;
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Simple Jaccard similarity on tokens
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  return intersection / (tokensA.size + tokensB.size - intersection);
}

export function analyzeDuplicates(files: SourceFile[]): AnalyzerResult {
  const findings: Finding[] = [];
  let duplicateCount = 0;

  // Collect all blocks
  const allBlocks: CodeBlock[] = [];
  for (const file of files) {
    allBlocks.push(...extractBlocks(file));
  }

  // Compare blocks (O(n^2) but blocks count is manageable)
  const reported = new Set<string>();
  for (let i = 0; i < allBlocks.length; i++) {
    for (let j = i + 1; j < allBlocks.length; j++) {
      const a = allBlocks[i];
      const b = allBlocks[j];

      // Skip same file, nearby blocks
      if (a.file === b.file && Math.abs(a.startLine - b.startLine) < MIN_BLOCK_LINES) continue;

      // Quick length check
      const lenRatio = Math.min(a.normalized.length, b.normalized.length) /
                       Math.max(a.normalized.length, b.normalized.length);
      if (lenRatio < 0.7) continue;

      const sim = similarity(a.normalized, b.normalized);
      if (sim >= SIMILARITY_THRESHOLD) {
        const key = [a.file, a.startLine, b.file, b.startLine].sort().join(':');
        if (reported.has(key)) continue;
        reported.add(key);

        duplicateCount++;
        findings.push({
          analyzer: 'duplicates',
          severity: 'warning',
          file: a.file,
          line: a.startLine,
          message: `Near-duplicate code block (${Math.round(sim * 100)}% similar to ${b.file}:${b.startLine})`,
          suggestion: 'Extract shared logic into a reusable function',
        });
      }
    }
  }

  return {
    name: 'duplicates',
    findings,
    stats: {
      duplicateBlocks: duplicateCount,
      totalBlocks: allBlocks.length,
    },
  };
}
