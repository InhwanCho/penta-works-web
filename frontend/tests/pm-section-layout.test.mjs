import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/service-fields.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,require(name){
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  return {ChoiceGroup:'ChoiceGroup',default:'AcrFields'};
 }
});
function find(tree,predicate){
 if(Array.isArray(tree))return tree.flatMap(child=>find(child,predicate));
 if(!tree||typeof tree!=='object')return [];
 return [...(predicate(tree)?[tree]:[]),...find(tree.props?.children,predicate)];
}
const item=(section,name,value)=>({section,name,purpose:'확인',result:'',comment:'',noCheck:false,options:[{v:'pass',l:'적합'},{v:'fail',l:'부적합'}],fields:[{label:'측정값',value}]});
const details=()=>({contractType:'C',pm:[item('Image Quality','DQA Tool','10'),item('Gradient','Gradient module','20'),item('Image Quality','LV Shim','30')]});
test('PM items are grouped under section headings without hiding or dropping inputs',()=>{
 const tree=exports.default({type:'PM',details:details(),onChange(){}});
 const groups=find(tree,node=>node.props?.className==='work-pm-group');
 assert.equal(groups.length,2);assert.equal(groups[0].props['aria-label'],'Image Quality');assert.equal(groups[1].props['aria-label'],'Gradient');
 assert.equal(find(groups[0],node=>node.props?.className?.startsWith('work-pm-item ')).length,2);
 assert.equal(find(groups[1],node=>node.props?.className?.startsWith('work-pm-item ')).length,1);
 assert.equal(find(tree,node=>node.type==='input'&&node.props?.value==='30').length,1);
});
test('a measurement or verdict in a grouped section still updates its original PM item',()=>{
 const d=details(),updates=[];const tree=exports.default({type:'PM',details:d,onChange:next=>updates.push(next)});
 const gradient=find(tree,node=>node.props?.className==='work-pm-group'&&node.props['aria-label']==='Gradient')[0];
 find(gradient,node=>node.type==='input'&&node.props?.value==='20')[0].props.onChange({target:{value:'25'}});
 assert.equal(updates[0].pm[1].fields[0].value,'25');assert.equal(updates[0].pm[0].fields[0].value,'10');assert.equal(updates[0].pm[2].fields[0].value,'30');assert.equal(d.pm[1].fields[0].value,'20');
 find(gradient,node=>node.type==='ChoiceGroup')[0].props.onChange('fail');
 assert.equal(updates[1].pm[1].result,'fail');assert.equal(updates[1].pm[0].result,'');assert.equal(updates[1].pm[2].result,'');
});
