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
});
