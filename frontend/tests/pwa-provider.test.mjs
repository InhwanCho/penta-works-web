import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function provider(controlled=true,path='/') {
 const listeners=new Map(),events=new Map();let reloads=0,cleanup;
 const exports={};const source=ts.transpileModule(fs.readFileSync(new URL('../src/components/provider/pwa-provider.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,process:{env:{NODE_ENV:'production'}},navigator:{serviceWorker:{controller:controlled?{}:null,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{location:{reload:()=>reloads++},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setTimeout:()=>1,setInterval:()=>2,clearTimeout(){},clearInterval(){}},require:name=>name==='react'?{useEffect:fn=>cleanup=fn()}:{usePathname:()=>path}});
 exports.default();return {listeners,events,reloads:()=>reloads,cleanup:()=>cleanup?.()};
}
test('a new controller reloads an installed app only once and cleanup removes listeners',()=>{
 const h=provider();h.listeners.get('controllerchange')();h.listeners.get('controllerchange')();assert.equal(h.reloads(),1);assert.ok(h.events.has('pageshow'));h.cleanup();assert.equal(h.listeners.size,0);
});
test('first installation and invitation password forms are not forcibly reloaded',()=>{
 const h=provider(false);h.listeners.get('controllerchange')();assert.equal(h.reloads(),0);
 for(const path of ['/accept-invite','/reset-password'])assert.equal(provider(true,path).listeners.size,0);
});
