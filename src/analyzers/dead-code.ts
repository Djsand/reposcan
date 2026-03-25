import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding } from '../types.js';

interface ExportedSymbol {
  name: string;
  file: string;
  line: number;
}

export function analyzeDeadCode(files: SourceFile[]): AnalyzerResult {
  const findings: Finding[] = [];
  const exportedSymbols: ExportedSymbol[] = [];
  const allImports = new Set<string>();
  let unusedExportCount = 0;
  let unusedVarCount = 0;

  // Pass 1: Collect all exports and imports across the codebase
  for (const file of files) {
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Collect exports
      const namedExportMatch = line.match(/export\s+(?:const|let|var|function|class|enum|type|interface)\s+([a-zA-Z_$][\w$]*)/);
      if (namedExportMatch) {
        exportedSymbols.push({ name: namedExportMatch[1], file: file.relativePath, line: i + 1 });
      }

      // Collect named exports from export { ... }
      const reExportMatch = line.match(/export\s*\{([^}]+)\}/);
      if (reExportMatch) {
        const names = reExportMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        for (const name of names) {
          exportedSymbols.push({ name, file: file.relativePath, line: i + 1 });
        }
      }

      // Collect imports (what's being used)
      const importMatch = line.match(/import\s*\{([^}]+)\}\s*from/);
      if (importMatch) {
        const names = importMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        for (const name of names) {
          allImports.add(name);
        }
      }

      // Default imports
      const defaultImportMatch = line.match(/import\s+([a-zA-Z_$][\w$]*)\s+from/);
      if (defaultImportMatch) {
        allImports.add(defaultImportMatch[1]);
      }
    }
  }

  // Pass 2: Find exports not imported anywhere else
  // Skip entry points and index files (they're meant to be consumed externally)
  for (const exported of exportedSymbols) {
    const isEntryFile = /(?:^|\/)index\.[tj]sx?$/.test(exported.file) ||
                        /(?:^|\/)main\.[tj]sx?$/.test(exported.file);
    if (isEntryFile) continue;

    // Check if any other file imports this symbol
    const isUsed = allImports.has(exported.name) ||
                   files.some(f =>
                     f.relativePath !== exported.file &&
                     f.content.includes(exported.name)
                   );

    if (!isUsed) {
      unusedExportCount++;
      findings.push({
        analyzer: 'dead-code',
        severity: 'warning',
        file: exported.file,
        line: exported.line,
        message: `Exported "${exported.name}" appears unused across the codebase`,
        suggestion: 'Remove the export or the entire declaration if unused',
      });
    }
  }

  // Pass 3: Find obvious unused local variables (simple regex)
  for (const file of files) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Find local variable declarations (not exported)
      if (line.match(/export\s/)) continue;
      const localVarMatch = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=/);
      if (!localVarMatch) continue;

      const varName = localVarMatch[1];
      if (varName.startsWith('_')) continue; // Intentionally unused

      // Check if the variable is used elsewhere in the file
      const restOfFile = lines.slice(i + 1).join('\n');
      const usageRegex = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!usageRegex.test(restOfFile)) {
        unusedVarCount++;
        findings.push({
          analyzer: 'dead-code',
          severity: 'info',
          file: file.relativePath,
          line: i + 1,
          message: `Variable "${varName}" is declared but never used in this file`,
          suggestion: 'Remove the unused variable',
        });
      }
    }
  }

  return {
    name: 'dead-code',
    findings,
    stats: {
      unusedExports: unusedExportCount,
      unusedVariables: unusedVarCount,
      totalExports: exportedSymbols.length,
    },
  };
}
