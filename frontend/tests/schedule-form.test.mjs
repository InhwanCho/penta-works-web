import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const helper={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/draft-content.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:helper});
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/schedule-form.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:()=>helper});
const times=form=>JSON.parse(JSON.stringify(out.scheduleTimes(form)));
test('new hospital and general schedules default to all-day',()=>{
 const f=out.newScheduleForm('2026-10-27');assert.equal(f.allDay,true);
 assert.deepEqual(times(f),{startAt:'2026-10-27T00:00',endAt:'2026-10-27T23:59'});
 f.targetKind='HOSPITAL';f.endDate='2026-10-29';assert.equal(times(f).endAt,'2026-10-29T23:59');
});
test('date-only edits retain times and missing end time survives reopening',()=>{
 const record={siteId:'001',title:'방문',body:'',startAt:'2026-10-27T09:00:00',endAt:'2026-10-27T10:00:00'};
 const f=out.scheduleEditForm(record);f.date='2026-10-28';f.endDate='2026-10-28';
 assert.deepEqual(times(f),{startAt:'2026-10-28T09:00',endAt:'2026-10-28T10:00'});
 f.endTime='';assert.deepEqual(times(f),{startAt:'2026-10-28T09:00',endAt:'2026-10-28T09:00'});
 assert.equal(out.scheduleEditForm({...record,...times(f)}).endTime,'');
});
test('minor date or classification changes do not trigger leave warnings',()=>{
 const f=out.newScheduleForm('2026-10-27');f.title='a';assert.equal(out.substantialScheduleChange(f),false);
 f.title='정전 일정에 따른 장비 점검 방문 계획';assert.equal(out.substantialScheduleChange(f),true);
 const old={siteId:null,title:f.title,body:'',startAt:'2026-10-27T00:00:00',endAt:'2026-10-27T23:59:00'};
 const edit=out.scheduleEditForm(old);edit.date='2026-10-28';edit.endDate='2026-10-28';edit.personalKind='leave';assert.equal(out.substantialScheduleChange(edit,old),false);
 edit.body='특이사항 입력';assert.equal(out.substantialScheduleChange(edit,old),false);
 edit.body='정전 이후 전원 인가 및 장비 상태 확인 예정';assert.equal(out.substantialScheduleChange(edit,old),true);
 const typo=out.scheduleEditForm(old);typo.title+='.';assert.equal(out.substantialScheduleChange(typo,old),false);
});
test('previous timestamp-based drafts retain date, times and entered text',()=>{
 const form=out.normalizeScheduleForm({title:'이전 작성 내용',body:'방문 메모',startAt:'2026-10-28T09:00',endAt:'2026-10-28T10:00'},'2026-10-26');
 assert.equal(form.date,'2026-10-28');assert.equal(form.title,'이전 작성 내용');assert.equal(form.allDay,false);assert.equal(times(form).endAt,'2026-10-28T10:00');
});

test('quick PM date changes preserve times, duration and omitted end time across month boundaries',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(out.moveScheduleDate({startAt:'2026-10-30T09:15:00',endAt:'2026-11-01T18:00:00'},'2026-11-05'))),{startAt:'2026-11-05T09:15:00',endAt:'2026-11-07T18:00:00'});
 assert.deepEqual(JSON.parse(JSON.stringify(out.moveScheduleDate({startAt:'2026-10-27T00:00:00',endAt:'2026-10-27T23:59:00'},'2026-11-02'))),{startAt:'2026-11-02T00:00:00',endAt:'2026-11-02T23:59:00'});
 const onlyStart=out.moveScheduleDate({startAt:'2026-10-27T09:00',endAt:'2026-10-27T09:00'},'2026-10-28');assert.equal(onlyStart.startAt,onlyStart.endAt);
});
