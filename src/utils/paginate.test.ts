import { describe, expect, it } from 'vitest';
import { fetchAllPages } from './paginate';

describe('fetchAllPages', () => {
  it('concatène les pages et conserve exactement la borne', async () => {
    const source = Array.from({ length: 5 }, (_, index) => index + 1);
    const result = await fetchAllPages(
      async (from, to) => ({ data: source.slice(from, to + 1), error: null }),
      'éléments',
      2,
      5,
    );

    expect(result).toEqual(source);
  });

  it('refuse silencieusement de tronquer une page supplémentaire', async () => {
    const source = Array.from({ length: 6 }, (_, index) => index + 1);

    await expect(
      fetchAllPages(
        async (from, to) => ({ data: source.slice(from, to + 1), error: null }),
        'éléments',
        2,
        5,
      ),
    ).rejects.toThrow('dépasse la limite');
  });

  it('propage l’erreur du fournisseur sans l’exposer dans la pagination', async () => {
    const providerError = new Error('provider failure');

    await expect(
      fetchAllPages(async () => ({ data: null, error: providerError }), 'éléments'),
    ).rejects.toBe(providerError);
  });
});
