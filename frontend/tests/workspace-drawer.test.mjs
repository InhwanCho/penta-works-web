import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(mobile = true) {
  const exports = {}, effects = [];
  const document = { body: { style: { overflow: 'auto' } }, activeElement: null };
  class Element { closest() { return null; } }
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/workspace-drawer.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, document, Element, HTMLElement: Element, require(name) {
    if (name.includes('use-mobile-workspace')) return { useMobileWorkspace: () => mobile };
    if (name === 'react') return {
      useId: () => 'title', useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect: fn => effects.push(fn),
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    return {};
  } });
  function mount() {
    let closes = 0;
    const opened = [];
    const tree = exports.default({ title: '날짜', children: null, onClose: () => closes++, onOpenDetail: href => opened.push(href) });
    const dialog = { showModal() {}, close() {}, focus() {}, getBoundingClientRect: () => ({ top: 300, left: 0, right: 390, bottom: 844 }) };
    tree.props.ref.current = dialog;
    const cleanup = effects.shift()();
    return { tree, dialog, cleanup, opened, count: () => closes };
  }
  return { mount, document, Element };
}
test('stacked drawers retain scroll lock until all close, including parent-first route cleanup', () => {
  for (const parentFirst of [false, true]) {
    const h = harness(), parent = h.mount(), child = h.mount();
    (parentFirst ? parent : child).cleanup();
    assert.equal(h.document.body.style.overflow, 'hidden');
    (parentFirst ? child : parent).cleanup();
    assert.equal(h.document.body.style.overflow, 'auto');
  }
});
test('downward drag dismisses; upward, short and cancelled gestures preserve the drawer', () => {
  const h = harness(), drawer = h.mount();
  const grip = drawer.tree.props.children[0].props;
  const event = y => ({ pointerId: 1, clientY: y, target: new h.Element(), currentTarget: { setPointerCapture() {} } });
  grip.onPointerDown(event(100)); grip.onPointerUp(event(130));
  grip.onPointerDown(event(100)); grip.onPointerUp(event(10));
  grip.onPointerDown(event(100)); grip.onPointerCancel(); grip.onPointerUp(event(220));
  assert.equal(drawer.count(), 0);
  grip.onPointerDown(event(100)); grip.onPointerUp(event(200));
  assert.equal(drawer.count(), 1);
  drawer.cleanup();
});
test('backdrop and Escape close while clicks inside the drawer do not', () => {
  const h = harness(), drawer = h.mount(), props = drawer.tree.props;
  const click = (x, y) => props.onClick({ target: drawer.dialog, currentTarget: drawer.dialog, clientX: x, clientY: y });
  click(20, 400); assert.equal(drawer.count(), 0);
  click(20, 200); assert.equal(drawer.count(), 1);
  props.onCancel({ preventDefault() {} }); assert.equal(drawer.count(), 2);
  drawer.cleanup();
});
test('detail links stay in drawers while edit/create links and modified clicks keep normal navigation', () => {
  const h = harness(), drawer = h.mount();
  const click = (href, extra = {}) => {
    const target = new h.Element();
    target.closest = () => ({ getAttribute: () => href });
    let prevented = false;
    drawer.tree.props.children[2].props.onClickCapture({ button: 0, target, preventDefault() { prevented = true; }, stopPropagation() {}, ...extra });
    return prevented;
  };
  assert.equal(click('/work/7'), true);
  assert.equal(click('/sites/001#inspection-plan'), true);
  assert.equal(click('/schedule?date=2026-10-26#schedule-1'), true);
  assert.equal(click('/work/new?date=2026-10-26'), false);
  assert.equal(click('/schedule?date=2026-10-26&edit=1'), false);
  assert.equal(click('/work/7', { ctrlKey: true }), false);
  assert.equal(drawer.opened.length, 3);
  drawer.cleanup();
});

test('desktop keeps centered dialogs, ordinary detail navigation and no drag dismissal', () => {
  const h = harness(false), drawer = h.mount();
  assert.match(drawer.tree.props.className, /workspace-desktop-dialog/);
  assert.doesNotMatch(drawer.tree.props.className, / workspace-drawer /);
  const grip = drawer.tree.props.children[0].props;
  const event = y => ({ pointerId: 1, clientY: y, target: new h.Element(), currentTarget: { setPointerCapture() {} } });
  grip.onPointerDown(event(100)); grip.onPointerUp(event(220));
  assert.equal(drawer.count(), 0);
  const target = new h.Element(); target.closest = () => ({ getAttribute: () => '/work/7' });
  drawer.tree.props.children[2].props.onClickCapture({ button: 0, target, preventDefault() { assert.fail('desktop should navigate'); }, stopPropagation() {} });
  assert.equal(drawer.opened.length, 0);
  drawer.cleanup();
});
