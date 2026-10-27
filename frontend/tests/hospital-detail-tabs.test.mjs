import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(hash = '') {
  let active = 'measurements', mounted = false;
  const effects = [], listeners = new Map(), refs = { current: [] }, exports = {};
  const window = { location: { hash }, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/components/site/hospital-detail-tabs.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, window, require(name) {
    if (name === 'react') return {
      useState: () => [active, value => { active = value; }], useId: () => 'tabs', useRef: () => refs,
      useLayoutEffect: fn => { if (!mounted) effects.push(fn); },
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    return {};
  } });
  return {
    refs, window, listeners,
    render(monitoringConnected = true) {
      const tree = exports.default({ monitoringConnected, management: 'hospital information', children: 'graphs' });
      effects.splice(0).forEach(fn => fn());
      mounted = true;
      return tree;
    },
  };
}

test('graphs are the default; selecting management preserves a single visible panel', () => {
  const h = harness();
  let tree = h.render();
  assert.equal(tree.props.children[1].props.hidden, false);
  assert.equal(tree.props.children[2].props.hidden, true);
  tree.props.children[0].props.children[1].props.onClick();
  tree = h.render();
  assert.equal(tree.props.children[1].props.hidden, true);
  assert.equal(tree.props.children[1].props.children, false);
  assert.equal(tree.props.children[2].props.hidden, false);
  assert.equal(tree.props.children[0].props.children[1].props['aria-selected'], true);
});

test('inspection deep links and later section links reveal management', () => {
  const h = harness('#inspection-plan');
  h.render();
  assert.equal(h.render().props.children[2].props.hidden, false);
  h.render().props.children[0].props.children[0].props.onClick();
  h.window.location.hash = '#hospital-equipment';
  h.listeners.get('hashchange')();
  assert.equal(h.render().props.children[2].props.hidden, false);
});

test('keyboard navigation changes the selected tab and focuses its button', () => {
  const h = harness(); let focused = false, prevented = false;
  h.refs.current[1] = { focus: () => { focused = true; } };
  h.render().props.children[0].props.children[0].props.onKeyDown({ key: 'ArrowRight', preventDefault: () => { prevented = true; } });
  assert.equal(h.render().props.children[2].props.hidden, false);
  assert.equal(focused && prevented, true);
});

test('hospitals without monitoring show management directly', () => {
  assert.equal(harness().render(false).props.children, 'hospital information');
});
