import { writeFileSync } from 'node:fs';
import type { ExplodeReport, TimeBomb } from '../types.js';

function scoreBarHtml(score: number, label: string): string {
  let color: string;
  if (score >= 85) color = '#22c55e';
  else if (score >= 70) color = '#84cc16';
  else if (score >= 55) color = '#eab308';
  else if (score >= 40) color = '#f97316';
  else color = '#ef4444';

  return `
    <div class="score-row">
      <span class="score-label">${label}</span>
      <div class="score-track">
        <div class="score-fill" style="width: ${score}%; background: ${color}"></div>
      </div>
      <span class="score-value">${score}</span>
    </div>`;
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#ef4444',
    warning: '#f97316',
    info: '#3b82f6',
  };
  return `<span class="severity-badge" style="background: ${colors[severity] || '#6b7280'}">${severity}</span>`;
}

function timeBombTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'hallucinated-import': '&#x1F47B;',
    'orphaned-code': '&#x1F480;',
    'copy-paste-drift': '&#x1F4CB;',
    'naming-inconsistency': '&#x1F3F7;',
    'unhandled-edge-case': '&#x26A1;',
    'hardcoded-secret': '&#x1F511;',
    'circular-dependency': '&#x1F504;',
  };
  return icons[type] || '&#x1F4A3;';
}

function timeBombRow(tb: TimeBomb): string {
  const location = tb.line ? `${tb.file}:${tb.line}` : tb.file;
  return `
    <tr>
      <td>${severityBadge(tb.severity)}</td>
      <td>${timeBombTypeIcon(tb.type)} ${tb.type.replace(/-/g, ' ')}</td>
      <td>${escapeHtml(tb.description)}</td>
      <td class="location">${escapeHtml(location)}</td>
      <td class="suggestion">${tb.suggestion ? escapeHtml(tb.suggestion) : ''}</td>
    </tr>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#84cc16';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
    default: return '#6b7280';
  }
}

export function generateHtmlReport(report: ExplodeReport, outputPath: string): void {
  const { scores, timeBombs, arch, repoName, mode, duration } = report;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>reposcan: ${escapeHtml(repoName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;
    max-width: 960px; margin: 0 auto;
  }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 18px; font-weight: 600; margin: 32px 0 16px; color: #a3a3a3; text-transform: uppercase; letter-spacing: 1px; }
  .meta { color: #737373; font-size: 14px; margin-bottom: 32px; }
  .grade-box {
    display: inline-flex; align-items: center; justify-content: center;
    width: 80px; height: 80px; border-radius: 16px; font-size: 48px; font-weight: 800;
    margin-right: 24px; vertical-align: middle;
    background: ${gradeColor(scores.grade)}22; color: ${gradeColor(scores.grade)};
    border: 2px solid ${gradeColor(scores.grade)}44;
  }
  .header { display: flex; align-items: center; margin-bottom: 32px; }
  .header-text { flex: 1; }
  .score-row { display: flex; align-items: center; margin-bottom: 12px; }
  .score-label { width: 140px; font-size: 14px; color: #a3a3a3; }
  .score-track { flex: 1; height: 24px; background: #1a1a1a; border-radius: 12px; overflow: hidden; margin: 0 12px; }
  .score-fill { height: 100%; border-radius: 12px; transition: width 0.5s; }
  .score-value { width: 36px; text-align: right; font-weight: 600; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 8px; border-bottom: 1px solid #262626; color: #737373; font-weight: 500; }
  td { padding: 10px 8px; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
  tr:hover { background: #111; }
  .severity-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; text-transform: uppercase; }
  .location { color: #525252; font-family: 'SF Mono', Monaco, monospace; font-size: 12px; }
  .suggestion { color: #737373; font-style: italic; }
  .badge-section { margin-top: 32px; padding: 16px; background: #111; border-radius: 8px; }
  .badge-section code { font-family: 'SF Mono', Monaco, monospace; font-size: 13px; color: #e5e5e5; }
  .lang-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin-top: 8px; }
  .lang-segment { height: 100%; }
  .lang-list { margin-top: 12px; }
  .lang-item { display: flex; align-items: center; font-size: 13px; margin-bottom: 6px; }
  .lang-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
  .footer { margin-top: 48px; text-align: center; color: #525252; font-size: 13px; }
  .footer a { color: #737373; }
  .no-bombs { text-align: center; padding: 32px; color: #22c55e; font-size: 18px; }
</style>
</head>
<body>

<div class="header">
  <div class="grade-box">${scores.grade}</div>
  <div class="header-text">
    <h1>${escapeHtml(repoName)}</h1>
    <div class="meta">
      ${mode === 'ai-enhanced' ? '&#x1F916; AI-Enhanced' : '&#x26A1; Static'} Analysis &middot;
      ${arch.totalFiles} files &middot;
      ${arch.totalLines.toLocaleString()} lines &middot;
      ${(duration / 1000).toFixed(1)}s &middot;
      Overall: ${scores.overall}/100
    </div>
  </div>
</div>

<h2>Vital Signs</h2>
${scoreBarHtml(scores.security, 'Security')}
${scoreBarHtml(scores.resilience, 'Resilience')}
${scoreBarHtml(scores.comprehension, 'Comprehension')}
${scoreBarHtml(scores.dependencyHealth, 'Dependencies')}

<h2>&#x1F4A3; Time Bombs (${timeBombs.length})</h2>
${timeBombs.length > 0 ? `
<table>
  <thead>
    <tr><th>Severity</th><th>Type</th><th>Description</th><th>Location</th><th>Fix</th></tr>
  </thead>
  <tbody>
    ${timeBombs.map(timeBombRow).join('')}
  </tbody>
</table>` : '<div class="no-bombs">&#x2705; No time bombs detected!</div>'}

<h2>Languages</h2>
${(() => {
  const langColors: Record<string, string> = {
    typescript: '#3178c6', javascript: '#f7df1e', python: '#3572A5', go: '#00ADD8', rust: '#dea584',
  };
  const sortedLangs = Object.entries(arch.languages).sort((a, b) => b[1] - a[1]);
  const total = arch.totalLines;
  const barSegments = sortedLangs.map(([lang, lines]) =>
    `<div class="lang-segment" style="width: ${(lines / total) * 100}%; background: ${langColors[lang] || '#6b7280'}" title="${lang}: ${lines} lines"></div>`
  ).join('');
  const langItems = sortedLangs.map(([lang, lines]) =>
    `<div class="lang-item"><div class="lang-dot" style="background: ${langColors[lang] || '#6b7280'}"></div>${lang} &mdash; ${lines.toLocaleString()} lines (${Math.round((lines / total) * 100)}%)</div>`
  ).join('');
  return `<div class="lang-bar">${barSegments}</div><div class="lang-list">${langItems}</div>`;
})()}

<div class="badge-section">
  <strong>Add to your README:</strong><br><br>
  <code>![Codebase Health: ${scores.grade}](https://img.shields.io/badge/codebase_health-${scores.grade}-${scores.grade === 'A' ? 'brightgreen' : scores.grade === 'B' ? 'green' : scores.grade === 'C' ? 'yellow' : scores.grade === 'D' ? 'orange' : 'red'})</code>
</div>

<div class="footer">
  Generated by <a href="https://github.com/nicolai/reposcan">reposcan</a> &middot; ${report.analyzedAt.split('T')[0]}
</div>

</body>
</html>`;

  writeFileSync(outputPath, html, 'utf-8');
}
