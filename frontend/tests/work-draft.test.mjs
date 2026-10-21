import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ navigation = false, stored = new Map() } = {}) {
  let cells=[], cursor=0, queued=[], rerender=false, output, args;
  const listeners=new Map(), nav=new Map(), historyCalls=[];
  const on=(map,k,fn)=>{if(!map.has(k))map.set(k,new Set());map.get(k).add(fn);};
  const off=(map,k,fn)=>map.get(k)?.delete(fn);
  const react={
    useState(initial){const i=cursor++;if(!cells[i])cells[i]={value:initial};return [cells[i].value,v=>{const next=typeof v==='function'?v(cells[i].value):v;if(!Object.is(next,cells[i].value)){cells[i].value=next;rerender=true;}}];},
    useRef(initial){const i=cursor++;if(!cells[i])cells[i]={current:initial};return cells[i];},
    useEffect(fn,deps){const i=cursor++,prev=cells[i];if(!prev||deps.some((v,j)=>!Object.is(v,prev.deps[j]))){queued.push(()=>{prev?.cleanup?.();cells[i]={deps,cleanup:fn()};});}},
  };
  const window={confirm:()=>false,location:{href:'https://app.example/schedule'},history:{state:{__NA:true},pushState(state){this.state=state;historyCalls.push('push');},back(){historyCalls.push('back');},forward(){historyCalls.push('forward');}},addEventListener:(k,fn)=>on(listeners,k,fn),removeEventListener:(k,fn)=>off(listeners,k,fn)};
  if(navigation)window.navigation={addEventListener:(k,fn)=>on(nav,k,fn),removeEventListener:(k,fn)=>off(nav,k,fn)};
  const exports={};const code=ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/use-work-draft.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,require:()=>react,Date,window,document:{addEventListener(){},removeEventListener(){}},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)}});
  const render=(next=args)=>{args=next;let n=0;do{assert.ok(n++<30,'hook must settle');rerender=false;cursor=0;queued=[];output=exports.useWorkDraft(args);queued.forEach(fn=>fn());}while(rerender);return output;};
  return {render,stored,window,historyCalls,get current(){return output;},emit:(type,event={})=>{for(const fn of [...(listeners.get(type)||[])])fn(event);},navigate:event=>{for(const fn of nav.get('navigate')||[])fn(event);},unmount:()=>cells.forEach(c=>c?.cleanup?.())};
}
test('draft stays in device storage, restores without saving remotely and clears only after save',()=>{
  const h=harness({navigation:true});let restored;
  const base={storageKey:'schedule:1',enabled:true,value:{title:''},onRestore:v=>restored=v};h.render(base);h.render({...base,value:{title:'기기 일정'}});
  assert.equal(h.current.dirty,true);assert.equal(JSON.parse(h.stored.get('schedule:1')).value.title,'기기 일정');
  h.unmount();const second=harness({stored:h.stored,navigation:true});second.render({...base,enabled:false});assert.ok(second.current.pending);
  second.current.restore();assert.equal(restored.title,'기기 일정');second.render({...base,value:restored});assert.equal(second.current.dirty,true);
  second.current.clear();second.render();assert.equal(second.stored.has('schedule:1'),false);assert.equal(second.current.dirty,false);
});
test('Safari back cancellation returns to editor, accepting back leaves, and modern traversal can be cancelled',()=>{
  const base={storageKey:'record:1',enabled:true,value:{title:''},onRestore(){}};
  const h=harness();h.render(base);h.render({...base,value:{title:'변경'}});
  const event={stopImmediatePropagation(){}};h.emit('popstate',event);assert.equal(h.historyCalls.at(-1),'forward');h.emit('popstate',event);
  h.window.confirm=()=>true;h.emit('popstate',event);assert.equal(h.historyCalls.at(-1),'back');h.unmount();
  const modern=harness({navigation:true});modern.render(base);modern.render({...base,value:{title:'변경'}});let cancelled=false;
  modern.navigate({navigationType:'traverse',cancelable:true,preventDefault(){cancelled=true;}});assert.equal(cancelled,true);
});
test('account scope change never writes a previous user draft to the next user storage key',()=>{
  const h=harness({navigation:true});const base={storageKey:'user:1',enabled:true,value:{title:''},onRestore(){}};
  h.render(base);h.render({...base,value:{title:'개인 초안'}});h.render({...base,storageKey:'user:2',value:{title:''}});
  assert.equal(h.stored.has('user:2'),false);assert.equal(JSON.parse(h.stored.get('user:1')).value.title,'개인 초안');
});
