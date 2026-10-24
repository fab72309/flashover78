// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentDetail from './DocumentDetail';

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(), getCachedDocumentUrl: vi.fn(),
  getDocumentDownloadUrl: vi.fn(), listDocumentVersions: vi.fn(),
  user: { id: 'user-a', role: 'member' }, revoke: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'document-a' }), useNavigate: () => vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../services/supabaseService', () => ({
  getDocumentById: mocks.getDocumentById,
  getCachedDocumentUrl: mocks.getCachedDocumentUrl,
  getDocumentDownloadUrl: mocks.getDocumentDownloadUrl,
  listDocumentVersions: mocks.listDocumentVersions,
  cacheDocumentForOffline: vi.fn(), deleteCatalogDocument: vi.fn(),
  getDocumentVersionDownloadUrl: vi.fn(), removeDocumentFromOffline: vi.fn(),
  replaceDocumentVersion: vi.fn(), toggleDocumentFavorite: vi.fn(), updateDocumentMetadata: vi.fn(),
}));

const resource = {
  id: 'document-a', title: 'Document privé A', versionLabel: '1.0',
  category: 'AUTRE', originalFilename: 'document.pdf', fileSize: 10,
  tags: [], isOfflineSelected: true, isFavorite: false,
  effectiveAt: null, expiresAt: null, authorName: 'Auteur',
};
let container: HTMLDivElement;
let root: Root;
async function render() {
  await act(async () => { root.render(<DocumentDetail />); });
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('URL', { revokeObjectURL: mocks.revoke });
  mocks.user = { id: 'user-a', role: 'member' };
  mocks.getDocumentById.mockResolvedValue(resource);
  mocks.getCachedDocumentUrl.mockResolvedValue('blob:private-document-a');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.unstubAllGlobals();
});

describe('document detail during a genuine network outage', () => {
  it('opens and downloads the cached blob without requesting versions or signed URLs', async () => {
    await render();
    expect(container.textContent).toContain('Document privé A');
    const links = [...container.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['blob:private-document-a', 'blob:private-document-a']);
    expect(links[1].getAttribute('download')).toBe('document.pdf');
    expect(mocks.listDocumentVersions).not.toHaveBeenCalled();
    expect(mocks.getDocumentDownloadUrl).not.toHaveBeenCalled();
    expect(container.textContent).toContain('L’historique sera disponible au retour du réseau.');
  });

  it('reports a missing or expired cache without falling back to the network', async () => {
    mocks.getCachedDocumentUrl.mockResolvedValue(null);
    await render();
    expect(container.textContent).toContain('conservation de 24 heures a expiré');
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(mocks.listDocumentVersions).not.toHaveBeenCalled();
    expect(mocks.getDocumentDownloadUrl).not.toHaveBeenCalled();
  });

  it('discards and revokes a delayed blob when the account has changed', async () => {
    let resolveBlob!: (value: string) => void;
    mocks.getCachedDocumentUrl.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveBlob = resolve; }));
    await render();
    mocks.user = { id: 'user-b', role: 'member' };
    mocks.getDocumentById.mockResolvedValue(null);
    await render();
    await act(async () => { resolveBlob('blob:private-document-a'); });
    expect(container.textContent).not.toContain('Document privé A');
    expect(container.querySelector('[href="blob:private-document-a"]')).toBeNull();
    expect(mocks.revoke).toHaveBeenCalledWith('blob:private-document-a');
  });

  it.each(['missing', 'error'])('revokes an already displayed blob when the new account detail is %s', async (outcome) => {
    await render();
    expect(container.querySelector('[href="blob:private-document-a"]')).not.toBeNull();
    mocks.user = { id: 'user-b', role: 'member' };
    if (outcome === 'missing') mocks.getDocumentById.mockResolvedValue(null);
    else mocks.getDocumentById.mockRejectedValue(new Error('unavailable'));
    await render();
    expect(container.textContent).not.toContain('Document privé A');
    expect(container.querySelector('[href="blob:private-document-a"]')).toBeNull();
    expect(mocks.revoke).toHaveBeenCalledWith('blob:private-document-a');
  });
});
