import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(stored, fetchImpl) {
  const values = new Map(stored ? [['pentaworks_session_v2', JSON.stringify(stored)]] : []);
  const events = [];
  const effects = [];
  const states = [];
  const retries = [];
  const deadlines = [];
  const window = {
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    dispatchEvent: event => events.push(event.type), addEventListener() {}, removeEventListener() {},
  };
  const modules = {
    '@/lib/mutation-feedback': { mutationSuccessMessage: () => null }, '@/lib/toast': { showToast() {} },
    '@/lib/public-auth-query': { clearPrivateQueries() {} },
    '@tanstack/react-query': { useQueryClient: () => ({ clear() {} }) },
    'react/jsx-runtime': { jsx: () => null },
    react: {
      createContext: value => ({ value }), useContext: context => context.value,
      useEffect: fn => effects.push(fn), useCallback: fn => fn, useMemo: fn => fn(),
      useState: initial => { const index = states.push(initial) - 1; return [initial, value => { states[index] = value; }]; },
    },
  };
  function load(path, id) {
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, {
      exports, require: key => modules[key], process: { env: {} }, window,
      fetch: fetchImpl, Headers, FormData, Event, Date, Error,
      AbortController,
      setTimeout: (fn, ms) => { if (ms === 15_000) { deadlines.push(fn); return setTimeout(fn, ms).unref(); } retries.push(fn); return retries.length; }, clearTimeout,
    });
    modules[id] = exports;
    return exports;
  }
  const auth = load('../src/lib/auth.ts', '@/lib/auth');
  const api = load('../src/lib/api.ts', '@/lib/api');
  return { auth, api, events, states, retries, deadlines, mount: () => {
    load('../src/components/provider/auth-provider.tsx', 'provider').AuthProvider({ children: null });
    return effects[0]();
  }};
}
const session = { id: 7, email: 'alice@example.com', name: 'Alice', role: 'USER', accessToken: 'old-access', accessTokenExpiresAt: '2020-01-01T00:00:00Z' };
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const refreshed = { accessToken: 'new-access', accessTokenExpiresAt: '2099-01-01T00:00:00Z', user: { id: 7, email: session.email, name: 'Alice', role: 'USER' } };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('deployment 503 preserves stored credentials and does not expire the account', async () => {
  const h = harness(session, async () => response(503, {}));
  await assert.rejects(h.api.refreshAccessToken(), error => error.status === 503);
  assert.equal(h.auth.readStoredSession().accessToken, 'old-access');
  assert.deepEqual(h.events, []);
});
test('a proxy permission error cannot erase a persistent login', async () => {
  const h = harness(session, async () => response(403, {}));
  await assert.rejects(h.api.refreshAccessToken(), error => error.status === 403);
  assert.equal(h.auth.readStoredSession().accessToken, 'old-access');
  assert.deepEqual(h.events, []);
});
test('definitively invalid refresh credentials still end the session', async () => {
  const h = harness(session, async () => response(401, {}));
  await assert.rejects(h.api.refreshAccessToken(), error => error.status === 401);
  assert.equal(h.auth.readStoredSession(), null);
  assert.deepEqual(h.events, ['auth:expired']);
});
test('parallel requests in the same app share one refresh', async () => {
  let calls = 0;
  const h = harness(session, async () => { calls++; return response(200, refreshed); });
  const results = await Promise.all([h.api.refreshAccessToken(), h.api.refreshAccessToken()]);
  assert.equal(calls, 1);
  assert.equal(results[0].accessToken, results[1].accessToken);
});
test('a failed older refresh cannot erase a newer login', async () => {
  let finish;
  const h = harness(session, () => new Promise(resolve => { finish = resolve; }));
  const pending = h.api.refreshAccessToken();
  await flush();
  h.auth.writeStoredSession({ ...session, accessToken: 'newer-login' });
  finish(response(401, {}));
  await assert.rejects(pending);
  assert.equal(h.auth.readStoredSession().accessToken, 'newer-login');
  assert.deepEqual(h.events, []);
});
test('API auth retry reports deployment failure without logging out', async () => {
  let calls = 0;
  const h = harness({ ...session, accessTokenExpiresAt: '2099-01-01T00:00:00Z' }, async () => response(++calls === 1 ? 401 : 503, {}));
  await assert.rejects(h.api.apiFetch('/dashboard'), error => error.status === 503);
  assert.equal(h.auth.readStoredSession().accessToken, 'old-access');
  assert.deepEqual(h.events, []);
});
test('a still-valid access token remains usable if proactive refresh briefly fails', async () => {
  const h = harness({ ...session, accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString() }, async url =>
    url.endsWith('/auth/refresh') ? response(503, {}) : response(200, { success: true }));
  assert.equal((await h.api.apiFetch('/dashboard')).success, true);
  assert.deepEqual(h.events, []);
});
test('app launch during deployment keeps an expired local session and restores it on retry', async () => {
  let available = false;
  const h = harness(session, async () => response(available ? 200 : 503, available ? refreshed : {}));
  const cleanup = h.mount();
  await flush();
  assert.equal(h.states[0].email, session.email);
  assert.equal(h.states[1], false);
  assert.equal(h.retries.length, 1);
  available = true;
  h.retries[0]();
  await flush();
  assert.equal(h.auth.readStoredSession().accessToken, 'new-access');
  assert.equal(h.states[0].email, session.email);
  cleanup();
});
test('cookie restoration during an outage waits instead of concluding the user is logged out', async () => {
  const h = harness(null, async () => { throw new TypeError('offline'); });
  const cleanup = h.mount();
  await flush();
  assert.equal(h.states[1], false);
  assert.match(h.states[2], /서버/);
  assert.equal(h.retries.length, 1);
  cleanup();
});


test('successful stale refresh cannot overwrite a changed account', async () => {
  let finish;
  const h = harness(session, () => new Promise(resolve => { finish = resolve; }));
  const pending = h.api.refreshAccessToken();
  await flush();
  h.auth.writeStoredSession({ ...session, id: 8, accessToken: 'newer-login' });
  finish(response(200, refreshed));
  assert.equal((await pending).id, 8);
  assert.equal(h.auth.readStoredSession().accessToken, 'newer-login');
});

test('successful stale refresh cannot revive a cleared session', async () => {
  let finish;
  const h = harness(session, () => new Promise(resolve => { finish = resolve; }));
  const pending = h.api.refreshAccessToken();
  await flush();
  h.auth.clearStoredSession();
  finish(response(200, refreshed));
  await assert.rejects(pending, error => error.status === 409);
  assert.equal(h.auth.readStoredSession(), null);
});

test('login waits for an outstanding refresh before changing the cookie', async () => {
  let finish;
  const calls = [];
  const h = harness(session, url => {
    calls.push(url);
    if (url.endsWith('/auth/refresh')) return new Promise(resolve => { finish = resolve; });
    return Promise.resolve(response(200, { ...refreshed, accessToken: 'login-token' }));
  });
  const pending = h.api.refreshAccessToken();
  await flush();
  const login = h.api.login(session.email, 'password');
  await flush();
  assert.equal(calls.length, 1);
  finish(response(200, refreshed));
  await pending;
  await login;
  assert.equal(h.auth.readStoredSession().accessToken, 'login-token');
});


test('a hanging refresh times out and releases the shared promise for retry', async () => {
  let calls = 0;
  const h = harness(session, () => ++calls === 1 ? new Promise(() => {}) : Promise.resolve(response(200, refreshed)));
  const pending = h.api.refreshAccessToken();
  await flush();
  h.deadlines[0]();
  await assert.rejects(pending, error => error.status === 0);
  assert.equal(h.auth.readStoredSession().accessToken, 'old-access');
  assert.equal((await h.api.refreshAccessToken()).accessToken, 'new-access');
});

test('a response body completing after timeout cannot overwrite a later login', async () => {
  let finishBody;
  const h = harness(session, () => Promise.resolve({ok: true, status: 200, json: () => new Promise(resolve => {finishBody = resolve;})}));
  const pending = h.api.refreshAccessToken();
  await flush();
  h.deadlines[0]();
  await assert.rejects(pending);
  h.auth.writeStoredSession({...session, accessToken: 'newer-login'});
  finishBody(refreshed);
  await flush();
  assert.equal(h.auth.readStoredSession().accessToken, 'newer-login');
  assert.deepEqual(h.events, []);
});
