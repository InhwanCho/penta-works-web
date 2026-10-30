import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){
 let cursor=0,now=0,path='/',id=0;const hooks=[],effects=[],timers=new Map(),listeners=new Map();
 const react={useState:initial=>{const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>hooks[i]=v];},useEffect:(fn,deps)=>{const i=cursor++,old=hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
 class Element {constructor(inside=false){this.inside=inside;}closest(){return this.inside?{}:null;}}
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/common/context-help.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,require:n=>({react,'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'react-dom':{createPortal:()=>null},'next/navigation':{usePathname:()=>path}}[n]),document:{body:{}},Element,
 window:{addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)},
 setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},clearTimeout:i=>timers.delete(i)
 });
 return {render(){cursor=0;exports.ContextHelpHost();effects.splice(0).forEach(fn=>fn());},show(title='설명'){listeners.get('mreyes-context-help')?.({detail:{title,message:'도움말'}});},advance(ms){now+=ms;for(const [i,t]of[...timers])if(t.at<=now){timers.delete(i);t.fn();}},get help(){return hooks[0];},get timers(){return timers.size;},outside(inside=false){listeners.get('pointerdown')?.({target:new Element(inside)});},escape(){listeners.get('keydown')?.({key:'Escape'});},navigate(){path='/notification-settings';this.render();},unmount(){hooks.forEach(h=>h?.cleanup?.());},get listeners(){return listeners.size;}};
}
test('help remains readable until explicitly dismissed',()=>{
 const h=harness();h.render();h.show();h.advance(2000);h.render();h.advance(999);assert.ok(h.help);h.advance(1);assert.ok(h.help);assert.equal(h.timers,0);h.advance(60000);assert.ok(h.help);
});
test('rapid help clicks replace the explanation without creating auto-close timers',()=>{
 const h=harness();h.render();for(let i=0;i<100;i++){h.advance(20);h.show(String(i));}assert.equal(h.help.title,'99');assert.equal(h.timers,0);h.advance(60000);assert.equal(h.help.title,'99');
});
test('outside click, Escape, navigation and unmount dismiss help and clean listeners',()=>{
 const h=harness();h.render();h.show();h.outside(true);assert.ok(h.help);h.outside();assert.equal(h.help,null);assert.equal(h.timers,0);h.show();h.escape();assert.equal(h.help,null);h.show();h.navigate();assert.equal(h.help,null);assert.equal(h.timers,0);h.show();h.unmount();assert.equal(h.timers,0);assert.equal(h.listeners,0);
});
