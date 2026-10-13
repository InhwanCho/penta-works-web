import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
 let cursor=0,session={id:1},dashboard=null,total=2,options,callback;
 const hooks=[],effects=[],frames=new Map(),timers=new Map();let id=0;
 const client={getQueryData:()=>dashboard,getQueryCache:()=>({subscribe:fn=>{callback=fn;return ()=>callback=null;}})};
 const react={useState:initial=>{const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>hooks[i]=v];},useEffect:(fn,deps)=>{const i=cursor++,old=hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/hooks/use-unread-alerts.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
 exports,require:n=>({react,'next/navigation':{usePathname:()=> '/'},'@/components/provider/auth-provider':{useAuth:()=>({session})},'@/lib/api':{apiFetch(){}},'@tanstack/react-query':{useQueryClient:()=>client,useQuery:o=>{options=o;return {data:{total}};}}}[n]),
 requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:i=>frames.delete(i),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i)
 });
 return {render(){cursor=0;const result=exports.useUnreadAlerts();effects.splice(0).forEach(fn=>fn());return result;},get enabled(){return options.enabled;},load(){dashboard={};callback?.();},paint(){const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());},delay(){const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());},clear(){total=0;},unmount(){hooks.forEach(h=>h?.cleanup?.());}};
}
test('badge fetch waits for dashboard data, two paint opportunities and deferred timer',()=>{
 const h=harness();assert.equal(h.render(),false);assert.equal(h.enabled,false);
 h.paint();h.delay();assert.equal(h.render(),false);
 h.load();h.paint();h.delay();assert.equal(h.render(),false);
 h.paint();assert.equal(h.render(),false);h.delay();assert.equal(h.render(),true);assert.equal(h.enabled,true);
 h.clear();assert.equal(h.render(),false);
});
test('unmount cancels deferred badge work',()=>{
 const h=harness();h.render();h.load();h.paint();h.unmount();h.paint();h.delay();assert.equal(h.enabled,false);
});
