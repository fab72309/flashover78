function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function escapeCsvCell(value: unknown) {
  const text = protectSpreadsheetFormula(String(value ?? ''));
  return `"${text.replace(/"/g, '""')}"`;
}

export function createCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(';'))
    .join('\r\n');
}
