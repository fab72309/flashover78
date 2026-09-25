export const QUERY_PAGE_SIZE = 100;
export const QUERY_MAX_ROWS = 1000;

type PageResponse<T> = {
  data: T[] | null;
  error: unknown | null;
};

/**
 * Read a PostgREST collection in bounded pages.
 *
 * The extra one-row probe makes the upper bound explicit: exactly 1000 rows
 * remain a valid result, while an 1001st row fails instead of being silently
 * hidden from the caller.
 */
export async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResponse<T>>,
  resourceLabel: string,
  pageSize = QUERY_PAGE_SIZE,
  maxRows = QUERY_MAX_ROWS,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxRows) {
    throw new Error('Paramètres de pagination invalides.');
  }

  const rows: T[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const to = Math.min(offset + pageSize - 1, maxRows - 1);
    const { data, error } = await loadPage(offset, to);
    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize && rows.length < maxRows) {
      return rows;
    }

    if (rows.length >= maxRows) {
      break;
    }
  }

  const { data, error } = await loadPage(maxRows, maxRows);
  if (error) {
    throw error;
  }
  if ((data ?? []).length > 0) {
    throw new Error(`La liste ${resourceLabel} dépasse la limite de pagination autorisée.`);
  }

  return rows;
}
