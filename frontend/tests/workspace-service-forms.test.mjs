import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root=new URL('../src/components/workspace/',import.meta.url);
function load(file){const out={};const source=ts.transpileModule(fs.readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports:out,structuredClone,require:name=>name.endsWith('.json')?JSON.parse(fs.readFileSync(new URL(name,root),'utf8')):{}});return out;}
const model=load('service-form-model.ts'),dates=load('work-planning.ts');
test('PM form contains all 15 source checklist items and begins without inferred pass results',()=>{const d=model.initialDetails();assert.equal(d.pm.length,15);assert.ok(d.pm.every(p=>p.result===''));d.pm[0].comment='modified';assert.equal(model.initialDetails().pm[0].comment,'');});
test('ACR arithmetic retains source formulas and leaves missing or zero-denominator inputs blank',()=>{assert.equal(model.acrCalculate('sta','t1thk',{t1top:'50',t1bot:'50'}),'5.00');assert.equal(model.acrCalculate('piu','t1piu',{t1low:'90',t1high:'110'}),'90.00');assert.equal(model.acrCalculate('psg','ratio',{large:'100',top:'10',bot:'10',left:'8',right:'8'}),'2.00');assert.equal(model.acrCalculate('sta','t1thk',{t1top:'0',t1bot:'0'}),'');assert.equal(model.acrCalculate('piu','t1piu',{}),'');});
test('details round trip preserves checkbox, PM, ACR and pulse values but ignores invalid form schemas',()=>{const d=model.initialDetails();d.countsAsPm=true;d.pm[0].result='pass';d.pm[1].fields[0].value='42';d.acr.geo.sag='148';d.acrVerdicts.geo='pass';d.acrPulse['표준 T1'][0]='SE';const saved=model.parseDetails(JSON.stringify(d));assert.equal(saved.pm[1].fields[0].value,'42');assert.equal(saved.acr.geo.sag,'148');assert.equal(saved.acrPulse['표준 T1'][0],'SE');assert.equal(saved.countsAsPm,true);assert.equal(model.parseDetails('{broken').pm.length,15);assert.equal(model.parseDetails(JSON.stringify({pm:[{name:'unknown'}],engineer:{bad:true},acrVerdicts:{geo:'unsafe'}})).engineer,'');});
test('due dates clamp month ends and older manual overrides stop overriding newer completed visits',()=>{assert.equal(dates.addCalendarMonths('2026-01-31',1),'2026-02-28');assert.equal(dates.nextDue('2026-10-10','2026-10-01',2),'2026-12-10');assert.equal(dates.nextDue(undefined,'2026-11-01',2),'2026-11-01');assert.equal(dates.daysBetween('2026-10-15','2026-10-16'),-1);assert.equal(dates.calendarDays('2026-10').length,42);});
test('asset links survive work detail edits and reject malformed identifiers',()=>{const d=model.parseDetails(JSON.stringify({assetIds:[7,7,8,-1,2.5,'9',null]}));assert.equal(JSON.stringify(d.assetIds),'[7,8]');assert.equal(JSON.stringify(model.parseDetails(JSON.stringify(model.computedDetails(d))).assetIds),'[7,8]');});

test('ACR field limits include exact geometry, thickness, position and ghosting boundaries',()=>{
 for(const [section,key,low,high] of [['geo','sag',146,150],['geo','axc',188,192],['geo','axd',188,192],['sta','t1thk',4.3,5.7],['sta','t2thk',4.3,5.7],['spa','t1s1',-5,5],['psg','ratio',0,2.5]]) {
  for(const value of [low,high]) assert.equal(model.acrFieldVerdict(section,key,{[key]:String(value)}),'pass');
  for(const value of [low-.01,high+.01]) assert.equal(model.acrFieldVerdict(section,key,{[key]:String(value)}),'fail');
  assert.equal(model.acrFieldVerdict(section,key,{[key]:''}),'');
  assert.equal(model.acrFieldVerdict(section,key,{[key]:'not-a-number'}),'invalid');
 }
});
test('PIU switches between 1.5T and 3T limits and rejects impossible percentages',()=>{
 assert.equal(model.acrFieldVerdict('piu','t1piu',{t1piu:'87.5'},'1.5'),'pass');
 assert.equal(model.acrFieldVerdict('piu','t1piu',{t1piu:'82'},'1.5'),'fail');
 assert.equal(model.acrFieldVerdict('piu','t1piu',{t1piu:'82'},'3'),'pass');
 assert.equal(model.acrFieldVerdict('piu','t1piu',{t1piu:'81.99'},'3'),'fail');
 assert.equal(model.acrFieldVerdict('piu','t2piu',{t2piu:'101'},'3'),'fail');
});
test('automatic verdicts recalculate without overriding saved manual choices',()=>{
 const d=model.initialDetails(); assert.equal(model.acrOverallVerdict(d),'');
 d.acr.geo.sag='145'; assert.equal(model.acrEffectiveVerdicts(d).geo,'fail');
 d.acr.geo.sag='148'; assert.equal(model.acrEffectiveVerdicts(d).geo,'pass');
 d.acrVerdicts.geo='fail'; assert.equal(model.acrEffectiveVerdicts(d).geo,'fail'); assert.equal(model.acrOverallVerdict(d),'fail');
 d.acrVerdicts.geo=''; assert.equal(model.acrEffectiveVerdicts(d).geo,'pass'); assert.equal(model.acrOverallVerdict(d),'pass');
 d.acrOverall='na'; assert.equal(model.acrOverallVerdict(model.parseDetails(JSON.stringify(d))),'na');
});
test('saved-image ACR sections remain incomplete until every required image is checked',()=>{
 for(const section of model.acrSections.filter(s=>['sag0','hcsr','lcod'].includes(s.k))) {
  const values={}; assert.equal(model.acrAutoVerdict(section.k,values),'');
  for(const [key] of section.inputs) values[key]='Y'; assert.equal(model.acrAutoVerdict(section.k,values),'pass');
  values[section.inputs[0][0]]=''; assert.equal(model.acrAutoVerdict(section.k,values),'');
 }
});
test('PM range values survive serialization and all guide image references exist',()=>{
 const d=model.initialDetails(),range=d.pm.flatMap(p=>p.fields).find(f=>f.type==='range'); range.value='0.5~0.8';
 assert.equal(model.parseDetails(JSON.stringify(d)).pm.flatMap(p=>p.fields).find(f=>f.type==='range').value,'0.5~0.8');
 for(const fig of [model.acrPreparation,...model.acrSections].flatMap(s=>s.figs||[])) {
  const data=fs.readFileSync(new URL(`../public/service-guide/acr/${fig}.jpg`,import.meta.url)); assert.equal(data[0],0xff);assert.equal(data[1],0xd8);
 }
});
test('model field strength initializes the correct PIU limit while preserving explicit saved selection',()=>{
 assert.equal(model.parseDetails(JSON.stringify({model:'SIGNA Architect 3.0T'})).magneticFieldTesla,'3');
 assert.equal(model.parseDetails(JSON.stringify({model:'SIGNA 3T',magneticFieldTesla:'1.5'})).magneticFieldTesla,'1.5');
 assert.equal(model.magneticFieldFromModel('SIGNA HDxt 1.5T'),'1.5'); assert.equal(model.magneticFieldFromModel('unknown'),undefined);
});
