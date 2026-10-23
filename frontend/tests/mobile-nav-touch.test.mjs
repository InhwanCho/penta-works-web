import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class Element {
  constructor(link) { this.link = link; }
  closest() { return this.link; }
}
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/mobile-nav-touch.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, Element });
function setup() {
  let clicks = 0;
  const link = { isConnected: true, click() { clicks++; } };
  const target = new Element(link);
  const nav = { contains: item => item === link };
  const handlers = exports.createMobileNavTouchHandlers();
  const touch = (x = 0, y = 0, identifier = 1) => ({ clientX: x, clientY: y, identifier });
  const event = (extra = {}) => ({ target, currentTarget: nav, touches: [touch()], changedTouches: [touch()], timeStamp: 0, cancelable: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, ...extra });
  return { handlers, touch, event, link, clicks: () => clicks };
}
test('a short tap activates the anchor once and suppresses the compatibility click', () => {
  const s = setup(); s.handlers.onTouchStart(s.event());
  const end = s.event({ touches: [], timeStamp: 100 });
  s.handlers.onTouchEnd(end); s.handlers.onTouchEnd(end);
  assert.equal(s.clicks(), 1); assert.equal(end.defaultPrevented, true);
});
test('small finger jitter is accepted but a drag that returns to the start is not', () => {
  const s = setup(); s.handlers.onTouchStart(s.event());
  s.handlers.onTouchMove(s.event({ touches: [s.touch(4, 4)] }));
  s.handlers.onTouchEnd(s.event({ touches: [], changedTouches: [s.touch(4, 4)], timeStamp: 100 }));
  assert.equal(s.clicks(), 1);
  s.handlers.onTouchStart(s.event());
  s.handlers.onTouchMove(s.event({ touches: [s.touch(20, 0)] }));
  s.handlers.onTouchEnd(s.event({ touches: [], timeStamp: 100 }));
  assert.equal(s.clicks(), 1);
});
test('cancelled touches, long presses, multitouch and context menus never trigger navigation', () => {
  for (const cancel of ['onTouchCancel', 'onContextMenu']) {
    const s = setup(); s.handlers.onTouchStart(s.event()); s.handlers[cancel]();
    s.handlers.onTouchEnd(s.event({ touches: [], timeStamp: 100 })); assert.equal(s.clicks(), 0);
  }
  const s = setup(); s.handlers.onTouchStart(s.event());
  s.handlers.onTouchEnd(s.event({ touches: [], timeStamp: 600 })); assert.equal(s.clicks(), 0);
  s.handlers.onTouchStart(s.event({ touches: [s.touch(), s.touch(1, 1, 2)] }));
  s.handlers.onTouchEnd(s.event({ touches: [], timeStamp: 100 })); assert.equal(s.clicks(), 0);
});
test('cancelled default actions and disconnected links remain untouched', () => {
  for (const extra of [{defaultPrevented:true}, {cancelable:false}]) {
    const s = setup(); s.handlers.onTouchStart(s.event());
    s.handlers.onTouchEnd(s.event({ touches: [], timeStamp:100, ...extra })); assert.equal(s.clicks(), 0);
  }
  const s = setup(); s.handlers.onTouchStart(s.event()); s.link.isConnected = false;
  s.handlers.onTouchEnd(s.event({ touches: [], timeStamp:100 })); assert.equal(s.clicks(), 0);
});
