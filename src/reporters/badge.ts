const GRADE_COLORS: Record<string, string> = {
  A: 'brightgreen',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

export function generateBadge(grade: string): string {
  const color = GRADE_COLORS[grade] || 'lightgrey';
  return `![Codebase Health: ${grade}](https://img.shields.io/badge/codebase_health-${grade}-${color})`;
}
