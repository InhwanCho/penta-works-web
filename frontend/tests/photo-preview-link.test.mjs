import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const out = {}, windows = [];
const source = ts.transpileModule(fs.readFileSync(new URL('../src/components/common/photo-preview-link.tsx', import.meta.url), 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(source, { exports: out, window: { open: (...args) => windows.push(args) }, require: name => name === 'react' ? { useRef: value => ({ current: value }) } : { jsx: (type, props) => ({ type, props }) } });
const click = (tree, timeStamp, detail = 1) => { let prevented = false; tree.props.onClick({ timeStamp, detail, preventDefault: () => { prevented = true; } }); assert.ok(prevented); };
test('one pointer click does not open; second click opens exactly once including native dblclick event', () => {
 let opens = 0;
 const tree = out.default({ href: '/photo.jpg', label: '사진', onOpen: () => opens++ });
 click(tree, 100); assert.equal(opens, 0);
 click(tree, 250, 2); assert.equal(opens, 1);
 tree.props.onDoubleClick({ preventDefault() {} }); assert.equal(opens, 1);
 click(tree, 300, 3); assert.equal(opens, 1);
});
test('double touch taps work even when each synthesized click reports detail 1', () => {
 let opens = 0; const tree = out.default({ href: '/photo.jpg', label: '사진', onOpen: () => opens++ });
 click(tree, 100); click(tree, 450); assert.equal(opens, 1);
 click(tree, 700); assert.equal(opens, 1); click(tree, 900); assert.equal(opens, 2);
});
test('slow clicks and clicks on different photos are not paired', () => {
 let opens = 0; const props = { href: '/photo.jpg', label: '사진', onOpen: () => opens++ };
 const first = out.default(props), second = out.default(props);
 click(first, 100); click(second, 200); assert.equal(opens, 0);
 click(first, 800); assert.equal(opens, 0); click(first, 900); assert.equal(opens, 1);
});
test('native keyboard activation retains a usable accessible photo action', () => {
 let opens = 0; const tree = out.default({ href: '/photo.jpg', label: '측정 사진', onOpen: () => opens++ });
 click(tree, 100, 0); assert.equal(opens, 1); assert.match(tree.props['aria-label'], /두 번/);
});
test('external legacy photos open a new tab only after double activation', () => {
 windows.length = 0; const tree = out.default({ href: 'blob:legacy-photo', label: '사진' });
 click(tree, 100); assert.equal(windows.length, 0); click(tree, 200, 2);
 assert.equal(windows.length, 1); assert.equal(windows[0][0], 'blob:legacy-photo'); assert.match(windows[0][2], /noopener/);
});
