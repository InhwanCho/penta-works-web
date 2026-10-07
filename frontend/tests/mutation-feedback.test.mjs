import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(relativePath, modules = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exported = {};
  vm.runInNewContext(source, { exports: exported, require: name => modules[name], Headers, FormData, Error, process: { env: {} }, window: {}, ...globals });
  return exported;
}
const { mutationSuccessMessage } = load('../src/lib/mutation-feedback.ts');
test('policy and dashboard visibility messages reflect the saved state', () => {
  const options = { method: 'PATCH', body: JSON.stringify({ enabled: true }) };
  assert.equal(mutationSuccessMessage('/alerts/policy/001', options, { alertsEnabled: true }), '알림이 켜졌습니다.');
  assert.equal(mutationSuccessMessage('/alerts/policy/001', options, { alertsEnabled: false }), '알림이 꺼졌습니다.');
  assert.match(mutationSuccessMessage('/admin/accounts/sites/001/visibility', { method: 'PATCH', body: '{"visible":false}' }), /숨겼습니다/);
});
test('reads and public authentication requests never show mutation feedback', () => {
  assert.equal(mutationSuccessMessage('/alerts/thresholds', {}), null);
  for (const path of ['/auth/refresh', '/auth/login', '/auth/invitations/token/accept', '/auth/password-resets/token']) {
    assert.equal(mutationSuccessMessage(path, { method: 'POST' }), null);
  }
});
test('settings saved from any page have feedback and failed mail delivery is not described as sent', () => {
  for (const path of ['/alerts/thresholds/001', '/alerts/thresholds/001/metrics/hepres', '/company/metrics', '/auth/profile', '/platform/companies/1/profile']) {
    assert.ok(mutationSuccessMessage(path, { method: 'PATCH' }));
  }
  assert.match(mutationSuccessMessage('/admin/accounts/invitations', { method: 'POST' }, { deliveryStatus: 'FAILED' }), /실패/);
});

function api(fetch) {
  const notifications = [];
  const exported = load('../src/lib/api.ts', {
    '@/lib/auth': { readStoredSession: () => null },
    '@/lib/mutation-feedback': { mutationSuccessMessage },
    '@/lib/toast': { showToast: (...args) => notifications.push(args) },
  }, { fetch });
  return { ...exported, notifications };
}
test('API emits success feedback only after a save completes, including empty responses', async () => {
  let complete;
  const { apiFetch, notifications } = api(() => new Promise(resolve => { complete = resolve; }));
  const request = apiFetch('/admin/accounts/sites/001/visibility', { method: 'PATCH', body: '{"visible":false}' });
  assert.deepEqual(notifications, []);
  complete(new Response(null, { status: 204 }));
  await request;
  assert.equal(notifications.length, 1);
  assert.match(notifications[0][0], /숨겼습니다/);
});
test('failed save preserves the API error and emits error feedback without success', async () => {
  const { apiFetch, notifications } = api(async () => new Response('{"message":"저장 실패"}', { status: 400 }));
  await assert.rejects(apiFetch('/alerts/policy/001', { method: 'PATCH' }), /저장 실패/);
  assert.deepEqual(notifications, [['저장 실패', 'error']]);
});
test('read requests remain silent', async () => {
  const { apiFetch, notifications } = api(async () => new Response('[]'));
  await apiFetch('/alerts/thresholds');
  assert.deepEqual(notifications, []);
});
