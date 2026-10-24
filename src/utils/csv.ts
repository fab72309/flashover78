function protectSpreadsheetFormula(value: string) {
  // Spreadsheet engines differ on which leading controls/Unicode operators
  // they normalize before interpreting a cell as a formula.
  let firstMeaningfulCharacter = 0;
  while (
    firstMeaningfulCharacter < value.length &&
    value.charCodeAt(firstMeaningfulCharacter) <= 0x20
  ) {
    firstMeaningfulCharacter += 1;
  }

  const formulaPrefixes = new Set(['=', '+', '-', '@', '＝', '＋', '－', '＠']);
  return formulaPrefixes.has(value[firstMeaningfulCharacter]) ? `'${value}` : value;
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
