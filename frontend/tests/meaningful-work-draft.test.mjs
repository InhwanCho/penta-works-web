import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root=new URL('../src/components/workspace/',import.meta.url),modules={};
function load(file){if(modules[file])return modules[file];const out={};modules[file]=out;vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:out,structuredClone,require:name=>name.endsWith('.json')?JSON.parse(fs.readFileSync(new URL(name,root),'utf8')):load(name+'.ts')});return out;}
const {initialDetails}=load('service-form-model.ts'),{hasMeaningfulWorkDraft:keep}=load('meaningful-work-draft.ts');
test('blank records and preset selections do not prompt for recovery',()=>{
 const d=initialDetails();d.engineer='담당자';d.model='MRI';d.contractType='W';d.magneticFieldTesla='3';
 assert.equal(keep({form:{title:'',body:''},details:d,photoIds:[]}),false);
});
test('actual text, measurements, checklist results and photos qualify as drafts',()=>{
 for(const change of [d=>d.pm[0].result='pass',d=>d.pm[1].fields[1].value='0',d=>d.acr.geo.sag='148',d=>d.prepItems='부품',d=>d.parts='팬']){
  const d=initialDetails();change(d);assert.equal(keep({details:d}),true);
 }
 assert.equal(keep({form:{title:'수리'}}),true);assert.equal(keep({photoIds:[1]}),true);
});
