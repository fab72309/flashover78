// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMfaGate from './AdminMfaGate';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), listFactors: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(),
  challengeAndVerify: vi.fn(), logout: vi.fn(), session: { access_token: 'aal1-token' },
}));
vi.mock('../lib/supabase', () => ({ supabase: {
  rpc: mocks.rpc,
  auth: { mfa: { listFactors: mocks.listFactors, enroll: mocks.enroll, unenroll: mocks.unenroll, challengeAndVerify: mocks.challengeAndVerify } },
} }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ session: mocks.session, logout: mocks.logout }) }));

let container: HTMLDivElement;
let root: Root;
const verified = { id: 'verified', factor_type: 'totp', status: 'verified', friendly_name: 'Mon téléphone' };
async function render() {
  await act(async () => { root.render(<AdminMfaGate><div>SECRET ADMIN</div></AdminMfaGate>); });
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.includes(label));
  expect(button).toBeDefined();
  await act(async () => { button!.click(); });
}
async function submitCode(code: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.session = { access_token: 'aal1-token' };
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.listFactors.mockResolvedValue({ data: { totp: [verified], all: [verified] }, error: null });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

describe('admin TOTP gate', () => {
  it('requires a challenge without mounting privileged content', async () => {
    await render();
    expect(container.textContent).toContain('Code à 6 chiffres');
    expect(container.textContent).not.toContain('SECRET ADMIN');
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it('fails closed if the server check is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') });
    await render();
    expect(container.textContent).toContain('L’accès reste verrouillé');
    expect(container.textContent).not.toContain('SECRET ADMIN');
  });
  it('unlocks only on a positive server check', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await render();
    expect(container.textContent).toContain('SECRET ADMIN');
    expect(mocks.listFactors).not.toHaveBeenCalled();
  });
  it('never reuses approval after the session token changes', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    await render();
    mocks.session = { access_token: 'new-aal1-token' };
    mocks.rpc.mockImplementation(() => new Promise(() => undefined));
    await render();
    expect(container.textContent).not.toContain('SECRET ADMIN');
  });
  it('enrolls explicitly and removes only incomplete factors', async () => {
    const pending = { ...verified, id: 'pending', status: 'unverified' };
    mocks.listFactors.mockResolvedValue({ data: { totp: [], all: [pending, verified] }, error: null });
    mocks.unenroll.mockResolvedValue({ error: null });
    mocks.enroll.mockResolvedValue({ data: { id: 'new', totp: { qr_code: 'data:image/svg+xml,test', secret: 'SHAREDSECRET' } }, error: null });
    await render();
    expect(mocks.enroll).not.toHaveBeenCalled();
    await click('Configurer');
    expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: 'pending' });
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml,test');
    expect(container.textContent).not.toContain('SECRET ADMIN');
  });
  it('does not challenge an incomplete factor and offers enrollment', async () => {
    const pending = { ...verified, id: 'pending', status: 'unverified' };
    mocks.listFactors.mockResolvedValue({ data: { totp: [pending], all: [pending] }, error: null });
    await render();
    expect(container.textContent).toContain('Configurer mon application TOTP');
    expect(container.textContent).not.toContain('Code à 6 chiffres');
    expect(container.textContent).not.toContain('SECRET ADMIN');
  });
  it('keeps access locked after an invalid code', async () => {
    mocks.challengeAndVerify.mockResolvedValue({ error: new Error('invalid OTP') });
    await render();
    await submitCode('123456');
    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'verified', code: '123456' });
    expect(container.textContent).toContain('Code refusé');
    expect(container.textContent).not.toContain('SECRET ADMIN');
  });
  it('does not trust verification alone without subsequent database approval', async () => {
    mocks.challengeAndVerify.mockResolvedValue({ error: null });
    await render();
    await submitCode('123456');
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('SECRET ADMIN');
  });
});
