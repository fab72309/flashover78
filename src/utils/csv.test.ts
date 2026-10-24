import { describe, expect, it } from 'vitest';
import { createCsv } from './csv';

describe('createCsv', () => {
  it('échappe les guillemets et conserve les séparateurs dans une cellule', () => {
    expect(createCsv(['Nom'], [['Durand; "Alex"']])).toBe(
      '"Nom"\r\n"Durand; ""Alex"""'
    );
  });

  it('neutralise les formules de tableur', () => {
    expect(createCsv(['Valeur'], [['=HYPERLINK("x")']])).toContain(
      '"\'=HYPERLINK(""x"")"'
    );
  });

  it('neutralise aussi les contrôles initiaux et opérateurs pleine largeur', () => {
    const csv = createCsv(
      ['Valeur'],
      [['\t=CMD()'], ['\r@SUM(1)'], ['＝HYPERLINK("x")']]
    );

    expect(csv).toContain('"\'\t=CMD()"');
    expect(csv).toContain('"\'\r@SUM(1)"');
    expect(csv).toContain('"\'＝HYPERLINK(""x"")"');
  });
});
