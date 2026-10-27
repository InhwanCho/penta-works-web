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
test('short text, one measurement or a single checklist choice do not prompt',()=>{
 for(const change of [d=>d.pm[0].result='pass',d=>d.pm[1].fields[1].value='0',d=>d.acr.geo.sag='148',d=>d.prepItems='부품',d=>d.parts='팬']){
  const d=initialDetails();change(d);assert.equal(keep({details:d}),false);
 }
 assert.equal(keep({form:{title:'장비 수리'}}),false);
});
test('substantial text, multiple measurements and actual photo changes are preserved',()=>{
 assert.equal(keep({form:{title:'그라디언트 칠러 펌프 교체 후 정상 동작 확인'}}),true);
 const d=initialDetails();d.acr.geo.sag='148';d.acr.geo.ax1='149';d.acr.geo.ax2='150';
 assert.equal(keep({details:d}),true);assert.equal(keep({photoIds:[1]}),true);
});
test('minor edits to a long saved record do not qualify merely because the original is long',()=>{
 const previous={form:{title:'그라디언트 칠러 점검 결과 정리',body:'방문하여 펌프와 냉각수를 점검했습니다.'},details:initialDetails(),photoIds:[1]};
 const next=structuredClone(previous);next.form.title+='.';next.details.engineer='다른 담당자';
 assert.equal(keep(next,previous),false);
 next.form.body+=' 솔레노이드 밸브 불량이 확인되어 교체가 필요합니다.';
 assert.equal(keep(next,previous),true);
 assert.equal(keep({...previous,photoIds:[1,2]},previous),true);
});
test('preset dates, times, metadata and automatic ACR verdicts do not create recovery prompts',()=>{
 const d=initialDetails();d.startTime='09:00';d.endTime='18:00';d.coldheadInDate='2026-10-27';d.acrOverall='pass';d.acrVerdicts={geo:'pass'};
 assert.equal(keep({details:d}),false);
});
