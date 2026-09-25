import { describe, expect, it } from 'vitest';
import { parseStoredDarkMode } from './ThemeContext';

describe('parseStoredDarkMode', () => {
  it('accepts only the canonical boolean value', () => {
    expect(parseStoredDarkMode('true')).toBe(true);
    expect(parseStoredDarkMode('false')).toBe(false);
    expect(parseStoredDarkMode('"true"')).toBe(false);
  });

  it('fails closed for corrupt storage', () => {
    expect(parseStoredDarkMode('{broken')).toBe(false);
  });
});
