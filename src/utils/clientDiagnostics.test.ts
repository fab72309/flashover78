import { afterEach, describe, expect, it, vi } from 'vitest';
import { logClientFailure } from './clientDiagnostics';

describe('client diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs only a fixed context and never an error payload', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logClientFailure('Chargement du calendrier impossible');

    expect(consoleSpy).toHaveBeenCalledWith('[Flashover78] Chargement du calendrier impossible');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});
