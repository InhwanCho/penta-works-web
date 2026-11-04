import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function picker(initial) {
 const state=[],exports={};let index=0,value=initial;
 const react={...require('react'),useId:()=>'period',useRef:()=>({current:null}),useState:initial=>{
  const slot=index++;if(!(slot in state))state[slot]=initial;
  return [state[slot],next=>{state[slot]=next;}];
 }};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/site/period-date-time-picker.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?react:require(name)});
 function render(){
  index=0;const tree=exports.default({label:'시작 일시',name:'periodStart',value,onChange:next=>{value=next;}}),nodes=[];
  function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;nodes.push(node);visit(node.props?.children);}
  visit(tree);return nodes;
 }
 return {render,value:()=>value};
}
const labelled=(nodes,label)=>nodes.find(node=>node.props?.['aria-label']===label);
test('calendar handles leap and regular February without native date inputs',()=>{
 for(const [year,last] of [[2028,29],[2026,28]]){
  const nodes=picker(`${year}-02-10T11:54`).render();
  assert.ok(labelled(nodes,`${year}년 2월 ${last}일`));
  assert.equal(labelled(nodes,`${year}년 2월 ${last+1}일`),undefined);
  assert.ok(!nodes.some(node=>node.type==='input'&&node.props.type!=='hidden'));
 }
});
test('month navigation crosses year boundary and selection preserves time and form value',()=>{
 const field=picker('2026-01-31T11:54');
 labelled(field.render(),'이전 달').props.onClick();
 labelled(field.render(),'2025년 12월 15일').props.onClick();
 assert.equal(field.value(),'2025-12-15T11:54');
 assert.equal(field.render().find(node=>node.type==='input').props.value,'2025-12-15T11:54');
 labelled(field.render(),'다음 달').props.onClick();
 assert.ok(labelled(field.render(),'2026년 1월 31일'));
});
test('hour and minute edits preserve selected date including midnight',()=>{
 const field=picker('2028-02-29T11:54');
 labelled(field.render(),'시작 일시 시').props.onChange({target:{value:'00'}});
 labelled(field.render(),'시작 일시 분').props.onChange({target:{value:'00'}});
 assert.equal(field.value(),'2028-02-29T00:00');
});
