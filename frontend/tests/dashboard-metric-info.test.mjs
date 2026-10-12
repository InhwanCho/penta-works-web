import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let now=0, cursor=0, pending=false, closed=0;
  const hooks=[], effects=[], timers=new Map();
  const source=ts.transpileModule(fs.readFileSync(new URL('../src/components/dashboard/dashboard-metric-info.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}
  }).outputText;
  const react={
    useRef:initial=>{const index=cursor++; return hooks[index]??(hooks[index]={current:initial});},
    useEffect:(callback,deps)=>{
      const index=cursor++, prior=hooks[index];
      if(!prior || deps.some((value,i)=>!Object.is(value,prior.deps[i]))) effects.push(()=>{
        prior?.cleanup?.();hooks[index]={deps,cleanup:callback()};
      });
    }
  };
  const exports={};
  vm.runInNewContext(source,{
    exports,require:name=>({react,'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},
      '@tanstack/react-query':{useQuery:()=>({isPending:pending,data:[]})},
      '@/lib/api':{apiFetch(){}},'@/lib/alert-range':{}}[name]),
    window:{addEventListener(){},removeEventListener(){}},
    setTimeout:(callback,delay)=>{const id={};timers.set(id,{callback,at:now+delay});return id;},
    clearTimeout:id=>timers.delete(id)
  });
  const close=()=>closed++;
  return {
    render(selection,options={}) {pending=options.pending??false;cursor=0;exports.default({selection,onClose:options.onClose??close,onEdit(){}});effects.splice(0).forEach(effect=>effect());},
    advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}},
    get closed(){return closed;},
    unmount(){hooks.forEach(hook=>hook?.cleanup?.());},get timerCount(){return timers.size;}
  };
}
const choice=key=>({siteId:'001',hospital:'신당서울',metricKey:key,label:key});

test('loaded card closes at three seconds despite ordinary rerenders',()=>{
 const h=harness(),selection=choice('achumi');h.render(selection);h.advance(2000);h.render(selection);h.advance(999);assert.equal(h.closed,0);h.advance(1);assert.equal(h.closed,1);
});
test('new metric and repeated click reset the old deadline and leave only one timer',()=>{
 const h=harness();h.render(choice('hepres'));h.advance(2000);const selection=choice('achumi');h.render(selection);assert.equal(h.timerCount,1);h.advance(1000);assert.equal(h.closed,0);
 h.render({...selection});h.advance(2999);assert.equal(h.closed,0);h.advance(1);assert.equal(h.closed,1);
});
test('slow or hung information fetch cannot delay the three-second deadline',()=>{
 const h=harness(),selection=choice('achumi');h.render(selection,{pending:true});h.advance(2000);h.render(selection);h.advance(999);assert.equal(h.closed,0);h.advance(1);assert.equal(h.closed,1);
 const hung=harness();hung.render(selection,{pending:true});hung.advance(3000);assert.equal(hung.closed,1);
});
test('manual close and unmount cancel a stale timer',()=>{
 const h=harness();h.render(choice('achumi'));h.advance(2000);h.unmount();h.advance(10000);assert.equal(h.closed,0);assert.equal(h.timerCount,0);
});
test('the deadline calls the latest close callback without restarting',()=>{
 const h=harness(),selection=choice('achumi');let latest=0;h.render(selection);h.advance(2000);h.render(selection,{onClose:()=>latest++});h.advance(1000);assert.equal(latest,1);assert.equal(h.closed,0);
});

test('rapid repeated clicks always leave a live timer for the last card',()=>{
 const h=harness();for(let i=0;i<100;i++){h.render(choice(i%2 ? 'achumi':'hepres'));h.advance(20);}
 assert.equal(h.timerCount,1);assert.equal(h.closed,0);h.advance(2979);assert.equal(h.closed,0);h.advance(1);assert.equal(h.closed,1);
});
