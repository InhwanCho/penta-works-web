import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function provider(controlled=true,path='/',search='') {
 const listeners=new Map(),events=new Map(),destinations=[];let reloads=0,cleanup;
 const exports={};const source=ts.transpileModule(fs.readFileSync(new URL('../src/components/provider/pwa-provider.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,Date,process:{env:{NODE_ENV:'production'}},navigator:{serviceWorker:{controller:controlled?{}:null,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{location:{pathname:path,search,reload:()=>reloads++,assign:href=>destinations.push(href)},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setTimeout:()=>1,setInterval:()=>2,clearTimeout(){},clearInterval(){}},require:name=>name==='react'?{useEffect:fn=>cleanup=fn()}:{usePathname:()=>path}});
 exports.default();return {listeners,events,destinations,reloads:()=>reloads,cleanup:()=>cleanup?.()};
}
test('a new controller reloads an installed app only once and cleanup removes listeners',()=>{
 const h=provider();h.listeners.get('controllerchange')();h.listeners.get('controllerchange')();assert.equal(h.reloads(),1);assert.ok(h.events.has('pageshow'));h.cleanup();assert.equal(h.listeners.size,0);
});
test('an update during the first menu transition continues to the clicked menu instead of reloading the old screen',()=>{
 const h=provider();h.events.get('mreyes:menu-navigation')({detail:'/overview'});
 h.listeners.get('controllerchange')();h.listeners.get('controllerchange')();
 assert.deepEqual(h.destinations,['/overview']);assert.equal(h.reloads(),0);
});
test('update navigation accepts only known internal menu destinations',()=>{
 const h=provider();h.events.get('mreyes:menu-navigation')({detail:'https://outside.example'});
 h.listeners.get('controllerchange')();assert.deepEqual(h.destinations,[]);assert.equal(h.reloads(),1);
});
test('a menu navigation that clears the current query is also preserved during an update',()=>{
 const h=provider(true,'/baselines','?view=settings');h.events.get('mreyes:menu-navigation')({detail:'/baselines'});
 h.listeners.get('controllerchange')();assert.deepEqual(h.destinations,['/baselines']);assert.equal(h.reloads(),0);
});
test('first installation and invitation password forms are not forcibly reloaded',()=>{
 const h=provider(false);h.listeners.get('controllerchange')();assert.equal(h.reloads(),0);
 for(const path of ['/accept-invite','/reset-password'])assert.equal(provider(true,path).listeners.size,0);
});
