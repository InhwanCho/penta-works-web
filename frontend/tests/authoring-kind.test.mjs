import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){
 const exports={},routes=[],prefetched=[];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/authoring-kind.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,URLSearchParams,require(name){
   if(name==='react')return {useEffect:fn=>fn()};
   if(name==='next/navigation')return {useRouter:()=>({push:()=>assert.fail("mode switches must not add history entries"),replace:value=>routes.push(value),prefetch:value=>prefetched.push(value)})};
   if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
   return {ChoiceGroup:'Choices'};
  }
 });
 return {routes,prefetched,render:args=>exports.default({value:'work',date:'2026-11-03',confirmLeave:()=>true,navigate:action=>action(),...args}).props.children.props};
}
test('switching registration types keeps the entered date and opens the intended form',()=>{
 const h=harness();h.render().onChange('schedule');assert.equal(h.routes[0],'/schedule?date=2026-11-03&new=1');
 h.render({value:'schedule'}).onChange('work');assert.equal(h.routes[1],'/work/new?date=2026-11-03');
});
test('the alternate registration route is prefetched before selecting its radio',()=>{
 const h=harness();h.render();assert.equal(h.prefetched[0],'/schedule?date=2026-11-03&new=1');
 h.render({value:'schedule',date:'2026-11-04'});assert.equal(h.prefetched[1],'/work/new?date=2026-11-04');assert.equal(h.routes.length,0);
});
test('same-type selections, saving states and cancelled leave confirmations keep the current form',()=>{
 const h=harness();let checks=0;
 const confirmLeave=()=>{checks++;return false;};
 h.render({confirmLeave}).onChange('work');assert.equal(checks,0);
 h.render({confirmLeave,disabled:true}).onChange('schedule');assert.equal(checks,0);
 h.render({confirmLeave}).onChange('schedule');assert.equal(checks,1);assert.equal(h.routes.length,0);
});
