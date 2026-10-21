import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function mount({ top = true, esc = true, nativeDialog = false } = {}) {
  const listeners = new Map(), cleanups = [];
  let closes = 0, callbacks = 0;
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/components/common/custom-modal.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    document: { body: {}, querySelector: () => nativeDialog ? {} : null },
    window: { addEventListener: (k, fn) => listeners.set(k, fn), removeEventListener: (k) => listeners.delete(k) },
    require: (name) => {
      if (name === 'react') return { useCallback: (fn) => fn, useEffect: (fn) => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } };
      if (name === 'react-dom') return { createPortal: (node) => node };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name.includes('modal-provider')) return { useModal: () => ({ isOpen: true, isTopModal: top, close: () => closes++, zIndex: 1010 }) };
      return { default: () => null };
    },
  });
  const tree = exports.default({ id: 'test', closeOnEsc: esc, onRequestClose: () => callbacks++, children: null });
  return { tree, key: (extra = {}) => listeners.get('keydown')?.({ key: 'Escape', preventDefault() {}, ...extra }), counts: () => [closes, callbacks], cleanup: () => cleanups.forEach((fn) => fn()) };
}
test('Escape closes only the top modal and invokes its close callback once', () => {
  const back = mount({ top: false }), front = mount();
  back.key(); front.key();
  assert.deepEqual(back.counts(), [0, 0]); assert.deepEqual(front.counts(), [1, 1]);
  assert.equal(back.tree.props.onClick, undefined);
  front.cleanup(); front.key(); assert.deepEqual(front.counts(), [1, 1]);
});
test('disabled Escape, held Escape, consumed events and native dialogs preserve the managed modal', () => {
  for (const options of [{ esc: false }, { nativeDialog: true }]) {
    const modal = mount(options); modal.key(); assert.deepEqual(modal.counts(), [0, 0]);
  }
  const modal = mount(); modal.key({ repeat: true }); modal.key({ defaultPrevented: true });
  assert.deepEqual(modal.counts(), [0, 0]);
});
