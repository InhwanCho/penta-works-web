import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ navigation = false, stored = new Map(), historyLength = 2 } = {}) {
  let cells=[], cursor=0, queued=[], rerender=false, output, args;
  const listeners=new Map(), nav=new Map(), historyCalls=[];
  const on=(map,k,fn)=>{if(!map.has(k))map.set(k,new Set());map.get(k).add(fn);};
  const off=(map,k,fn)=>map.get(k)?.delete(fn);
  const react={
    useState(initial){const i=cursor++;if(!cells[i])cells[i]={value:initial};return [cells[i].value,v=>{const next=typeof v==='function'?v(cells[i].value):v;if(!Object.is(next,cells[i].value)){cells[i].value=next;rerender=true;}}];},
    useRef(initial){const i=cursor++;if(!cells[i])cells[i]={current:initial};return cells[i];},
    useEffect(fn,deps){const i=cursor++,prev=cells[i];if(!prev||deps.some((v,j)=>!Object.is(v,prev.deps[j]))){queued.push(()=>{prev?.cleanup?.();cells[i]={deps,cleanup:fn()};});}},
  };
  const window={confirm:()=>false,location:{href:'https://app.example/schedule'},history:{length:historyLength,state:{__NA:true},pushState(state){this.state=state;this.length++;historyCalls.push('push');},back(){historyCalls.push('back');},forward(){historyCalls.push('forward');}},addEventListener:(k,fn)=>on(listeners,k,fn),removeEventListener:(k,fn)=>off(listeners,k,fn)};
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

test('empty default changes do not save or restore a draft when a content predicate is provided',()=>{
 const keep=value=>!!value.body?.trim();
 const h=harness({navigation:true});
 const base={storageKey:'content:1',enabled:true,value:{body:'',kind:'PM'},onRestore(){},shouldKeep:keep};
 h.render(base);h.render({...base,value:{body:'',kind:'ACR'}});
 assert.equal(h.current.dirty,false);assert.equal(h.stored.has('content:1'),false);
 h.render({...base,value:{body:'측정 완료',kind:'ACR'}});assert.equal(h.current.dirty,true);
 h.unmount();
 const stored=new Map([['content:1',JSON.stringify({version:1,at:new Date().toISOString(),value:{body:'',kind:'ACR'}})]]);
 const next=harness({stored});next.render(base);assert.equal(next.current.pending,null);assert.equal(stored.has('content:1'),false);
});

test('minor edits can be saved as drafts without leave confirmation',()=>{
 const h=harness({navigation:true});let confirms=0;h.window.confirm=()=>{confirms++;return false;};
 const base={storageKey:'minor:1',enabled:true,value:{title:''},onRestore(){},warnOnLeave:false};
 h.render(base);h.render({...base,value:{title:'날짜만 변경'}});assert.equal(h.current.confirmLeave(),true);
 h.navigate({navigationType:'traverse',cancelable:true,preventDefault(){assert.fail('minor change should not block');}});
 assert.equal(confirms,0);h.unmount();
});
test('reducing entered content below the threshold removes a previously stored draft',()=>{
 const h=harness({navigation:true});const keep=value=>value.body.trim().length>=12;
 const base={storageKey:'reduce:1',enabled:true,value:{body:''},shouldKeep:keep,onRestore(){}};
 h.render(base);h.render({...base,value:{body:'회의 후 펌프 및 냉각수 상태를 다시 확인하기로 했습니다.'}});
 assert.ok(h.stored.has('reduce:1'));
 assert.equal(JSON.parse(h.stored.get('reduce:1')).baseline.body,'');
 h.render({...base,value:{body:'메모'}});
 assert.equal(h.current.dirty,false);assert.equal(h.stored.has('reduce:1'),false);
});
test('legacy edit drafts are revalidated against the loaded original before offering recovery',()=>{
 const body='이미 저장되어 있는 충분히 긴 원본 업무기록입니다.';
 const stored=new Map([['legacy:1',JSON.stringify({version:1,at:new Date().toISOString(),value:{body}})]]);
 const keep=(value,baseline)=>value.body.length>=12&&value.body!==baseline?.body;
 const h=harness({navigation:true,stored});const base={storageKey:'legacy:1',enabled:false,value:{body:''},shouldKeep:keep,onRestore(){}};
 h.render(base);assert.ok(h.current.pending);
 h.render({...base,enabled:true,value:{body}});
 assert.equal(h.current.pending,null);assert.equal(h.stored.has('legacy:1'),false);
});
test('clearing a small local edit does not delete a newer draft from another tab',()=>{
 const h=harness({navigation:true});const base={storageKey:'tabs:1',enabled:true,value:{body:''},shouldKeep:value=>value.body.length>=12,onRestore(){}};
 h.render(base);h.render({...base,value:{body:'이 창에서 입력한 충분히 긴 업무 메모입니다.'}});
 const other=JSON.stringify({version:1,at:new Date().toISOString(),value:{body:'다른 창에서 더 최근에 입력한 기록입니다.'}});
 h.stored.set('tabs:1',other);h.render({...base,value:{body:'짧음'}});
 assert.equal(h.stored.get('tabs:1'),other);
});
test('editor back uses actual browser history and skips only the Safari guard entry',()=>{
 const h=harness({historyLength:2});let fallbacks=0;
 h.render({storageKey:'back:1',enabled:true,value:{title:''},onRestore(){}});
 h.current.back(()=>fallbacks++);assert.equal(h.historyCalls.at(-1),'back');assert.equal(fallbacks,0);
 h.emit('popstate',{stopImmediatePropagation(){}});
 assert.equal(h.historyCalls.filter(value=>value==='back').length,2);assert.equal(fallbacks,0);
});
test('a direct entry falls back only when no real prior page exists and protects unsaved content',()=>{
 const h=harness({historyLength:1});let fallbacks=0;
 const base={storageKey:'direct:1',enabled:true,value:{title:''},onRestore(){}};
 h.render(base);assert.equal(h.window.history.length,2);
 h.current.back(()=>fallbacks++);assert.equal(fallbacks,1);assert.equal(h.historyCalls.includes('back'),false);
 h.render({...base,value:{title:'저장 전 내용'}});h.current.back(()=>fallbacks++);assert.equal(fallbacks,1);
 h.window.confirm=()=>true;h.current.back(()=>fallbacks++);assert.equal(fallbacks,2);
});
test('modern navigation goes straight to the actual previous history entry',()=>{
 const h=harness({navigation:true,historyLength:2});let fallback=false;
 h.render({storageKey:'modern-back:1',enabled:true,value:{title:''},onRestore(){}});
 h.current.back(()=>fallback=true);assert.equal(h.historyCalls.at(-1),'back');assert.equal(h.historyCalls.includes('push'),false);assert.equal(fallback,false);
});
