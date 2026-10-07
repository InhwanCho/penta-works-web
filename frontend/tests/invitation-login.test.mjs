import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function renderComponent(file, modules, initialState = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states = [];
  let index = 0;
  let effects = [];
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = slot in initialState ? initialState[slot] : typeof initial === 'function' ? initial() : initial;
      return [states[slot], value => { states[slot] = value; }];
    },
    useEffect(effect) { effects.push(effect); },
    useMemo(factory) { return factory(); },
    useCallback(callback) { return callback; },
  };
  const exported = {};
  vm.runInNewContext(source, {
    exports: exported,
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name in modules) return modules[name];
      if (name === 'next/image' || name === 'next/link' || name.startsWith('@/components/')) return { default: name };
      throw new Error(`Unexpected import: ${name}`);
    },
    window: { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } },
    Error,
  });
  return () => {
    index = 0;
    effects = [];
    const tree = exported.default();
    effects.forEach(effect => effect());
    return tree;
  };
}

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = find(child, type);
    if (match) return match;
  }
  return null;
}

const admin = { id: 1, email: 'admin@example.com', role: 'SUPER_ADMIN' };
const invitedEmail = 'invited@example.com';

function loginPage({ query = '', session = admin, isLoading = false, login = async () => {}, password = '' } = {}) {
  const redirects = [];
  const render = renderComponent('../src/components/auth/login-form.tsx', {
    'next/navigation': { useRouter: () => ({ replace: path => redirects.push(path) }), useSearchParams: () => new URLSearchParams(query) },
    '@/components/provider/auth-provider': { useAuth: () => ({ session, isLoading, login }) },
  }, { 2: password });
  return { render, redirects };
}

test('invitation signup requests explicit login for the invited email', async () => {
  const redirects = [];
  const requests = [];
  class ApiError extends Error {}
  const render = renderComponent('../src/components/auth/accept-invite-client.tsx', {
    'next/navigation': { useRouter: () => ({ replace: path => redirects.push(path) }), useSearchParams: () => new URLSearchParams('token=invite-token') },
    '@/lib/api': { ApiError, apiFetch: async (...args) => requests.push(args) },
    '@/lib/public-auth-query': { loadPublicAuth() {} },
    '@tanstack/react-query': { useQuery: () => ({ data: { email: invitedEmail, name: 'Invited', companyName: 'Company' } }) },
    'react-hook-form': { useForm: () => ({ formState: {}, handleSubmit: submit => () => submit({ password: 'new-password' }) }) },
  });
  await find(render(), 'form').props.onSubmit();
  assert.equal(requests[0][0], '/auth/invitations/invite-token/accept');
  assert.deepEqual(redirects, [`/login?reauthenticate=1&email=${encodeURIComponent(invitedEmail)}`]);
});

test('existing admin session cannot redirect away from invitation login', () => {
  const page = loginPage({ query: `reauthenticate=1&email=${invitedEmail}` });
  const form = find(page.render(), 'form');
  assert.ok(form);
  assert.equal(find(form, 'input').props.value, invitedEmail);
  assert.deepEqual(page.redirects, []);
});

test('invitation login waits for authentication bootstrap without redirecting the admin', () => {
  const page = loginPage({ query: `reauthenticate=1&email=${invitedEmail}`, isLoading: true });
  assert.equal(find(page.render(), 'form'), null);
  assert.deepEqual(page.redirects, []);
});

test('successful explicit login uses invited credentials before navigating', async () => {
  const credentials = [];
  const page = loginPage({
    query: `reauthenticate=1&email=${invitedEmail}`, password: 'new-password',
    login: async (...args) => { assert.deepEqual(page.redirects, []); credentials.push(args); },
  });
  await find(page.render(), 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(credentials, [[invitedEmail, 'new-password']]);
  assert.deepEqual(page.redirects, ['/']);
});

test('failed explicit login keeps the form and never falls back to the admin dashboard', async () => {
  const page = loginPage({
    query: `reauthenticate=1&email=${invitedEmail}`, password: 'wrong-password',
    login: async () => { throw new Error('Invalid credentials'); },
  });
  await find(page.render(), 'form').props.onSubmit({ preventDefault() {} });
  assert.ok(find(page.render(), 'form'));
  assert.deepEqual(page.redirects, []);
});

test('ordinary login still redirects an authenticated user and shows the form to a guest', () => {
  const authenticated = loginPage();
  assert.equal(find(authenticated.render(), 'form'), null);
  assert.deepEqual(authenticated.redirects, ['/']);
  const guest = loginPage({ session: null });
  assert.ok(find(guest.render(), 'form'));
  assert.deepEqual(guest.redirects, []);
});
