import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
 const exports={},state=[],routes=[];let index=0,closed=0;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/workspace-create.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,URLSearchParams,require(name){
   if(name==='react')return {useState(initial){const slot=index++;if(!(slot in state))state[slot]=initial;return [state[slot],value=>state[slot]=value];}};
   if(name==='next/navigation')return {useRouter:()=>({push:value=>routes.push(value)})};
   if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
   return {default:'Drawer',ChoiceGroup:'Choices'};
  }
 });
 return {routes,closed:()=>closed,render(){index=0;return exports.default({date:'2026-10-27',onClose:()=>closed++}).props.children;}};
}
test('work creation carries the selected calendar date into the work editor',()=>{
 const h=harness(),form=h.render();form.props.onSubmit({preventDefault(){}});
 assert.equal(h.routes[0],'/work/new?date=2026-10-27');assert.equal(h.closed(),1);
});
test('switching to schedule and changing the date opens the schedule registration form',()=>{
 const h=harness();let form=h.render();form.props.children[0].props.onChange('schedule');
 form.props.children[1].props.children[1].props.onChange({target:{value:'2026-11-03'}});
 form=h.render();form.props.onSubmit({preventDefault(){}});
 assert.equal(h.routes[0],'/schedule?date=2026-11-03&new=1');assert.equal(h.closed(),1);
});
test('clearing the date disables submission and prevents navigation',()=>{
 const h=harness();let form=h.render();form.props.children[1].props.children[1].props.onChange({target:{value:''}});
 form=h.render();assert.equal(form.props.children[2].props.disabled,true);form.props.onSubmit({preventDefault(){}});
 assert.equal(h.routes.length,0);assert.equal(h.closed(),0);
});
