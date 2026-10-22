import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){
 let path='/hospitals',dep,cleanup,ref={current:null},effect,frame=0;const frames=new Map(),scrolls=[];
 const timers=new Map(),listeners=new Map();let timer=0;
 const document={scrollingElement:{scrollTop:200,scrollLeft:10},documentElement:{scrollTop:200,scrollLeft:10},body:{scrollTop:200,scrollLeft:10}};
 const window={location:{hash:'',search:''},scrollTo:v=>scrolls.push(v),setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),addEventListener:(e,fn)=>listeners.set(e,fn),removeEventListener:e=>listeners.delete(e)};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/common/route-scroll-reset.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
  exports,window,document,URLSearchParams,requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id),require:n=>n==='react'?{useRef:()=>ref,useLayoutEffect:(fn,deps)=>{if(dep!==deps[0]){cleanup?.();effect=fn;dep=deps[0];}}}:{usePathname:()=>path}
 });
 return {window,document,scrolls,retry:()=>{const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());},input:e=>listeners.get(e)?.(),render:p=>{if(p)path=p;effect=null;exports.default();if(effect)cleanup=effect();},flush:()=>{const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());},top:exports.scrollPageToTop};
}
test('resets on a different page, repeats after layout, and leaves same-page query changes alone',()=>{const h=harness();h.render();h.flush();assert.equal(h.scrolls.length,2);h.scrolls.length=0;h.render('/settings');assert.equal(h.scrolls.length,1);h.flush();assert.equal(h.scrolls.length,2);assert.equal(h.scrolls[0].behavior,'instant');h.scrolls.length=0;h.window.location.search='?take=100';h.render();h.flush();assert.equal(h.scrolls.length,0);});
test('preserves explicit hash/monitoring scroll targets and cancels an obsolete frame',()=>{const h=harness();h.render();h.window.location.hash='#inspection-plan';h.render('/sites/11');h.flush();assert.equal(h.scrolls.length,1);h.window.location.hash='';h.window.location.search='?scrollTo=011';h.render('/');h.flush();assert.equal(h.scrolls.length,1);h.window.location.search='';h.render('/overview');h.flush();assert.equal(h.scrolls.length,3);});
test('same-tab menu action can explicitly return to the top',()=>{const h=harness();h.top();assert.equal(h.scrolls.length,1);assert.equal(h.scrolls[0].top,0);assert.equal(h.scrolls[0].left,0);});

test('resets mobile document roots and corrects a late restored scroll position',()=>{const h=harness();h.render();h.flush();for(const root of Object.values(h.document)){assert.equal(root.scrollTop,0);root.scrollTop=450;}h.retry();for(const root of Object.values(h.document))assert.equal(root.scrollTop,0);});
test('transition retries yield immediately to touch scrolling',()=>{const h=harness();h.render();h.input('touchstart');h.document.body.scrollTop=150;h.flush();h.retry();assert.equal(h.document.body.scrollTop,150);assert.equal(h.scrolls.length,1);});
test('navigation cancels old delayed resets when the destination has an explicit target',()=>{const h=harness();h.render();h.window.location.hash='#inspection-plan';h.render('/sites/11');h.retry();h.flush();assert.equal(h.scrolls.length,1);});
